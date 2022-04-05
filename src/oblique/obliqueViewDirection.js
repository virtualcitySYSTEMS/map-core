/**
 * Enumeration of view directions.
 * @enum {number}
 * @property {number} NORTH
 * @property {number} EAST
 * @property {number} SOUTH
 * @property {number} WEST
 * @property {number} NADIR
 * @export
 * @api
 */
export const ObliqueViewDirection = {
  NORTH: 1,
  EAST: 2,
  SOUTH: 3,
  WEST: 4,
  NADIR: 5,
};

/**
 * @type {Object<string, ObliqueViewDirection>}
 * @export
 */
export const obliqueViewDirectionNames = {
  north: ObliqueViewDirection.NORTH,
  east: ObliqueViewDirection.EAST,
  south: ObliqueViewDirection.SOUTH,
  west: ObliqueViewDirection.WEST,
  nadir: ObliqueViewDirection.NADIR,
};

/**
 * @param {number} direction
 * @returns {string|undefined}
 * @export
 */
export function getDirectionName(direction) {
  return Object.keys(obliqueViewDirectionNames)
    .find((name => obliqueViewDirectionNames[name] === direction));
}
