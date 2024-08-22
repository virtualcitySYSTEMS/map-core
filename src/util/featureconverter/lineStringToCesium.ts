import {
  WallGeometry,
  WallOutlineGeometry,
  GroundPolylineGeometry,
  PolylineGeometry,
  Math as CesiumMath,
  HeightReference,
  type Scene,
  Cartesian3,
} from '@vcmap-cesium/engine';
import { Feature } from 'ol';
import { type LineString, Point } from 'ol/geom.js';
import type { Coordinate } from 'ol/coordinate.js';
import type { Style } from 'ol/style.js';

import { parseNumber } from '@vcsuite/parsers';
import ArrowStyle, { ArrowEnd } from '../../style/arrowStyle.js';
import { getCartesianBearing, getCartesianPitch } from '../math.js';
import { getPrimitiveOptions } from './pointHelpers.js';
import type VectorProperties from '../../layer/vectorProperties.js';
import { getWgs84CoordinatesForPoint } from './pointToCesium.js';
import { ConvertedItem } from './convert.js';
import {
  getHeightInfo,
  VectorHeightInfo,
  mercatorToCartesianTransformerForHeightInfo,
  isAbsoluteHeightReference,
} from './vectorHeightInfo.js';
import {
  CesiumGeometryOption,
  PolylineGeometryOptions,
  VectorGeometryFactory,
} from './vectorGeometryFactory.js';

type ArrowOptions = {
  location: Coordinate;
  heading: number;
  pitch: number;
};

function getArrowOptions(
  from: Coordinate,
  to: Coordinate,
  heightReference: HeightReference,
): ArrowOptions {
  let pitch = isAbsoluteHeightReference(heightReference)
    ? getCartesianPitch(to, from)
    : 0;
  pitch += 90;
  return {
    location: to,
    pitch,
    heading: CesiumMath.toDegrees(
      getCartesianBearing(from, to) + CesiumMath.PI_OVER_TWO,
    ),
  };
}

export function getArrowHeadPrimitives(
  feature: Feature,
  style: ArrowStyle,
  geometry: LineString,
  vectorProperties: VectorProperties,
  scene: Scene,
  inputCoordinates?: Coordinate[],
): ConvertedItem<'primitive'>[] {
  if (style.end === ArrowEnd.NONE || !style.primitiveOptions?.geometryOptions) {
    return [];
  }
  const arrowOptions: ArrowOptions[] = [];
  const heightReference = vectorProperties.getAltitudeMode(feature);
  const coordinates = inputCoordinates ?? geometry.getCoordinates();
  if (style.end === ArrowEnd.START || style.end === ArrowEnd.BOTH) {
    arrowOptions.push(
      getArrowOptions(coordinates[1], coordinates[0], heightReference),
    );
  }

  if (style.end === ArrowEnd.END || style.end === ArrowEnd.BOTH) {
    arrowOptions.push(
      getArrowOptions(
        coordinates.at(-2)!,
        coordinates.at(-1)!,
        heightReference,
      ),
    );
  }

  if (arrowOptions.length === 0) {
    return [];
  }

  const usedStyle = style.getOlcsStyle();

  return arrowOptions
    .map((arrowOption): ConvertedItem<'primitive'>[] => {
      const arrowHeadGeometry = new Point(arrowOption.location);
      const arrowFeature = new Feature({
        ...feature.getProperties(),
        olcs_primitiveOptions: style.primitiveOptions,
        olcs_modelHeading: arrowOption.heading,
        olcs_modelPitch: arrowOption.pitch,
        geometry: arrowHeadGeometry,
        olcs_modelAutoScale: true,
      });

      const heightInfo = getHeightInfo(
        arrowFeature,
        arrowHeadGeometry,
        vectorProperties,
      );

      const wgs84Coords = getWgs84CoordinatesForPoint(
        arrowHeadGeometry,
        heightInfo,
      );
      const position = Cartesian3.fromDegrees(
        wgs84Coords[0],
        wgs84Coords[1],
        wgs84Coords[2],
      );

      return getPrimitiveOptions(
        arrowFeature,
        usedStyle,
        position,
        wgs84Coords,
        vectorProperties,
        scene,
        heightInfo,
      );
    })
    .flat();
}

