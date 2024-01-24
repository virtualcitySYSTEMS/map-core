import {
  Cartesian3,
  WallGeometry,
  WallOutlineGeometry,
  GroundPolylineGeometry,
  PolylineGeometry,
  Math as CesiumMath,
  HeightReference,
  type Scene,
  PolygonGeometry,
} from '@vcmap-cesium/engine';
import { Feature } from 'ol';
import { type LineString, Point } from 'ol/geom.js';
import type { Coordinate } from 'ol/coordinate.js';
import type { Style } from 'ol/style.js';

import { parseNumber } from '@vcsuite/parsers';
import Projection from '../projection.js';
import { addPrimitivesToContext } from './featureconverterHelper.js';
import { getFlatCoordinatesFromSimpleGeometry } from '../geometryHelpers.js';
import ArrowStyle, { ArrowEnd } from '../../style/arrowStyle.js';
import { getCartesianBearing, getCartesianPitch } from '../math.js';
import { getPrimitiveOptions } from './pointHelpers.js';
import type VectorProperties from '../../layer/vectorProperties.js';
import type { VectorGeometryFactoryType } from '../../layer/vectorLayer.js';
import type { AsyncCesiumVectorContext } from '../../layer/cesium/vectorContext.js';

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
  let pitch =
    heightReference === HeightReference.NONE ? getCartesianPitch(to, from) : 0;
  pitch += 90;
  return {
    location: to,
    pitch,
    heading: CesiumMath.toDegrees(
      getCartesianBearing(from, to) + CesiumMath.PI_OVER_TWO,
    ),
  };
}

export async function addArrowsToContext(
  feature: Feature,
  style: ArrowStyle,
  validGeometries: LineString[],
  vectorProperties: VectorProperties,
  scene: Scene,
  lineGeometryFactory: VectorGeometryFactoryType,
  context: AsyncCesiumVectorContext,
): Promise<void> {
  if (style.end === ArrowEnd.NONE || !style.primitiveOptions?.geometryOptions) {
    return;
  }
  const arrowOptions: ArrowOptions[] = [];
  const heightReference = vectorProperties.getAltitudeMode(feature);
  validGeometries.forEach((geom) => {
    const coordinates = lineGeometryFactory.getCoordinates([geom]);
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
  });

  if (arrowOptions.length === 0) {
    return;
  }

  const usedStyle = style.getOlcsStyle();
  const allowPicking = vectorProperties.getAllowPicking(feature);

  await Promise.all(
    arrowOptions.map(async (arrowOption) => {
      const arrowFeature = new Feature({
        ...feature.getProperties(),
        olcs_primitiveOptions: style.primitiveOptions,
        olcs_modelHeading: arrowOption.heading,
        olcs_modelPitch: arrowOption.pitch,
        geometry: new Point(arrowOption.location),
        olcs_modelAutoScale: true,
      });

      const wgs84Position = Projection.mercatorToWgs84(arrowOption.location);
      const cartesianLocation = Cartesian3.fromDegrees(
        wgs84Position[0],
        wgs84Position[1],
        wgs84Position[2],
      );
      const primitiveOptions = await getPrimitiveOptions(
        arrowFeature,
        usedStyle,
        [wgs84Position],
        [cartesianLocation],
        vectorProperties,
        scene,
      );

      if (primitiveOptions?.primitives) {
        context.addScaledPrimitives(
          primitiveOptions.primitives,
          feature,
          allowPicking,
        );
      }
    }),
  );
}

export type LineGeometryOptions = { positions: Cartesian3[] };

export function createSolidGeometries(
  options: LineGeometryOptions,
  height: number,
  perPositionHeight: boolean,
  extrudedHeight?: number,
): WallGeometry[] {
  return [
    WallGeometry.fromConstantHeights({
      ...options,
      maximumHeight: !perPositionHeight ? height : undefined,
      minimumHeight: extrudedHeight,
    }),
  ];
}

