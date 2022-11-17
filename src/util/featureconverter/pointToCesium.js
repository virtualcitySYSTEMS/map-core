import {
  Cartesian3,
  Color,
  HeightReference,
  VerticalOrigin,
  Cartesian2,
  Transforms,
  Matrix4,
  Model,
  HeadingPitchRoll,
  LabelStyle,
  ModelAnimationLoop,
  Cartographic,
  HorizontalOrigin,
  sampleTerrainMostDetailed,
  Primitive,
  GeometryInstance,
  CylinderGeometry,
  Material,
  MaterialAppearance,
  SphereGeometry,
  BoxGeometry,
  EllipsoidGeometry,
  EllipseGeometry,
  CylinderOutlineGeometry,
  EllipsoidOutlineGeometry,
  SphereOutlineGeometry,
  BoxOutlineGeometry,
  EllipseOutlineGeometry,
  ColorGeometryInstanceAttribute,
  PerInstanceColorAppearance,
} from '@vcmap/cesium';
import { RegularShape, Icon } from 'ol/style.js';
import ImageState from 'ol/ImageState.js';
import { parseNumber } from '@vcsuite/parsers';
import {
  createLinePrimitive,
  getHeightInfo,
} from './featureconverterHelper.js';
import Projection from '../projection.js';
import { createLineGeometries } from './lineStringToCesium.js';
import { getCesiumColor } from '../../style/styleHelpers.js';
import { PrimitiveOptionsType } from '../../layer/vectorProperties.js';
import { createSync } from '../../layer/vectorSymbols.js';

/**
 * @param {Array<import("ol/geom/Point").default>} geometries
 * @returns {Array<import("ol/coordinate").Coordinate>}
 * @private
 */
export function getCoordinates(geometries) {
  return geometries.map((point) => {
    return point.getCoordinates();
  });
}

/**
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {import("ol/style/Style").default} style
 * @param {import("@vcmap/cesium").HeightReference} heightReference
 * @param {import("@vcmap/core").VectorProperties} vectorProperties
 * @returns {Object|null}
 */
export function getBillboardOptions(feature, style, heightReference, vectorProperties) {
  const imageStyle = style.getImage();
  if (imageStyle) {
    // ImageStyles should always have an opacity value between 0 and 1, default white Color
    const color = new Color(1.0, 1.0, 1.0, imageStyle.getOpacity());

    let image = null;
    if (imageStyle instanceof Icon) {
      imageStyle.load();
      if (imageStyle.getImageState() === ImageState.LOADING) {
        image = new Promise((resolve, reject) => {
          const imageChangeListener = () => {
            if (imageStyle.getImageState() === ImageState.LOADED || imageStyle.getImageState() === ImageState.EMPTY) {
              resolve(imageStyle.getImage(1));
              imageStyle.unlistenImageChange(imageChangeListener);
            } else if (imageStyle.getImageState() === ImageState.ERROR) {
              reject();
              imageStyle.unlistenImageChange(imageChangeListener);
            }
          };
          imageStyle.listenImageChange(imageChangeListener);
        });
      }
    }
    if (!image) {
      image = imageStyle.getImage(1);
    }
    const options = {
      image,
      color,
      scale: imageStyle.getScale(),
      heightReference,
      verticalOrigin: VerticalOrigin.BOTTOM,
      id: feature.getId(),
    };

    options.eyeOffset = vectorProperties.getEyeOffset(feature);
    options.scaleByDistance = vectorProperties.getScaleByDistance(feature);

    return options;
  }
  return null;
}

/**
 * extracts cesium label options from a feature and style
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {import("ol/style/Style").default} style style.getText().getFill() is set by default to be #333,
 * if no fill is required set Fill empty by using style.getText().setFill()
 * @param {import("@vcmap/cesium").HeightReference} heightReference
 * @param {import("@vcmap/core").VectorProperties} vectorProperties
 * @returns {Object|null}
 */
