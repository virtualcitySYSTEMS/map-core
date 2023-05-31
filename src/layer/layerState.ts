/**
 * Enumeration of possible layer states.
 * State machine: inactive <-> loading -> active -> inactive
 */
enum LayerState {
  INACTIVE = 1,
  ACTIVE = 2,
  LOADING = 4,
}

export default LayerState;
