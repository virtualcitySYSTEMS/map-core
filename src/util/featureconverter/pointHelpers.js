import {
  BoxGeometry,
  BoxOutlineGeometry,
  Cartesian3,
  Cartographic, Color, ColorGeometryInstanceAttribute,
  CylinderGeometry,
  CylinderOutlineGeometry,
  EllipsoidGeometry,
  EllipsoidOutlineGeometry, GeometryInstance,
  HeadingPitchRoll, Material, MaterialAppearance,
  Matrix4,
  Model,
  ModelAnimationLoop, PerInstanceColorAppearance, Primitive,
  sampleTerrainMostDetailed,
  SphereGeometry,
  SphereOutlineGeometry,
  Transforms,
} from '@vcmap/cesium';
import { RegularShape } from 'ol/style.js';
import { createSync } from '../../layer/vectorSymbols.js';
import { PrimitiveOptionsType } from '../../layer/vectorProperties.js';
import { getCesiumColor } from '../../style/styleHelpers.js';

/**
 * @param {import("@vcmap/cesium").Primitive|import("@vcmap/cesium").Model} primitive
 * @param {import("@vcmap/cesium").Matrix4} transform
 * @param {import("@vcmap/cesium").Cartesian3} scale
 * @param {import("@vcmap/cesium").Cartesian3} offset
 */
function makeOffsetAutoScalePrimitive(primitive, transform, scale, offset) {
  const { modelMatrix } = primitive;
  let currentScale = scale.clone();
  const currentOffset = offset.clone();

  Object.defineProperty(primitive, 'modelMatrix', {
    get() { return modelMatrix; },
    set(newModelMatrix) {
      const newScale = Matrix4.getScale(newModelMatrix, new Cartesian3());
      if (!newScale.equals(currentScale)) {
        Cartesian3.multiplyComponents(newScale, scale, newScale);
        Matrix4.setScale(newModelMatrix, newScale, modelMatrix);
        currentScale = newScale;
        Cartesian3.multiplyComponents(offset, currentScale, currentOffset);
        Matrix4.multiplyByPoint(transform, currentOffset, currentOffset);
        Matrix4.setTranslation(modelMatrix, currentOffset, modelMatrix);
      }
    },
  });
}

/**
 * @param {import("@vcmap/cesium").Primitive|import("@vcmap/cesium").Model} primitive
 * @param {import("@vcmap/cesium").Cartesian3} scale
 */
function makeScaledAutoScalePrimitive(primitive, scale) {
  const { modelMatrix } = primitive;
  let currentScale = scale.clone();

  Object.defineProperty(primitive, 'modelMatrix', {
    get() { return modelMatrix; },
    set(newModelMatrix) {
      const newScale = Matrix4.getScale(newModelMatrix, new Cartesian3());
      if (!newScale.equals(currentScale)) {
        Cartesian3.multiplyComponents(newScale, scale, newScale);
        Matrix4.setScale(newModelMatrix, newScale, modelMatrix);
        currentScale = newScale;
      }
    },
  });
}

/**
 * @param {import("@vcmap/cesium").Primitive|import("@vcmap/cesium").Model} primitive
 * @param {import("@vcmap/cesium").Cartesian3} position - will be mutated
 * @param {import("@vcmap/cesium").Scene} scene
 * @param {import("@vcmap/cesium").Cartesian3} [offset]
 * @returns {Promise<void>}
 */
async function placePrimitiveOnTerrain(primitive, position, scene, offset) {
  await sampleTerrainMostDetailed(
    /** @type {import("@vcmap/cesium").CesiumTerrainProvider} */ (scene.globe.terrainProvider),
    [Cartographic.fromCartesian(position)],
  )
    .then(([cartoWithNewHeight]) => {
      if (!primitive.isDestroyed()) {
        const { modelMatrix } = primitive;
        const newPosition = Cartographic.toCartesian(cartoWithNewHeight, undefined, position);
        if (offset) {
          Cartesian3.add(newPosition, offset, newPosition);
        }
        primitive.modelMatrix = Matrix4
          .setTranslation(modelMatrix, newPosition, modelMatrix);
      }
    })
    .catch(() => {});
}

