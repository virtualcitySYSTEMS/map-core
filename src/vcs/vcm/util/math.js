import { Math as CesiumMath, Cartesian3 } from '@vcmap/cesium';

/**
 * returns a new coordinate ([lon, lat] in degrees) from a distance, bearing and starting coordinate
 * @param {Array.<number>} coord [lon, lat] in degrees
 * @param {number} d distance in m to new coordinate
 * @param {number} brng bearing in degrees ( 0 == north, 90° == east)
 * @returns {Array.<number>};
 */
export function coordinateAtDistance(coord, d, brng) {
  const R = 6371000;
  const brngRadians = CesiumMath.toRadians(brng);
  const lat1 = CesiumMath.toRadians(coord[1]);
  const lon1 = CesiumMath.toRadians(coord[0]);
  const lat2 = Math.asin((Math.sin(lat1) * Math.cos(d / R)) +
    (Math.cos(lat1) * Math.sin(d / R) * Math.cos(brngRadians)));
  const lon2 = lon1 + Math.atan2(
    Math.sin(brngRadians) * Math.sin(d / R) * Math.cos(lat1),
    Math.cos(d / R) - (Math.sin(lat1) * Math.sin(lat2)),
  );
  return [parseFloat(CesiumMath.toDegrees(lon2).toFixed(5)), parseFloat(CesiumMath.toDegrees(lat2).toFixed(5))];
}


/**
 * returns the initial bearing in degrees (0-360) between two coordinates
 * @param {Array.<number>} coords1 [lon, lat] in degrees
 * @param {Array.<number>} coords2 [lon, lat] in degrees
 * @returns {number};
 */
export function initialBearingBetweenCoords(coords1, coords2) {
  // long
  const l1 = CesiumMath.toRadians(coords1[0]);
  // lat
  const f1 = CesiumMath.toRadians(coords1[1]);
  // long
  const l2 = CesiumMath.toRadians(coords2[0]);
  // lat
  const f2 = CesiumMath.toRadians(coords2[1]);

  const y = Math.sin(l2 - l1) * Math.cos(f2);
  const x = (Math.cos(f1) * Math.sin(f2)) - (Math.sin(f1) * Math.cos(f2) * Math.cos(l2 - l1));
  let brng = CesiumMath.toDegrees(Math.atan2(y, x));
  brng = (brng + 360) % 360;
  return brng;
}


/**
 * returns distance between two coordinates
 * @param {import("ol/coordinate").Coordinate} point0
 * @param {import("ol/coordinate").Coordinate} point1
 * @returns {number}
 */
export function cartesian2DDistance(point0, point1) {
  const distX = point0[0] - point1[0];
  const distY = point0[1] - point1[1];
  return Math.sqrt((distX ** 2) + (distY ** 2));
}

/**
 * @param {import("ol/coordinate").Coordinate} p1
 * @param {import("ol/coordinate").Coordinate} p2
 * @returns {number}
 */
export function cartesian3DDistance(p1, p2) {
  const point0 = Cartesian3.fromElements(p1[0], p1[1], p1[2]);
  const point1 = Cartesian3.fromElements(p2[0], p2[1], p2[2]);
  return Cartesian3.distance(point0, point1);
}

