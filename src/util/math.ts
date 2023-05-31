import {
  Math as CesiumMath,
  Cartesian3,
  Cartographic,
} from '@vcmap-cesium/engine';
import type { Coordinate } from 'ol/coordinate.js';
import Projection from './projection.js';

/**
 * returns a new coordinate ([lon, lat] in degrees) from a distance, bearing and starting coordinate
 * @param  coord [lon, lat] in degrees
 * @param  d distance in m to new coordinate
 * @param  brng bearing in degrees ( 0 == north, 90° == east)
 * @returns ;
 */
export function coordinateAtDistance(
  coord: number[],
  d: number,
  brng: number,
): number[] {
  const R = 6371000;
  const brngRadians = CesiumMath.toRadians(brng);
  const lat1 = CesiumMath.toRadians(coord[1]);
  const lon1 = CesiumMath.toRadians(coord[0]);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d / R) +
      Math.cos(lat1) * Math.sin(d / R) * Math.cos(brngRadians),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brngRadians) * Math.sin(d / R) * Math.cos(lat1),
      Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2),
    );
  return [
    parseFloat(CesiumMath.toDegrees(lon2).toFixed(5)),
    parseFloat(CesiumMath.toDegrees(lat2).toFixed(5)),
  ];
}

/**
 * returns the initial bearing in degrees (0-360) between two coordinates
 * @param  coords1 [lon, lat] in degrees
 * @param  coords2 [lon, lat] in degrees
 * @returns ;
 */
export function initialBearingBetweenCoords(
  coords1: number[],
  coords2: number[],
): number {
  // long
  const l1 = CesiumMath.toRadians(coords1[0]);
  // lat
  const f1 = CesiumMath.toRadians(coords1[1]);
  // long
  const l2 = CesiumMath.toRadians(coords2[0]);
  // lat
  const f2 = CesiumMath.toRadians(coords2[1]);

  const y = Math.sin(l2 - l1) * Math.cos(f2);
  const x =
    Math.cos(f1) * Math.sin(f2) -
    Math.sin(f1) * Math.cos(f2) * Math.cos(l2 - l1);
  let brng = CesiumMath.toDegrees(Math.atan2(y, x));
  brng = (brng + 360) % 360;
  return brng;
}

/**
 * @param  p1 - mercator
 * @param  p2 - mercator
 * @returns  in radians
 */
export function getCartesianBearing(p1: Coordinate, p2: Coordinate): number {
  let theta = Math.atan2(p2[0] - p1[0], p2[1] - p1[1]);
  theta = theta < 0 ? theta + CesiumMath.TWO_PI : theta;
  return theta;
}

/**
 * returns distance between two coordinates
 * @param  point0
 * @param  point1
 */
export function cartesian2DDistance(
  point0: Coordinate,
  point1: Coordinate,
): number {
  const distX = point0[0] - point1[0];
  const distY = point0[1] - point1[1];
  return Math.sqrt(distX ** 2 + distY ** 2);
}

export function cartesian3DDistance(p1: Coordinate, p2: Coordinate): number {
  const point0 = Cartesian3.fromElements(p1[0], p1[1], p1[2]);
  const point1 = Cartesian3.fromElements(p2[0], p2[1], p2[2]);
  return Cartesian3.distance(point0, point1);
}

/**
 * Avoid JS negative number modulo bug.
 */
export function modulo(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function cartographicToWgs84(cartographic: Cartographic): number[] {
  return [
    CesiumMath.toDegrees(cartographic.longitude),
    CesiumMath.toDegrees(cartographic.latitude),
    cartographic.height,
  ];
}

export function mercatorToCartesian(
  mercatorCoordinates: Coordinate,
  result?: Cartesian3,
): Cartesian3 {
  const wgs84Coords = Projection.mercatorToWgs84(mercatorCoordinates);
  return Cartesian3.fromDegrees(
    wgs84Coords[0],
    wgs84Coords[1],
    wgs84Coords[2],
    undefined,
    result ?? new Cartesian3(),
  );
}

export function cartesianToMercator(cartesian: Cartesian3): Coordinate {
  const cartographic = Cartographic.fromCartesian(cartesian);
  const wgs84 = cartographicToWgs84(cartographic);
  return Projection.wgs84ToMercator(wgs84);
}

export function getMidPoint(p1: Coordinate, p2: Coordinate): Coordinate {
  if (p1.length < 3 && p2.length < 3) {
    return [p1[0] + (p2[0] - p1[0]) / 2, p1[1] + (p2[1] - p1[1]) / 2, 0];
  }
  return [
    p1[0] + (p2[0] - p1[0]) / 2,
    p1[1] + (p2[1] - p1[1]) / 2,
    p1[2] + (p2[2] - p1[2]) / 2,
  ];
}

/**
 * Gets the pitch between two points in degrees.
 * @param  p1 - mercator
 * @param  p2 - mercator
 * @returns  in degrees
 */
export function getCartesianPitch(p1: Coordinate, p2: Coordinate): number {
  let thirdPoint;
  if (p1[2] > p2[2]) {
    thirdPoint = p1.slice();
    thirdPoint[2] = p2[2];
  } else {
    thirdPoint = p2.slice();
    thirdPoint[2] = p1[2];
  }
  const scratch1 = mercatorToCartesian(p1);
  const scratch2 = mercatorToCartesian(p2);
  const scratch3 = mercatorToCartesian(thirdPoint);

  Cartesian3.subtract(scratch2, scratch1, scratch2);
  Cartesian3.subtract(scratch3, scratch1, scratch3);

  Cartesian3.normalize(scratch2, scratch2);
  Cartesian3.normalize(scratch3, scratch3);

  let pitch;
  if (p1[2] > p2[2]) {
    pitch =
      CesiumMath.toDegrees(Math.acos(Cartesian3.dot(scratch2, scratch3))) - 90;
  } else {
    pitch = CesiumMath.toDegrees(Math.acos(Cartesian3.dot(scratch2, scratch3)));
  }

  return pitch;
}
