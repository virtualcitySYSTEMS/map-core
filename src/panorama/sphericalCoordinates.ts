import { Cartesian3 } from '@vcmap-cesium/engine';

/**
 * Spherical coordiantes for a unit sphere where:
 * The north pole is [0, 0],
 * The south pole is [0, PI],
 * And the valid range for phi is 0 to 2 * PI.
 */

const scratchNormal = new Cartesian3();

/**
 * Converts a Cartesian coordinate to spherical coordinates.
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
 * Converts a Cartesian coordinate to spherical coordinates.
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