export function createSolidGeometries(
  options: PolylineGeometryOptions,
  heightInfo: VectorHeightInfo,
  height: number,
  perPositionHeight: boolean,
  extrudedHeight?: number,
): CesiumGeometryOption<'solid'>[] {
  return [
    {
      type: 'solid',
      geometry: WallGeometry.fromConstantHeights({
        ...options,
        maximumHeight: !perPositionHeight ? height : undefined,
        minimumHeight: extrudedHeight,
      }),
      heightInfo,
    },
  ];
}

export function createOutlineGeometries(
  options: PolylineGeometryOptions,
  heightInfo: VectorHeightInfo,
  height: number,
  perPositionHeight: boolean,
  extrudedHeight?: number,
): CesiumGeometryOption<'outline'>[] {
  // maxium and minimum are flipped, to create the same perPositionHeight behaviour as in polygons
  // WallGeometries extrudes down instead of up, so we switch the behaviour and extrude in the other direction
  return [
    {
      type: 'outline',
      geometry: WallOutlineGeometry.fromConstantHeights({
        ...options,
        maximumHeight: !perPositionHeight ? height : undefined,
        minimumHeight: extrudedHeight,
      }),
      heightInfo,
    },
  ];
}

export function createGroundLineGeometries(
  options: PolylineGeometryOptions,
  heightInfo: VectorHeightInfo,
  style: Style,
): CesiumGeometryOption<'groundLine'>[] {
  const width = parseNumber(style.getStroke()!.getWidth(), 1.0);
  return [
    {
      type: 'groundLine',
      geometry: new GroundPolylineGeometry({
        ...options,
        width,
      }),
      heightInfo,
    },
  ];
}

export function createLineGeometries(
  options: PolylineGeometryOptions,
  heightInfo: VectorHeightInfo,
  style: Style,
): CesiumGeometryOption<'line'>[] {
  const width = parseNumber(style.getStroke()!.getWidth(), 1.0);

  return [
    {
      type: 'line',
      geometry: new PolylineGeometry({
        ...options,
        width,
      }),
      heightInfo,
    },
  ];
}

/**
 * Creates the positions array for PolylineGeometry
 * @param  geometry
 * @param heightInfo
 * @private
 */
export function getGeometryOptions(
  geometry: LineString,
  heightInfo: VectorHeightInfo,
): PolylineGeometryOptions {
  const coords = geometry.getCoordinates();
  const coordinateTransformer =
    mercatorToCartesianTransformerForHeightInfo(heightInfo);
  const positions = coords.map(coordinateTransformer);
  return { positions };
}

/**
 * validates if a lineString is renderable
 * @param  lineString
 */
export function validateLineString(lineString: LineString): boolean {
  if (lineString.getType() !== 'LineString') {
    return false;
  }
  const flatCoordinates = lineString.getFlatCoordinates();
  const minimumValues = lineString.getStride() * 2;
  if (flatCoordinates && flatCoordinates.length >= minimumValues) {
    return flatCoordinates.every((value) => Number.isFinite(value));
  }
  return false;
}

let geometryFactory: VectorGeometryFactory<'lineString'> | undefined;

export function getLineStringGeometryFactory(): VectorGeometryFactory<'lineString'> {
  if (!geometryFactory) {
    geometryFactory = {
      type: 'lineString',
      getGeometryOptions,
      createSolidGeometries,
      createOutlineGeometries,
      createFillGeometries(): never[] {
        return [];
      },
      createGroundLineGeometries,
      createLineGeometries,
      validateGeometry: validateLineString,
    };
  }
  return geometryFactory;
}
