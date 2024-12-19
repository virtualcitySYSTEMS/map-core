import {
  Cartesian3,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  Transforms,
} from '@vcmap-cesium/engine';

/**
 * Spherical coordinates for a unit sphere where:
 * The north pole is [0, 0],
 * The south pole is [0, PI],
 * And the valid range for phi is 0 to 2 * PI.
 */

/**
 * Wraps latitude around the globe (-PI/2 to PI/2) in camera spherical coordinates.
 * @param angle
 */
export function convertCameraLatitudeRange(angle: number): number {
  const pi = CesiumMath.PI;

  const simplified = angle - Math.floor(angle / pi) * pi;

  if (simplified < -CesiumMath.PI_OVER_TWO) {
    return simplified + pi;
  }
  if (simplified >= CesiumMath.PI_OVER_TWO) {
    return simplified - pi;
  }

  return simplified;
}

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
 * @returns
 */
export function sphericalToCartesian(spherical: [number, number]): Cartesian3 {
  const [phi, theta] = spherical;
  const x = Math.sin(theta) * Math.cos(phi);
  const y = Math.sin(theta) * Math.sin(phi);
  const z = Math.cos(theta);
  return new Cartesian3(x, y, z);
}

const scratchLocal = new Cartesian3();

/**
 * Takes a global cesium cartesian in ECEF and converts it to spherical coordinates on the flipped image.
 * @param cartesian
 * @param origin
 * @param rotationZ
 */
export function globalCartesianToImageSpherical(
  cartesian: Cartesian3,
  origin: Cartesian3,
  rotationZ = 0,
): [number, number] {
  // performance, this is FIX for an image and can be passed in. so the entire transformation matrix can be passed in
  const transform = Transforms.eastNorthUpToFixedFrame(origin);
  Matrix4.inverse(transform, transform);
  Matrix4.multiplyByPoint(transform, cartesian, scratchLocal);
  if (rotationZ) {
    Matrix4.fromRotation(Matrix3.fromRotationZ(-rotationZ), transform);
    Matrix4.multiplyByPoint(transform, scratchLocal, scratchLocal);
  }

  Cartesian3.normalize(scratchLocal, scratchLocal);
  return cartesianToImageSpherical(scratchLocal);
}
