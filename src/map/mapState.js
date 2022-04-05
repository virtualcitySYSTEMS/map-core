/**
 * The state of a map.
 * State machine: inactive <-> loading -> active -> inactive
 * @enum {number}
 * @export
 * @api
 * @property {number} INACTIVE
 * @property {number} ACTIVE
 * @property {number} LOADING
 */
const MapState = {
  INACTIVE: 1,
  ACTIVE: 2,
  LOADING: 4,
};

export default MapState;
