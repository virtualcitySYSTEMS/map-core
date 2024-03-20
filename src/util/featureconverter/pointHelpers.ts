import {
  BoxGeometry,
  BoxOutlineGeometry,
  Cartesian3,
  Cartographic,
  Color,
  ColorGeometryInstanceAttribute,
  CylinderGeometry,
  CylinderOutlineGeometry,
  EllipsoidGeometry,
  EllipsoidOutlineGeometry,
  GeometryInstance,
  HeadingPitchRoll,
  HeightReference,
  Material,
  MaterialAppearance,
  Matrix4,
  Model,
  ModelAnimationLoop,
  PerInstanceColorAppearance,
  Primitive,
  sampleTerrainMostDetailed,
  type Scene,
  SphereGeometry,
  SphereOutlineGeometry,
  Transforms,
} from '@vcmap-cesium/engine';
import type { Feature } from 'ol/index.js';
import type { Coordinate } from 'ol/coordinate.js';
import { RegularShape, type Style } from 'ol/style.js';
import { asColorLike } from 'ol/colorlike.js';
import { createSync } from '../../layer/vectorSymbols.js';
import VectorProperties, {
  PrimitiveOptionsType,
  VectorPropertiesModelOptions,
  vectorPropertiesOfType,
  VectorPropertiesPrimitive,
  VectorPropertiesPrimitiveOptions,
} from '../../layer/vectorProperties.js';
import { getCesiumColor } from '../../style/styleHelpers.js';
import ModelFill from '../../style/modelFill.js';

