import {
  Cartesian3,
  Color,
  HeightReference,
  VerticalOrigin,
  Cartesian2,
  LabelStyle,
  HorizontalOrigin,
  type BillboardGraphics,
  type LabelGraphics,
  type PolylineGeometry,
  type Scene,
} from '@vcmap-cesium/engine';
import { Icon, type Style } from 'ol/style.js';
import type { Coordinate } from 'ol/coordinate.js';
import ImageState from 'ol/ImageState.js';
import type { Feature } from 'ol/index.js';
import type { Point } from 'ol/geom.js';

import { parseNumber } from '@vcsuite/parsers';
import {
  createLinePrimitive,
  getHeightInfo,
} from './featureconverterHelper.js';
import Projection from '../projection.js';
import { createLineGeometries } from './lineStringToCesium.js';
import { getCesiumColor } from '../../style/styleHelpers.js';
import { getModelOptions, getPrimitiveOptions } from './pointHelpers.js';
import VectorProperties from '../../layer/vectorProperties.js';
import type { VectorHeightInfo } from '../../layer/vectorLayer.js';
import { AsyncCesiumVectorContext } from '../../layer/cesium/vectorContext.js';

export function getCoordinates(geometries: Point[]): Coordinate[] {
  return geometries.map((point) => {
    return point.getCoordinates();
  });
}

export type BillboardOptions = BillboardGraphics.ConstructorOptions;