export function createOutlineGeometries(
  options: LineGeometryOptions,
  height: number,
  perPositionHeight: boolean,
  extrudedHeight?: number,
): WallOutlineGeometry[] {
  // maxium and minimum are flipped, to create the same perPositionHeight behaviour as in polygons
  // WallGeometries extrudes down instead of up, so we switch the behaviour and extrude in the other direction
  return [
    WallOutlineGeometry.fromConstantHeights({
      ...options,
      maximumHeight: !perPositionHeight ? height : undefined,
      minimumHeight: extrudedHeight,
    }),
  ];
}

export function createFillGeometries(
  _options: LineGeometryOptions,
  _height: number,
  _perPositionHeight: boolean,
): PolygonGeometry[] {
  return [];
}

export function createGroundLineGeometries(
  options: LineGeometryOptions,
  style: Style,
): GroundPolylineGeometry[] {
  const width = parseNumber(style.getStroke().getWidth(), 1.0);
  return [
    new GroundPolylineGeometry({
      ...options,
      width,
    }),
  ];
}

export function createLineGeometries(
  options: LineGeometryOptions,
  style: Style,
): PolylineGeometry[] {
  const width = parseNumber(style.getStroke().getWidth(), 1.0);

  return [
    new PolylineGeometry({
      ...options,
      width,
    }),
  ];
}

/**
 * Creates the positions array for PolylineGeometry
 * @param  geometry
 * @param  positionHeightAdjustment
 * @param  perPositionHeight
 * @param  groundLevelOrMinHeight
 * @private
 */
export function getGeometryOptions(
  geometry: LineString,
  positionHeightAdjustment: number,
  perPositionHeight: boolean,
  groundLevelOrMinHeight: number,
): LineGeometryOptions {
  const coords = geometry.getCoordinates();
  const positions = coords.map((coord) => {
    const wgs84Coords = Projection.mercatorToWgs84(coord);
    if (!perPositionHeight && groundLevelOrMinHeight) {
      wgs84Coords[2] = groundLevelOrMinHeight;
    } else if (wgs84Coords[2] != null) {
      wgs84Coords[2] += positionHeightAdjustment;
    }
    return Cartesian3.fromDegrees(
      wgs84Coords[0],
      wgs84Coords[1],
      wgs84Coords[2],
    );
  });
  return { positions };
}

export function getCoordinates(geometries: LineString[]): Coordinate[] {
  const coordinates: Coordinate[] = [];
  geometries.forEach((lineString) => {
    coordinates.push(...getFlatCoordinatesFromSimpleGeometry(lineString));
  });
  return coordinates;
}

let geometryFactory: VectorGeometryFactoryType | null = null;

function getGeometryFactory(): VectorGeometryFactoryType {
  if (!geometryFactory) {
    geometryFactory = {
      getCoordinates,
      getGeometryOptions,
      createSolidGeometries,
      createOutlineGeometries,
      createFillGeometries,
      createGroundLineGeometries,
      createLineGeometries,
    };
  }
  return geometryFactory;
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

/**
 * converts a linestring to a a cesium primitive, with optional labels
 * @param  feature
 * @param  style
 * @param  geometries
 * @param  vectorProperties
 * @param  scene
 * @param  context
 */
export default async function lineStringToCesium(
  feature: Feature,
  style: Style,
  geometries: LineString[],
  vectorProperties: VectorProperties,
  scene: Scene,
  context: AsyncCesiumVectorContext,
): Promise<void> {
  if (!style.getFill() && !style.getStroke()) {
    return;
  }
  const lineGeometryFactory = getGeometryFactory();
  const validGeometries = geometries.filter((lineString) =>
    validateLineString(lineString),
  );
  addPrimitivesToContext(
    feature,
    style,
    validGeometries,
    vectorProperties,
    scene,
    lineGeometryFactory,
    context,
  );
  if (style instanceof ArrowStyle) {
    await addArrowsToContext(
      feature,
      style,
      validGeometries,
      vectorProperties,
      scene,
      lineGeometryFactory,
      context,
    );
  }
}
