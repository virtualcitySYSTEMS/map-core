import { Cartesian3, Math as CesiumMath } from '@vcmap-cesium/engine';

/**
 * Spherical coordiantes for a unit sphere where:
 * The north pole is [0, 0],
 * The south pole is [0, PI],
 * And the valid range for phi is 0 to 2 * PI.
 */

const scratchNormal = new Cartesian3();

/**
 * Converts a Cartesian coordinate in the spheres reference system to spherical coordinates.
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
export function globalCartesianToSpherical(
  cartesian: Cartesian3,
  origin: Cartesian3,
): [number, number] {
  // missing east north up rotation.
  Cartesian3.subtract(cartesian, origin, scratchLocal);
  Cartesian3.normalize(scratchLocal, scratchLocal);
  return cartesianToSpherical(scratchLocal);
}

export function sphericalToGlobalCartesian(
  spherical: [number, number],
  origin: Cartesian3,
): Cartesian3 {
  const cartesian = sphericalToCartesian([
    spherical[0] - Math.PI,
    spherical[1],
  ]);
  return Cartesian3.add(origin, cartesian, cartesian);
}

/**
 * Wraps longitude around the globe
 * @param angle
 */
export function convertLatitudeRange(angle: number): number {
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
