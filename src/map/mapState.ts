/**
 * The state of a map.
 * State machine: inactive <-> loading -> active -> inactive
 */
enum MapState {
  INACTIVE = 1,
  ACTIVE = 2,
  LOADING = 4,
}

export default MapState;
