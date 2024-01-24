import { circular } from 'ol/geom/Polygon.js';
import type { Style } from 'ol/style.js';
import type { Circle } from 'ol/geom.js';
import type { Coordinate } from 'ol/coordinate.js';
import type { Feature } from 'ol/index.js';

import {
  Cartesian3,
  CircleGeometry,
  GroundPolylineGeometry,
  CircleOutlineGeometry,
  Math as CesiumMath,
  Cartographic,
  PolylineGeometry,
  type Scene,
} from '@vcmap-cesium/engine';
import { parseNumber } from '@vcsuite/parsers';
import { addPrimitivesToContext } from './featureconverterHelper.js';
import Projection from '../projection.js';
import type { VectorGeometryFactoryType } from '../../layer/vectorLayer.js';
import type VectorProperties from '../../layer/vectorProperties.js';
import type { AsyncCesiumVectorContext } from '../../layer/cesium/vectorContext.js';

export function createSolidGeometries(
  options: ConstructorParameters<typeof CircleGeometry>[0],
  height: number,
  _perPositionHeight: boolean,
  extrudedHeight?: number,
): CircleGeometry[] {
  return [
    new CircleGeometry({
      ...options,
      height,
      granularity: 0.02,
      extrudedHeight,
    }),
  ];
}

export function createOutlineGeometries(
  options: ConstructorParameters<typeof CircleGeometry>[0],
  height: number,
  _perPositionHeight: boolean,
  extrudedHeight?: number,
): CircleOutlineGeometry[] {
  return [
    new CircleOutlineGeometry({
      ...options,
      height,
      extrudedHeight,
      granularity: 0.02,
    }),
  ];
}

export function createFillGeometries(
  options: ConstructorParameters<typeof CircleGeometry>[0],
  height: number,
  perPositionHeight: boolean,
): CircleGeometry[] {
  return createSolidGeometries(options, height, perPositionHeight, undefined);
}

export function getLineGeometryOptions(
  options: ConstructorParameters<typeof CircleGeometry>[0],
  style: Style,
): { width: number; positions: Cartesian3[] } {
  const width = parseNumber(style.getStroke().getWidth(), 1.0);
  const { center, radius } = options;
  const cartographic = Cartographic.fromCartesian(center);
  const wgs84Center = [
    CesiumMath.toDegrees(cartographic.longitude),
    CesiumMath.toDegrees(cartographic.latitude),
  ];

  // circular returns polygon with GeometryLayout.XY
  const circlePolygon = circular(wgs84Center, radius, 40);
  const pos = circlePolygon.getLinearRing(0)!.getCoordinates();
  const positions = pos.map((coord) => {
    return Cartesian3.fromDegrees(coord[0], coord[1], cartographic.height);
  });
  return {
    positions,
    width,
  };
}

export function createGroundLineGeometries(
  options: ConstructorParameters<typeof CircleGeometry>[0],
  style: Style,
): GroundPolylineGeometry[] {
  const lineOptions = getLineGeometryOptions(options, style);
  return [new GroundPolylineGeometry(lineOptions)];
}

export function createLineGeometries(
  options: ConstructorParameters<typeof CircleGeometry>[0],
  style: Style,
): PolylineGeometry[] {
  const lineOptions = getLineGeometryOptions(options, style);
  return [new PolylineGeometry(lineOptions)];
}

/**
 * extracts the center and radius from the CircleGeometry and converts it to Cartesian3/radius in m
 * @param  geometry
 * @param  positionHeightAdjustment
 * @param  perPositionHeight
 * @param  groundLevelOrMinHeight
 * @returns
 * @private
 */
export function getGeometryOptions(
  geometry: Circle,
  positionHeightAdjustment: number,
  perPositionHeight: boolean,
  groundLevelOrMinHeight: number,
): ConstructorParameters<typeof CircleGeometry>[0] {
  // olCoordinates of center and radius in WGS84
  const olCenter = geometry.getCenter();
  const olPoint = olCenter.slice();
  olPoint[0] += geometry.getRadius();
  const wgs84Center = Projection.mercatorToWgs84(olCenter, true);
  if (!perPositionHeight && groundLevelOrMinHeight) {
    wgs84Center[2] = groundLevelOrMinHeight;
  } else if (wgs84Center[2] != null) {
    wgs84Center[2] += positionHeightAdjustment;
  }

  const wgs84Point = Projection.mercatorToWgs84(olPoint, true);

  // Cesium coordinates of center and radius
  const center = Cartesian3.fromDegrees(
    wgs84Center[0],
    wgs84Center[1],
    wgs84Center[2],
  );
  const point = Cartesian3.fromDegrees(
    wgs84Point[0],
    wgs84Point[1],
    wgs84Center[2],
  );

  // Computation of radius in Cesium 3D
  const radius = Cartesian3.distance(center, point);
  return {
    radius,
    center,
  };
}

export function getCoordinates(geometries: Circle[]): Coordinate[] {
  return geometries.map((circle) => {
    return circle.getCenter();
  });
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
 * validates if a point is renderable
 */
export function validateCircle(circle: Circle): boolean {
  if (circle.getType() !== 'Circle') {
    return false;
  }
  const flatCoordinates = circle.getFlatCoordinates();
  const stride = circle.getStride();
  // needs at least one full coordinate + a radius value and a non 0 radius
  if (
    flatCoordinates &&
    flatCoordinates.length >= stride + 1 &&
    flatCoordinates[stride] !== flatCoordinates[0]
  ) {
    return flatCoordinates.every((value) => Number.isFinite(value));
  }
  return false;
}

export default function circleToCesium(
  feature: Feature,
  style: Style,
  geometries: Circle[],
  vectorProperties: VectorProperties,
  scene: Scene,
  context: AsyncCesiumVectorContext,
): void {
  if (!style.getFill() && !style.getStroke()) {
    return;
  }
  const circleGeometryFactory = getGeometryFactory();
  const validGeometries = geometries.filter((circle) => validateCircle(circle));
  addPrimitivesToContext(
    feature,
    style,
    validGeometries,
    vectorProperties,
    scene,
    circleGeometryFactory,
    context,
  );
}
