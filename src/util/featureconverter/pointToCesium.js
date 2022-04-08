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
} from '@vcmap/cesium';
import Icon from 'ol/style/Icon.js';
import GeometryType from 'ol/geom/GeometryType.js';
import ImageState from 'ol/ImageState.js';
import { parseNumber } from '@vcsuite/parsers';
import {
  createLinePrimitive,
  getHeightInfo,
} from './featureconverterHelper.js';
import Projection from '../projection.js';
import { createLineGeometries } from './lineStringToCesium.js';
import { getCesiumColor } from '../../style/styleHelpers.js';

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

    const offsetX = textStyle.getOffsetX() || 0;
    const offsetY = textStyle.getOffsetY() || 0;
    options.pixelOffset = new Cartesian2(offsetX, offsetY);

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
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {Array<import("ol/coordinate").Coordinate>} wgs84Positions
 * @param {Array<import("@vcmap/cesium").Cartesian3>} positions
 * @param {import("@vcmap/core").VectorProperties} vectorProperties
 * @param {import("@vcmap/cesium").Scene} scene
 * @returns {null|Array<import("@vcmap/cesium").Model>}
 */
export function getModelOptions(feature, wgs84Positions, positions, vectorProperties, scene) {
  const modelOptions = vectorProperties.getModel(feature);
  if (modelOptions) {
    const scale = Cartesian3.fromArray(modelOptions.scale);
    const headingPitchRoll = HeadingPitchRoll.fromDegrees(modelOptions.heading, modelOptions.pitch, modelOptions.roll);
    return positions.map((position, index) => {
      const modelMatrix = Matrix4.multiply(
        Transforms.headingPitchRollToFixedFrame(position, headingPitchRoll),
        Matrix4.fromScale(scale),
        new Matrix4(),
      );

      const additionalModelOptions = vectorProperties.getModelOptions(feature);
      const model = Model.fromGltf({
        url: modelOptions.url,
        modelMatrix,
        ...additionalModelOptions,
      });

      if (!wgs84Positions[index][2]) {
        sampleTerrainMostDetailed(
          /** @type {import("@vcmap/cesium").CesiumTerrainProvider} */ (scene.globe.terrainProvider),
          [Cartographic.fromCartesian(position)],
        )
          .then(([cartoWithNewHeight]) => {
            if (!model.isDestroyed()) {
              model.modelMatrix = Matrix4.multiply(
                Transforms.headingPitchRollToFixedFrame(Cartographic.toCartesian(cartoWithNewHeight), headingPitchRoll),
                Matrix4.fromScale(scale),
                new Matrix4(),
              );
            }
          })
          .catch(() => {});
      }

      model.readyPromise.then(() => {
        model.activeAnimations.addAll({
          loop: ModelAnimationLoop.REPEAT,
        });
      });
      return model;
    });
  }
  return null;
}

/**
 * validates if a point is renderable
 * @param {import("ol/geom/Point").default} point
 * @returns {boolean}
 */
export function validatePoint(point) {
  if (point.getType() !== GeometryType.POINT) {
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

  const modelOptions = getModelOptions(feature, wgs84Positions, positions, vectorProperties, scene);
  if (modelOptions) {
    context.addPrimitives(modelOptions, feature, allowPicking);
  } else {
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