export function getLabelOptions(feature, style, heightReference, vectorProperties) {
  const textStyle = style.getText();
  const text = textStyle ? textStyle.getText() : null;
  if (text) {
    const options = {};

    options.text = text;

    options.heightReference = heightReference;

    const offsetX = textStyle.getOffsetX() ?? 0;
    const offsetY = textStyle.getOffsetY() ?? 0;
    options.pixelOffset = new Cartesian2(offsetX, offsetY);
    const scale = textStyle.getScale();
    if (scale) {
      options.scale = Array.isArray(scale) ? scale[0] : scale;
    }

    const font = textStyle.getFont();
    if (font) {
      options.font = font;
    }

    const fill = textStyle.getFill();
    const stroke = textStyle.getStroke();

    let labelStyle;
    if (fill) {
      options.fillColor = getCesiumColor(fill.getColor(), [0, 0, 0, 1]);
      labelStyle = LabelStyle.FILL;
    }
    if (stroke) {
      options.outlineWidth = parseNumber(stroke.getWidth(), 1.0);
      options.outlineColor = getCesiumColor(stroke.getColor(), [0, 0, 0, 1]);
      labelStyle = LabelStyle.OUTLINE;
    }
    if (fill && stroke) {
      labelStyle = LabelStyle.FILL_AND_OUTLINE;
    }
    options.style = labelStyle;

    let horizontalOrigin;
    switch (textStyle.getTextAlign()) {
      case 'left':
        horizontalOrigin = HorizontalOrigin.LEFT;
        break;
      case 'right':
        horizontalOrigin = HorizontalOrigin.RIGHT;
        break;
      case 'center':
      default:
        horizontalOrigin = HorizontalOrigin.CENTER;
    }
    options.horizontalOrigin = horizontalOrigin;

    let verticalOrigin;
    switch (textStyle.getTextBaseline()) {
      case 'top':
        verticalOrigin = VerticalOrigin.TOP;
        break;
      case 'middle':
        verticalOrigin = VerticalOrigin.CENTER;
        break;
      case 'bottom':
        verticalOrigin = VerticalOrigin.BOTTOM;
        break;
      case 'alphabetic':
        verticalOrigin = VerticalOrigin.TOP;
        break;
      case 'hanging':
        verticalOrigin = VerticalOrigin.BOTTOM;
        break;
      default:
        verticalOrigin = VerticalOrigin.BASELINE;
    }
    options.verticalOrigin = verticalOrigin;
    options.eyeOffset = vectorProperties.getEyeOffset(feature);
    options.scaleByDistance = vectorProperties.getScaleByDistance(feature);
    return options;
  }
  return null;
}

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
    geometry = outline ?
      new BoxOutlineGeometry(options.geometryOptions) :
      new BoxGeometry(options.geometryOptions);
  }
  if (type === PrimitiveOptionsType.ELLIPSE) {
    geometry = outline ?
      new EllipseOutlineGeometry(options.geometryOptions) :
      new EllipseGeometry(options.geometryOptions);
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
        createPrimitive(true, [getGeometryInstanceFromOptions(options.primitiveOptions, transparent)], deptFail),
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

/**
 * validates if a point is renderable
 * @param {import("ol/geom/Point").default} point
 * @returns {boolean}
 */
export function validatePoint(point) {
  if (point.getType() !== 'Point') {
    return false;
  }
  const flatCoordinates = point.getFlatCoordinates();
  if (flatCoordinates && flatCoordinates.length >= 2) {
    return flatCoordinates.every(value => Number.isFinite(value));
  }
  return false;
}

/**
 * returns positions (cartesian3) and WGS84 coordinates
 * @param {Array<import("ol/coordinate").Coordinate>} coordinates
 * @param {VectorHeightInfo} heightInfo
 * @returns {{positions:Array<import("@vcmap/cesium").Cartesian3>, wgs84Positions:Array<import("ol/coordinate").Coordinate>}}
 */
export function getCartesian3AndWGS84FromCoordinates(coordinates, heightInfo) {
  const wgs84Positions = new Array(coordinates.length);
  const positions = new Array(coordinates.length);
  const heightValue = heightInfo.groundLevel +
    heightInfo.storeyHeightsAboveGround.reduce((sum, currentValue) => sum + currentValue, 0);
  coordinates.forEach((coord, index) => {
    wgs84Positions[index] = Projection.mercatorToWgs84(coord, true);
    let height = null;
    if (heightInfo.heightReference === HeightReference.RELATIVE_TO_GROUND) {
      height = heightInfo.heightAboveGroundAdjustment;
    } else {
      height = heightValue;
    }
    positions[index] = Cartesian3.fromDegrees(coord[0], coord[1], height);
  });
  return {
    positions,
    wgs84Positions,
  };
}

/**
 * @param {Array<import("ol/coordinate").Coordinate>} wgs84Positions
 * @param {VectorHeightInfo} heightInfo
 * @param {Array<import("@vcmap/cesium").Cartesian3>} positions
 * @param {import("ol/style/Style").default} style
 * @returns {Array<import("@vcmap/cesium").PolylineGeometry>}
 * @private
 */
export function getLineGeometries(wgs84Positions, heightInfo, positions, style) {
  const lineGeometries = [];
  const heightValueCorrection = heightInfo.skirt +
    heightInfo.storeyHeightsBelowGround.reduce((sum, currentValue) => sum + currentValue, 0);
  for (let i = 0; i < wgs84Positions.length; i++) {
    const pointPosition = wgs84Positions[i];
    let heightValue = pointPosition[2] != null ? pointPosition[2] : heightInfo.groundLevel;
    heightValue -= heightValueCorrection;
    const secondPoint = Cartesian3.fromDegrees(pointPosition[0], pointPosition[1], heightValue);
    const linePositions = [positions[i], secondPoint];
    lineGeometries.push(...createLineGeometries({ positions: linePositions }, style));
  }
  return lineGeometries;
}

/**
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {import("ol/style/Style").default} style
 * @param {Array<import("ol/geom/Point").default>} geometries
 * @param {import("@vcmap/core").VectorProperties} vectorProperties
 * @param {import("@vcmap/cesium").Scene} scene
 * @param {import("@vcmap/core").VectorContext|import("@vcmap/core").ClusterContext} context
 */
export default function pointToCesium(feature, style, geometries, vectorProperties, scene, context) {
  if (!style.getImage() && !(style.getText() && style.getText().getText())) {
    return;
  }
  const validGeometries = geometries.filter(point => validatePoint(point));

  // no geometries, so early escape
  if (!validGeometries.length) {
    return;
  }

  const coordinates = getCoordinates(validGeometries);
  const heightInfo = getHeightInfo(feature, vectorProperties, coordinates);
  let { heightReference } = heightInfo;
  const allowPicking = vectorProperties.getAllowPicking(feature);

  const { positions, wgs84Positions } = getCartesian3AndWGS84FromCoordinates(coordinates, heightInfo);

  let modelOrPrimitiveOptions = null;
  if (feature.get('olcs_modelUrl')) {
    modelOrPrimitiveOptions = getModelOptions(feature, wgs84Positions, positions, vectorProperties, scene);
  } else if (feature.get('olcs_primitiveOptions')) {
    modelOrPrimitiveOptions = getPrimitiveOptions(feature, style, wgs84Positions, positions, vectorProperties, scene);
  } else {
    modelOrPrimitiveOptions = getModelOptions(feature, wgs84Positions, positions, vectorProperties, scene) ??
      getPrimitiveOptions(feature, style, wgs84Positions, positions, vectorProperties, scene);
  }

  if (heightInfo.extruded && style.getStroke()) {
    const lineGeometries = getLineGeometries(wgs84Positions, heightInfo, positions, style);
    if (lineGeometries.length) {
      heightReference = HeightReference.NONE;
      const linePrimitive =
        createLinePrimitive(scene, vectorProperties, allowPicking, feature, lineGeometries, style, false);
      if (linePrimitive) {
        context.addPrimitives([linePrimitive], feature, allowPicking);
      }
    }
  }
  if (modelOrPrimitiveOptions) {
    if (modelOrPrimitiveOptions.options.autoScale) {
      context.addScaledPrimitives(modelOrPrimitiveOptions.primitives, feature, allowPicking);
    } else {
      context.addPrimitives(modelOrPrimitiveOptions.primitives, feature, allowPicking);
    }
  } else {
    const bbOptions = getBillboardOptions(feature, style, heightReference, vectorProperties);
    if (bbOptions) {
      const bbOptionsperPosition = positions.map((position) => {
        return { ...bbOptions, position };
      });
      context.addBillboards(bbOptionsperPosition, feature, allowPicking);
    }

    const labelOptions = getLabelOptions(feature, style, heightReference, vectorProperties);
    if (labelOptions) {
      const labelOptionsPerPosition = positions.map((position) => {
        return { ...labelOptions, position };
      });
      context.addLabels(labelOptionsPerPosition, feature, allowPicking);
    }
  }
}