function makeOffsetAutoScalePrimitive(
  primitive: Primitive | Model,
  transform: Matrix4,
  scale: Cartesian3,
  offset: Cartesian3,
): void {
  const { modelMatrix } = primitive;
  let currentScale = scale.clone();
  const currentOffset = offset.clone();

  Object.defineProperty(primitive, 'modelMatrix', {
    get() {
      return modelMatrix;
    },
    set(newModelMatrix: Matrix4) {
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

function makeScaledAutoScalePrimitive(
  primitive: Primitive | Model,
  scale: Cartesian3,
): void {
  const { modelMatrix } = primitive;
  let currentScale = scale.clone();

  Object.defineProperty(primitive, 'modelMatrix', {
    get() {
      return modelMatrix;
    },
    set(newModelMatrix: Matrix4) {
      const newScale = Matrix4.getScale(newModelMatrix, new Cartesian3());
      if (!newScale.equals(currentScale)) {
        Cartesian3.multiplyComponents(newScale, scale, newScale);
        Matrix4.setScale(newModelMatrix, newScale, modelMatrix);
        currentScale = newScale;
      }
    },
  });
}

async function placePrimitiveOnTerrain(
  primitive: Primitive | Model,
  position: Cartesian3,
  scene: Scene,
  offset?: Cartesian3,
): Promise<void> {
  await sampleTerrainMostDetailed(scene.globe.terrainProvider, [
    Cartographic.fromCartesian(position),
  ])
    .then(([cartoWithNewHeight]) => {
      if (!primitive.isDestroyed()) {
        const { modelMatrix } = primitive;
        const newPosition = Cartographic.toCartesian(
          cartoWithNewHeight,
          undefined,
          position,
        );
        if (offset) {
          Cartesian3.add(newPosition, offset, newPosition);
        }
        primitive.modelMatrix = Matrix4.setTranslation(
          modelMatrix,
          newPosition,
          modelMatrix,
        );
      }
    })
    .catch(() => {});
}

export async function getModelOptions(
  feature: Feature,
  wgs84Positions: Coordinate[],
  positions: Cartesian3[],
  vectorProperties: VectorProperties,
  scene: Scene,
  style?: Style,
): Promise<null | {
  primitives: Model[];
  options: VectorPropertiesModelOptions;
}> {
  const options = vectorProperties.getModel(feature);
  if (!options) {
    return null;
  }
  const scale = Cartesian3.fromArray(options.scale);
  const headingPitchRoll = HeadingPitchRoll.fromDegrees(
    options.heading,
    options.pitch,
    options.roll,
  );
  const allowPicking = vectorProperties.getAllowPicking(feature);
  const fill = style?.getFill();
  let color: Color | undefined;
  if (fill instanceof ModelFill) {
    const olColor = fill.getColor();
    if (olColor) {
      color = Color.fromCssColorString(asColorLike(olColor) as string);
    }
  }

  const primitives = await Promise.all(
    positions.map(async (position, index) => {
      const modelMatrix = Matrix4.multiply(
        Transforms.headingPitchRollToFixedFrame(position, headingPitchRoll),
        Matrix4.fromScale(scale),
        new Matrix4(),
      );

      const additionalModelOptions = vectorProperties.getModelOptions(feature);
      const heightReference = vectorProperties.getAltitudeMode(feature);
      const model = await Model.fromGltfAsync({
        asynchronous: !feature[createSync],
        url: options.url,
        modelMatrix,
        allowPicking,
        color,
        ...additionalModelOptions,
      });

      if (
        wgs84Positions[index][2] == null ||
        heightReference === HeightReference.CLAMP_TO_GROUND
      ) {
        await placePrimitiveOnTerrain(model, position, scene);
      }

      const activateAnimations = (): void => {
        model.activeAnimations.addAll({
          loop: ModelAnimationLoop.REPEAT,
        });
      };

      if (model.ready) {
        activateAnimations();
      } else {
        const listener = model.readyEvent.addEventListener(() => {
          listener();
          activateAnimations();
        });
      }

      if (options.autoScale && !Cartesian3.ONE.equals(scale)) {
        makeScaledAutoScalePrimitive(model, scale);
      }
      return model;
    }),
  );

  return {
    primitives,
    options,
  };
}

function getGeometryInstanceFromOptions(
  options: VectorPropertiesPrimitiveOptions,
  color: Color,
  outline?: boolean,
): GeometryInstance | null {
  let geometry;
  if (vectorPropertiesOfType(options, PrimitiveOptionsType.CYLINDER)) {
    geometry = outline
      ? new CylinderOutlineGeometry(options.geometryOptions)
      : new CylinderGeometry(options.geometryOptions);
  } else if (vectorPropertiesOfType(options, PrimitiveOptionsType.ELLIPSOID)) {
    if (Array.isArray(options.geometryOptions?.radii)) {
      options.geometryOptions!.radii = Cartesian3.fromArray(
        options.geometryOptions!.radii,
      );
    }
    if (Array.isArray(options.geometryOptions?.innerRadii)) {
      options.geometryOptions!.innerRadii = Cartesian3.fromArray(
        options.geometryOptions!.innerRadii,
      );
    }
    geometry = outline
      ? new EllipsoidOutlineGeometry(options.geometryOptions)
      : new EllipsoidGeometry(options.geometryOptions);
  }
  if (vectorPropertiesOfType(options, PrimitiveOptionsType.SPHERE)) {
    geometry = outline
      ? new SphereOutlineGeometry(options.geometryOptions)
      : new SphereGeometry(options.geometryOptions);
  }
  if (vectorPropertiesOfType(options, PrimitiveOptionsType.BOX)) {
    if (Array.isArray(options.geometryOptions.minimum)) {
      options.geometryOptions.minimum = Cartesian3.fromArray(
        options.geometryOptions.minimum,
      );
    }
    if (Array.isArray(options.geometryOptions.maximum)) {
      options.geometryOptions.maximum = Cartesian3.fromArray(
        options.geometryOptions.maximum,
      );
    }
    geometry = outline
      ? new BoxOutlineGeometry(options.geometryOptions)
      : new BoxGeometry(options.geometryOptions);
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

export async function getPrimitiveOptions(
  feature: Feature,
  style: Style,
  wgs84Positions: Coordinate[],
  positions: Cartesian3[],
  vectorProperties: VectorProperties,
  scene: Scene,
): Promise<null | {
  primitives: Primitive[];
  options: VectorPropertiesPrimitive;
}> {
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
  } else if (imageStyle) {
    // XXX or should we only allow primitives with regular shapes defined as image?
    fill = style.getFill();
    stroke = style.getStroke(); // XXX this makes it impossible to create an extruded un-stroked primitive with an icon in 2D or we add a new primitive option
  }

  if (!fill && !stroke) {
    return null;
  }
  let fillColor: Color | undefined;
  if (fill) {
    fillColor = getCesiumColor(fill.getColor(), [255, 255, 255, 0.4]);
  }
  let strokeColor: Color | undefined;
  if (stroke) {
    strokeColor = getCesiumColor(stroke.getColor(), [255, 255, 255, 0.4]);
  }

  const scale = Cartesian3.fromArray(options.scale);
  const headingPitchRoll = HeadingPitchRoll.fromDegrees(
    options.heading,
    options.pitch,
    options.roll,
  );
  const allowPicking = vectorProperties.getAllowPicking(feature);
  const heightReference = vectorProperties.getAltitudeMode(feature);

  const primitives = await Promise.all(
    positions.map(async (position, index) => {
      const geometryModelMatrix = Matrix4.fromScale(scale);
      let offset: Cartesian3 | undefined;
      if (options.primitiveOptions.offset?.length === 3) {
        offset = Cartesian3.fromArray(options.primitiveOptions.offset);
        Matrix4.setTranslation(
          geometryModelMatrix,
          Cartesian3.multiplyComponents(offset, scale, new Cartesian3()),
          geometryModelMatrix,
        );
      }
      const transform = Transforms.headingPitchRollToFixedFrame(
        position,
        headingPitchRoll,
      );
      const modelMatrix = Matrix4.multiply(
        transform,
        geometryModelMatrix,
        new Matrix4(),
      );

      let depthFail;
      if (options.primitiveOptions.depthFailColor) {
        const depthFailColor = getCesiumColor(
          options.primitiveOptions.depthFailColor,
          [255, 255, 255, 0.4],
        );
        depthFail = new MaterialAppearance({
          translucent: depthFailColor.alpha < 1,
          material: Material.fromType('Color', {
            color: depthFailColor,
          }),
        });
      }

      const createPrimitive = async (
        translucent: boolean,
        geometryInstances: (GeometryInstance | null)[],
        depthFailAppearance?: MaterialAppearance,
      ): Promise<Primitive> => {
        const primitive = new Primitive({
          asynchronous: !feature[createSync],
          geometryInstances: geometryInstances.filter(
            (g) => g,
          ) as GeometryInstance[],
          modelMatrix,
          appearance: new PerInstanceColorAppearance({
            translucent,
            flat: true,
          }),
          depthFailAppearance,
          allowPicking,
          ...options.primitiveOptions.additionalOptions,
        });

        if (
          wgs84Positions[index][2] == null ||
          heightReference === HeightReference.CLAMP_TO_GROUND
        ) {
          await placePrimitiveOnTerrain(primitive, position, scene, offset);
          Transforms.headingPitchRollToFixedFrame(
            position,
            headingPitchRoll,
            undefined,
            undefined,
            transform,
          ); // update transform for usage in offset auto scale
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
            fillColor.alpha < 1 || !!depthFail,
            [
              getGeometryInstanceFromOptions(
                options.primitiveOptions,
                fillColor,
              ),
            ],
            depthFail,
          ),
        );
      } else if (depthFail) {
        const transparent = Color.TRANSPARENT;
        fillAndOutline.push(
          createPrimitive(
            true,
            [
              getGeometryInstanceFromOptions(
                options.primitiveOptions,
                transparent,
              ),
            ],
            depthFail,
          ),
        );
      }
      if (strokeColor) {
        fillAndOutline.push(
          createPrimitive(strokeColor.alpha < 1 || !!depthFail, [
            getGeometryInstanceFromOptions(
              options.primitiveOptions,
              strokeColor,
              true,
            ),
          ]),
        );
      }
      return Promise.all(fillAndOutline);
    }),
  );

  return {
    primitives: primitives.flatMap((p) => p),
    options,
  };
}
