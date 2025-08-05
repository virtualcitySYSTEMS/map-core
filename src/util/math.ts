import {
  Math as CesiumMath,
  Cartesian3,
  Cartographic,
  Rectangle,
} from '@vcmap-cesium/engine';
import type { Coordinate } from 'ol/coordinate.js';
import { getDistance as haversineDistance } from 'ol/sphere.js';
import { type Extent, getBottomLeft, getTopRight } from 'ol/extent.js';
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
 * @param  coords1 - [lon, lat] in degrees
 * @param  coords2 - [lon, lat] in degrees
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

export function cartesian2DDistanceSquared(
  point0: Coordinate,
  point1: Coordinate,
): number {
  const distX = point0[0] - point1[0];
  const distY = point0[1] - point1[1];
  return distX ** 2 + distY ** 2;
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
  return Math.sqrt(cartesian2DDistanceSquared(point0, point1));
}

export function cartesian3DDistance(p1: Coordinate, p2: Coordinate): number {
  const point0 = Cartesian3.fromElements(p1[0], p1[1], p1[2]);
  const point1 = Cartesian3.fromElements(p2[0], p2[1], p2[2]);
  return Cartesian3.distance(point0, point1);
}

export function cartesian3DDistanceSquared(
  p1: Coordinate,
  p2: Coordinate,
): number {
  const point0 = Cartesian3.fromElements(p1[0], p1[1], p1[2]);
  const point1 = Cartesian3.fromElements(p2[0], p2[1], p2[2]);
  return Cartesian3.distanceSquared(point0, point1);
}

/**
 * numeric decimalRound
 */
export function decimalRound(v: number, decimalPlaces = 2): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(v * factor) / factor;
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

export function wgs84ToCartographic(
  wgs84Coordinates: Coordinate,
  result?: Cartographic,
): Cartographic {
  return Cartographic.fromDegrees(
    wgs84Coordinates[0],
    wgs84Coordinates[1],
    wgs84Coordinates[2],
    result,
  );
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

export function mercatorToCartographic(
  mercatorCoordinates: Coordinate,
  result?: Cartographic,
): Cartographic {
  const wgs84Coords = Projection.mercatorToWgs84(mercatorCoordinates);
  return wgs84ToCartographic(wgs84Coords, result);
}

export function cartesianToMercator(cartesian: Cartesian3): Coordinate {
  const cartographic = Cartographic.fromCartesian(cartesian);
  const wgs84 = cartographicToWgs84(cartographic);
  return Projection.wgs84ToMercator(wgs84);
}

export function mercatorExtentToRectangle(
  extent: Extent,
  result?: Rectangle,
): Rectangle {
  const bottomLeft = getBottomLeft(extent);
  const topRight = getTopRight(extent);

  Projection.mercatorToWgs84(bottomLeft, true);
  Projection.mercatorToWgs84(topRight, true);

  return Rectangle.fromDegrees(
    bottomLeft[0],
    bottomLeft[1],
    topRight[0],
    topRight[1],
    result,
  );
}

export function rectangleToMercatorExtent(rectangle: Rectangle): Extent {
  const bottomLeft = Projection.wgs84ToMercator([
    CesiumMath.toDegrees(rectangle.west),
    CesiumMath.toDegrees(rectangle.south),
  ]);
  const topRight = Projection.wgs84ToMercator([
    CesiumMath.toDegrees(rectangle.east),
    CesiumMath.toDegrees(rectangle.north),
  ]);

  return [bottomLeft[0], bottomLeft[1], topRight[0], topRight[1]];
}

export function getMidPoint(p1: Coordinate, p2: Coordinate): Coordinate {
  const stride = p1.length;
  const output = new Array<number>(stride);
  for (let i = 0; i < stride; i++) {
    output[i] = p1[i] + (p2[i] - p1[i]) / 2;
  }
  return output;
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

function perpDot(a: number[], b: number[]): number {
  return a[0] * b[1] - a[1] * b[0];
}

// loosely copied from http://www.sunshine2k.de/coding/javascript/lineintersection2d/LineIntersect2D.html
export function cartesian2Intersection(
  lineA: [Coordinate, Coordinate],
  lineB: [Coordinate, Coordinate],
): Coordinate | undefined {
  const A = [lineA[1][0] - lineA[0][0], lineA[1][1] - lineA[0][1]];
  const B = [lineB[1][0] - lineB[0][0], lineB[1][1] - lineB[0][1]];

  if (CesiumMath.equalsEpsilon(perpDot(A, B), 0, CesiumMath.EPSILON8)) {
    return undefined;
  }

  const U = [lineB[0][0] - lineA[0][0], lineB[0][1] - lineA[0][1]];
  const s = perpDot(B, U) / perpDot(B, A);

  return [lineA[0][0] + s * A[0], lineA[0][1] + s * A[1]];
}

/**
 * calculates the haversine distance between two mercator coordinates.
 * @param p1 - in mercator
 * @param p2 - in mercator
 */
export function spherical2Distance(p1: Coordinate, p2: Coordinate): number {
  return haversineDistance(
    Projection.mercatorToWgs84(p1),
    Projection.mercatorToWgs84(p2),
  );
}

let ecefDistanceScratch1 = new Cartesian3();
let ecefDistanceScratch2 = new Cartesian3();

/**
 * calculates the 3D distance in ECEF between two mercator coordinates.
 * @param p1 - in mercator
 * @param p2 - in mercator
 */
export function ecef3DDistance(p1: Coordinate, p2: Coordinate): number {
  ecefDistanceScratch1 = mercatorToCartesian(p1, ecefDistanceScratch1);
  ecefDistanceScratch2 = mercatorToCartesian(p2, ecefDistanceScratch2);

  return Cartesian3.distance(ecefDistanceScratch1, ecefDistanceScratch2);
}
