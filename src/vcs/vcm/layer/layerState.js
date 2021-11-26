/**
 * Enumeration of possible layer states.
 * State machine: inactive <-> loading -> active -> inactive
 * @enum {number}
 * @export
 * @api
 * @property {number} INACTIVE
 * @property {number} ACTIVE
 * @property {number} LOADING
 */
const LayerState = {
  INACTIVE: 1,
  ACTIVE: 2,
  LOADING: 4,
};

export default LayerState;
