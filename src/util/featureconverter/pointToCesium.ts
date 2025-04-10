import type {
  Billboard,
  HeightReference,
  Label,
  Scene,
} from '@vcmap-cesium/engine';
import {
  Cartesian2,
  Cartesian3,
  Color,
  HorizontalOrigin,
  LabelStyle,
  VerticalOrigin,
} from '@vcmap-cesium/engine';
import { Icon, type Style } from 'ol/style.js';
import type { Coordinate } from 'ol/coordinate.js';
import ImageState from 'ol/ImageState.js';
import type { Feature } from 'ol/index.js';
import type { Point } from 'ol/geom.js';

import { parseNumber } from '@vcsuite/parsers';
import { createLineGeometries } from './lineStringToCesium.js';
import { getCesiumColor } from '../../style/styleHelpers.js';
import { getModelOrPointPrimitiveOptions } from './pointHelpers.js';
import type VectorProperties from '../../layer/vectorProperties.js';
import type { ColorType } from '../../style/vectorStyleItem.js';
import type { ConvertedItem } from './convert.js';
import type {
  RelativeHeightReference,
  VectorHeightInfo,
} from './vectorHeightInfo.js';
import {
  getWgs84CoordinatesForPoint,
  isClampedHeightReference,
} from './vectorHeightInfo.js';
import type { CesiumGeometryOption } from './vectorGeometryFactory.js';

export type BillboardOptions = Billboard.ConstructorOptions;

export function getBillboardOptions(
  feature: Feature,
  style: Style,
  heightReference: HeightReference,
  vectorProperties: VectorProperties,
): Partial<BillboardOptions> | null {
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
              reject(new Error('Image could not be loaded'));
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
    const options: Partial<BillboardOptions> = {
      color,
      scale: imageStyle.getScaleArray()[0],
      heightReference,
      verticalOrigin: VerticalOrigin.BOTTOM,
      id: feature.getId(),
    };

    // @ts-expect-error: cesium types are wrong here
    options.image = image;

    options.eyeOffset = vectorProperties.getEyeOffset(feature);
    options.scaleByDistance = vectorProperties.getScaleByDistance(feature);
    if (isClampedHeightReference(heightReference)) {
      options.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    }

    return options;
  }
  return null;
}

export type LabelOptions = Label.ConstructorOptions;
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
): Partial<LabelOptions> | null {
  const textStyle = style.getText();
  const text = textStyle ? textStyle.getText() : null;
  if (text && textStyle) {
    const options: Partial<LabelOptions> = {};

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
      options.fillColor = getCesiumColor(
        fill.getColor() as ColorType, // XXX PatternDescriptor
        [0, 0, 0, 1],
      );
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

    if (isClampedHeightReference(heightReference)) {
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

export function getLineGeometries(
  heightInfo: VectorHeightInfo<RelativeHeightReference | HeightReference.NONE>,
  position: Cartesian3,
  wgs84Coords: Coordinate,
  style: Style,
): CesiumGeometryOption<'line'>[] {
  const heightValueCorrection =
    heightInfo.skirt +
    heightInfo.storeyHeightsBelowGround.reduce(
      (sum, currentValue) => sum + currentValue,
      0,
    ) +
    heightInfo.storeyHeightsAboveGround.reduce(
      (sum, currentValue) => sum + currentValue,
      0,
    );

  const secondPoint = Cartesian3.fromDegrees(
    wgs84Coords[0],
    wgs84Coords[1],
    wgs84Coords[2] - heightValueCorrection,
  );
  const linePositions = [position, secondPoint];
  return createLineGeometries({ positions: linePositions }, heightInfo, style);
}

export async function getPointPrimitives(
  feature: Feature,
  geometry: Point,
  style: Style,
  vectorProperties: VectorProperties,
  scene: Scene,
  heightInfo: VectorHeightInfo,
): Promise<(CesiumGeometryOption | ConvertedItem)[]> {
  const wgs84Coords = getWgs84CoordinatesForPoint(geometry, heightInfo);
  const position = Cartesian3.fromDegrees(
    wgs84Coords[0],
    wgs84Coords[1],
    wgs84Coords[2],
  );
  const pointPrimitives: (CesiumGeometryOption | ConvertedItem)[] =
    await getModelOrPointPrimitiveOptions(
      feature,
      style,
      position,
      wgs84Coords,
      vectorProperties,
      heightInfo,
      scene,
    );

  if (pointPrimitives.length === 0) {
    const bbOptions = getBillboardOptions(
      feature,
      style,
      heightInfo.heightReference,
      vectorProperties,
    );
    if (bbOptions) {
      pointPrimitives.push({
        type: 'billboard',
        item: { ...bbOptions, position },
      });
    }

    const labelOptions = getLabelOptions(
      feature,
      style,
      heightInfo.heightReference,
      vectorProperties,
    );
    if (labelOptions) {
      pointPrimitives.push({
        type: 'label',
        item: { ...labelOptions, position },
      });
    }
  }

  if (
    !isClampedHeightReference(heightInfo.heightReference) &&
    (
      heightInfo as VectorHeightInfo<
        RelativeHeightReference | HeightReference.NONE
      >
    ).extruded &&
    style.getStroke()
  ) {
    pointPrimitives.push(
      ...getLineGeometries(
        heightInfo as VectorHeightInfo<
          RelativeHeightReference | HeightReference.NONE
        >,
        position,
        wgs84Coords,
        style,
      ),
    );
  }

  return pointPrimitives;
}