/**
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {Array<import("ol/coordinate").Coordinate>} wgs84Positions
 * @param {Array<import("@vcmap/cesium").Cartesian3>} positions
 * @param {import("@vcmap/core").VectorProperties} vectorProperties
 * @param {import("@vcmap/cesium").Scene} scene
 * @returns {null|{ primitives: Array<import("@vcmap/cesium").Model>, options: VectorPropertiesModelOptions }}
 */
export function getModelOptions(feature, wgs84Positions, positions, vectorProperties, scene) {
  const options = vectorProperties.getModel(feature);
  if (!options) {
    return null;
  }
  const scale = Cartesian3.fromArray(options.scale);
  const headingPitchRoll = HeadingPitchRoll.fromDegrees(options.heading, options.pitch, options.roll);
  const allowPicking = vectorProperties.getAllowPicking(feature);
  const primitives = positions.map((position, index) => {
    const modelMatrix = Matrix4.multiply(
      Transforms.headingPitchRollToFixedFrame(position, headingPitchRoll),
      Matrix4.fromScale(scale),
      new Matrix4(),
    );

    const additionalModelOptions = vectorProperties.getModelOptions(feature);
    const model = Model.fromGltf({
      asynchronous: !feature[createSync],
      url: options.url,
      modelMatrix,
      allowPicking,
      ...additionalModelOptions,
    });

    if (!wgs84Positions[index][2]) {
      placePrimitiveOnTerrain(model, position, scene);
    }

    model.readyPromise.then(() => {
      model.activeAnimations.addAll({
        loop: ModelAnimationLoop.REPEAT,
      });
    });

    if (options.autoScale && !Cartesian3.ONE.equals(scale)) {
      makeScaledAutoScalePrimitive(model, scale);
    }
    return model;
  });

  return {
    primitives,
    options,
  };
}

/**
 * @param {VectorPropertiesPrimitiveOptions} options
 * @param {import("@vcmap/cesium").Color} color
 * @param {boolean} [outline]
 * @returns {import("@vcmap/cesium").GeometryInstance|null}
 */
function getGeometryInstanceFromOptions(options, color, outline) {
  const { type } = options;
  let geometry;
  if (type === PrimitiveOptionsType.CYLINDER) {
    geometry = outline ?
      new CylinderOutlineGeometry(options.geometryOptions) :
      new CylinderGeometry(options.geometryOptions);
  } else if (type === PrimitiveOptionsType.ELLIPSOID) {
    if (Array.isArray(options.geometryOptions.radii)) {
      options.geometryOptions.radii = Cartesian3.fromArray(options.geometryOptions.radii);
    }
    if (Array.isArray(options.geometryOptions.innerRadii)) {
      options.geometryOptions.innerRadii = Cartesian3.fromArray(options.geometryOptions.innerRadii);
    }
    geometry = outline ?
      new EllipsoidOutlineGeometry(options.geometryOptions) :
      new EllipsoidGeometry(options.geometryOptions);
  }
  if (type === PrimitiveOptionsType.SPHERE) {
    geometry = outline ?
      new SphereOutlineGeometry(options.geometryOptions) :
      new SphereGeometry(options.geometryOptions);
  }
  if (type === PrimitiveOptionsType.BOX) {
    if (Array.isArray(options.geometryOptions.minimum)) {
      options.geometryOptions.minimum = Cartesian3.fromArray(options.geometryOptions.minimum);
    }
    if (Array.isArray(options.geometryOptions.maximum)) {
      options.geometryOptions.maximum = Cartesian3.fromArray(options.geometryOptions.maximum);
    }
    geometry = outline ?
      new BoxOutlineGeometry(options.geometryOptions) :
      new BoxGeometry(options.geometryOptions);
  }

  if (geometry) {
    return new GeometryInstance({
      geometry,
      attributes: {
        color: ColorGeometryInstanceAttribute.fromColor(color),
      },
    });
  }
  return null;
}

/**
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {import("ol/style/Style").default} style
 * @param {Array<import("ol/coordinate").Coordinate>} wgs84Positions
 * @param {Array<import("@vcmap/cesium").Cartesian3>} positions
 * @param {import("@vcmap/core").VectorProperties} vectorProperties
 * @param {import("@vcmap/cesium").Scene} scene
 * @returns {null|{ primitives: Array<import("@vcmap/cesium").Primitive>, options: VectorPropertiesPrimitive}}
 */