export function getBillboardOptions(
  feature: Feature,
  style: Style,
  heightReference: HeightReference,
  vectorProperties: VectorProperties,
): BillboardOptions | null {
  const imageStyle = style.getImage();
  if (imageStyle) {
    // ImageStyles should always have an opacity value between 0 and 1, default white Color
    const color = new Color(1.0, 1.0, 1.0, imageStyle.getOpacity());

    let image = null;
    if (imageStyle instanceof Icon) {
      imageStyle.load();
      if (imageStyle.getImageState() === ImageState.LOADING) {
        image = new Promise((resolve, reject) => {
          const imageChangeListener = (): void => {
            if (
              imageStyle.getImageState() === ImageState.LOADED ||
              imageStyle.getImageState() === ImageState.EMPTY
            ) {
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
    const options: BillboardOptions = {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      image,
      color,
      scale: imageStyle.getScaleArray()[0],
      heightReference,
      verticalOrigin: VerticalOrigin.BOTTOM,
      id: feature.getId(),
    };

    options.eyeOffset = vectorProperties.getEyeOffset(feature);
    options.scaleByDistance = vectorProperties.getScaleByDistance(feature);
    if (heightReference === HeightReference.CLAMP_TO_GROUND) {
      options.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    }

    return options;
  }
  return null;
}

export type LabelOptions = LabelGraphics.ConstructorOptions;
/**
 * extracts cesium label options from a feature and style
 * @param  feature
 * @param  style style.getText().getFill() is set by default to be #333,
 * if no fill is required set Fill empty by using style.getText().setFill()
 * @param  heightReference
 * @param  vectorProperties
 */
export function getLabelOptions(
  feature: Feature,
  style: Style,
  heightReference: HeightReference,
  vectorProperties: VectorProperties,
): LabelOptions | null {
  const textStyle = style.getText();
  const text = textStyle ? textStyle.getText() : null;
  if (text) {
    const options: LabelOptions = {};

    options.text = text as string;

    options.heightReference = heightReference;

    const offsetX = textStyle.getOffsetX() ?? 0;
    const offsetY = textStyle.getOffsetY() ?? 0;
    options.pixelOffset = new Cartesian2(offsetX, offsetY);
    options.scale = textStyle.getScaleArray()[0];

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

    if (heightReference === HeightReference.CLAMP_TO_GROUND) {
      options.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    }
    return options;
  }
  return null;
}

/**
 * validates if a point is renderable
 */
export function validatePoint(point: Point): boolean {
  if (point.getType() !== 'Point') {
    return false;
  }
  const flatCoordinates = point.getFlatCoordinates();
  if (flatCoordinates && flatCoordinates.length >= 2) {
    return flatCoordinates.every((value) => Number.isFinite(value));
  }
  return false;
}

/**
 * returns positions (cartesian3) and WGS84 coordinates
 * @param  coordinates
 * @param  heightInfo
 */
export function getCartesian3AndWGS84FromCoordinates(
  coordinates: Coordinate[],
  heightInfo: VectorHeightInfo,
): { positions: Cartesian3[]; wgs84Positions: Coordinate[] } {
  const wgs84Positions = new Array(coordinates.length);
  const positions = new Array(coordinates.length);
  const heightValue =
    heightInfo.groundLevel +
    heightInfo.storeyHeightsAboveGround.reduce(
      (sum, currentValue) => sum + currentValue,
      0,
    );
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

export function getLineGeometries(
  wgs84Positions: Coordinate[],
  heightInfo: VectorHeightInfo,
  positions: Cartesian3[],
  style: Style,
): PolylineGeometry[] {
  const lineGeometries = [];
  const heightValueCorrection =
    heightInfo.skirt +
    heightInfo.storeyHeightsBelowGround.reduce(
      (sum, currentValue) => sum + currentValue,
      0,
    );
  for (let i = 0; i < wgs84Positions.length; i++) {
    const pointPosition = wgs84Positions[i];
    let heightValue =
      pointPosition[2] != null ? pointPosition[2] : heightInfo.groundLevel;
    heightValue -= heightValueCorrection;
    const secondPoint = Cartesian3.fromDegrees(
      pointPosition[0],
      pointPosition[1],
      heightValue,
    );
    const linePositions = [positions[i], secondPoint];
    lineGeometries.push(
      ...createLineGeometries({ positions: linePositions }, style),
    );
  }
  return lineGeometries;
}

export default async function pointToCesium(
  feature: Feature,
  style: Style,
  geometries: Point[],
  vectorProperties: VectorProperties,
  scene: Scene,
  context: AsyncCesiumVectorContext,
): Promise<void> {
  if (!style.getImage() && !(style.getText() && style.getText().getText())) {
    return;
  }
  const validGeometries = geometries.filter((point) => validatePoint(point));

  // no geometries, so early escape
  if (!validGeometries.length) {
    return;
  }

  const coordinates = getCoordinates(validGeometries);
  const heightInfo = getHeightInfo(feature, vectorProperties, coordinates);
  let { heightReference } = heightInfo;
  const allowPicking = vectorProperties.getAllowPicking(feature);

  const { positions, wgs84Positions } = getCartesian3AndWGS84FromCoordinates(
    coordinates,
    heightInfo,
  );

  let modelOrPrimitiveOptions = null;
  if (feature.get('olcs_modelUrl')) {
    modelOrPrimitiveOptions = await getModelOptions(
      feature,
      wgs84Positions,
      positions,
      vectorProperties,
      scene,
    );
  } else if (feature.get('olcs_primitiveOptions')) {
    modelOrPrimitiveOptions = await getPrimitiveOptions(
      feature,
      style,
      wgs84Positions,
      positions,
      vectorProperties,
      scene,
    );
  } else {
    modelOrPrimitiveOptions =
      (await getModelOptions(
        feature,
        wgs84Positions,
        positions,
        vectorProperties,
        scene,
      )) ??
      (await getPrimitiveOptions(
        feature,
        style,
        wgs84Positions,
        positions,
        vectorProperties,
        scene,
      ));
  }

  if (heightInfo.extruded && style.getStroke()) {
    const lineGeometries = getLineGeometries(
      wgs84Positions,
      heightInfo,
      positions,
      style,
    );
    if (lineGeometries.length) {
      heightReference = HeightReference.NONE;
      const linePrimitive = createLinePrimitive(
        scene,
        vectorProperties,
        allowPicking,
        feature,
        lineGeometries,
        style,
        false,
      );
      if (linePrimitive) {
        context.addPrimitives([linePrimitive], feature, allowPicking);
      }
    }
  }
  if (modelOrPrimitiveOptions) {
    if (modelOrPrimitiveOptions.options.autoScale) {
      context.addScaledPrimitives(
        modelOrPrimitiveOptions.primitives,
        feature,
        allowPicking,
      );
    } else {
      context.addPrimitives(
        modelOrPrimitiveOptions.primitives,
        feature,
        allowPicking,
      );
    }
  } else {
    const bbOptions = getBillboardOptions(
      feature,
      style,
      heightReference,
      vectorProperties,
    );
    if (bbOptions) {
      const bbOptionsperPosition = positions.map((position) => {
        return { ...bbOptions, position };
      });
      context.addBillboards(bbOptionsperPosition, feature, allowPicking);
    }

    const labelOptions = getLabelOptions(
      feature,
      style,
      heightReference,
      vectorProperties,
    );
    if (labelOptions) {
      const labelOptionsPerPosition = positions.map((position) => {
        return { ...labelOptions, position };
      });
      context.addLabels(labelOptionsPerPosition, feature, allowPicking);
    }
  }
}
