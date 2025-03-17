import { Cartesian3, Math as CesiumMath, Matrix4 } from '@vcmap-cesium/engine';
import type { PanoramaImage } from './panoramaImage.js';

/**
 * Spherical coordinates for a unit sphere where:
 * The north pole is [0, 0],
 * The south pole is [0, PI],
 * And the valid range for phi is 0 to 2 * PI.
 */

/**
 * Wraps longitude around the globe (0 to 2 * PI) in image spherical coordinates.
 * @param angle
 */
export function convertImageLongitudeAngle(angle: number): number {
  const twoPI = CesiumMath.TWO_PI;

  const simplified = angle - Math.floor(angle / twoPI) * twoPI;

  if (simplified < 0) {
    return simplified + twoPI;
  }
  if (simplified >= twoPI) {
    return simplified - twoPI;
  }

  return simplified;
}

const scratchNormal = new Cartesian3();
/**
 * Converts a Cartesian coordinate in the spheres reference system to spherical coordinates (of the spheres reference system).
 * @param cartesian
 * @returns The spherical coordinates [phi, theta].
 */
export function cartesianToSpherical(cartesian: Cartesian3): [number, number] {
  Cartesian3.normalize(cartesian, scratchNormal);
  const { x, y, z } = scratchNormal;
  const phi = Math.atan2(y, x);
  const theta = Math.acos(z);

  return [phi, theta];
}

/**
 * Converts a cartesian coordinate in the spheres reference system to spherical coordinates in the flipped image reference system.
 * @param cartesian
 * @returns The spherical coordinates [phi, theta].
 */
export function cartesianToImageSpherical(
  cartesian: Cartesian3,
): [number, number] {
  const spherical = cartesianToSpherical(cartesian);
  return [convertImageLongitudeAngle(-spherical[0]), spherical[1]];
}

/**
 * Converts spherical coordiantes to cartesian coordinatesin the spheres reference system.
 * @param spherical - The spherical coordinates [phi, theta].
 * @param [result] - The cartesian coordinate to write to.
 * @returns
 */
export function sphericalToCartesian(
  spherical: [number, number],
  result?: Cartesian3,
): Cartesian3 {
  const [phi, theta] = spherical;
  const cartesian = result || new Cartesian3();
  cartesian.x = Math.sin(theta) * Math.cos(-phi);
  cartesian.y = Math.sin(theta) * Math.sin(-phi);
  cartesian.z = Math.cos(theta);
  return cartesian;
}

const scratchLocal = new Cartesian3();

/**
 * Takes a global cesium cartesian in ECEF and converts it to spherical coordinates on the flipped image.
 * @param cartesian
 * @param image
 */
export function globalCartesianToImageSpherical(
  cartesian: Cartesian3,
  image: PanoramaImage,
): [number, number] {
  Matrix4.multiplyByPoint(image.invModelMatrix, cartesian, scratchLocal);
  Cartesian3.normalize(scratchLocal, scratchLocal);
  return cartesianToImageSpherical(scratchLocal);
}