export function getPrimitiveOptions(feature, style, wgs84Positions, positions, vectorProperties, scene) {
  const options = vectorProperties.getPrimitive(feature);
  if (!options) {
    return null;
  }

  const imageStyle = style.getImage();
  let fill;
  let stroke;
  if (imageStyle instanceof RegularShape) {
    fill = imageStyle.getFill();
    stroke = imageStyle.getStroke();
  } else if (imageStyle) { // XXX or should we only allow primitives with regular shapes defined as image?
    fill = style.getFill();
    stroke = style.getStroke(); // XXX this makes it impossible to create an extruded un-stroked primitive with an icon in 2D or we add a new primitive option
  }

  if (!fill && !stroke) {
    return null;
  }
  let fillColor;
  if (fill) {
    fillColor = getCesiumColor(fill.getColor(), [255, 255, 255, 0.4]);
  }
  let strokeColor;
  if (stroke) {
    strokeColor = getCesiumColor(stroke.getColor(), [255, 255, 255, 0.4]);
  }

  const scale = Cartesian3.fromArray(options.scale);
  const headingPitchRoll = HeadingPitchRoll
    .fromDegrees(options.heading, options.pitch, options.roll);
  const allowPicking = vectorProperties.getAllowPicking(feature);

  const primitives = positions.flatMap((position, index) => {
    const geometryModelMatrix = Matrix4.fromScale(scale);
    let offset;
    if (options.primitiveOptions.offset?.length === 3) {
      offset = Cartesian3.fromArray(options.primitiveOptions.offset);
      Matrix4.setTranslation(
        geometryModelMatrix,
        Cartesian3.multiplyComponents(offset, scale, new Cartesian3()),
        geometryModelMatrix,
      );
    }
    const transform = Transforms.headingPitchRollToFixedFrame(position, headingPitchRoll);
    const modelMatrix = Matrix4.multiply(
      transform,
      geometryModelMatrix,
      new Matrix4(),
    );

    let deptFail;
    if (options.primitiveOptions.depthFailColor) {
      const depthFailColor = getCesiumColor(options.primitiveOptions.depthFailColor, [255, 255, 255, 0.4]);
      deptFail = new MaterialAppearance({
        translucent: depthFailColor.alpha < 1,
        material: Material.fromType('Color', {
          color: depthFailColor,
        }),
      });
    }

    const createPrimitive = (translucent, geometryInstances, depthFailAppearance) => {
      const primitive = new Primitive({
        asynchronous: !feature[createSync],
        geometryInstances,
        modelMatrix,
        appearance: new PerInstanceColorAppearance({
          translucent,
          flat: true,
        }),
        depthFailAppearance,
        allowPicking,
        ...options.primitiveOptions.additionalOptions,
      });

      if (!wgs84Positions[index][2]) {
        placePrimitiveOnTerrain(primitive, position, scene, offset)
          .then(() => {
            Transforms.headingPitchRollToFixedFrame(position, headingPitchRoll, undefined, undefined, transform); // update transform for usage in offset auto scale
          });
      }

      if (options.autoScale) {
        if (offset) {
          makeOffsetAutoScalePrimitive(primitive, transform, scale, offset);
        } else if (!Cartesian3.ONE.equals(scale)) {
          makeScaledAutoScalePrimitive(primitive, scale);
        }
      }
      return primitive;
    };

    const fillAndOutline = [];
    if (fillColor) {
      fillAndOutline.push(
        createPrimitive(
          (fillColor.alpha < 1) || !!deptFail,
          [getGeometryInstanceFromOptions(options.primitiveOptions, fillColor)],
          deptFail,
        ),
      );
    } else if (deptFail) {
      const transparent = Color.TRANSPARENT;
      fillAndOutline.push(
        createPrimitive(
          true,
          [getGeometryInstanceFromOptions(options.primitiveOptions, transparent)],
          deptFail,
        ),
      );
    }
    if (strokeColor) {
      fillAndOutline.push(
        createPrimitive(
          (strokeColor.alpha < 1) || !!deptFail,
          [getGeometryInstanceFromOptions(options.primitiveOptions, strokeColor, true)],
        ),
      );
    }
    return fillAndOutline;
  });

  return {
    primitives,
    options,
  };
}
