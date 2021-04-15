/**
 * the following states are exclusive: inactive or active. loading or canceled.
 * only active layers can be syncing
 * only syncing & active and inactive layers can be loading
 * loading layers are: inactive & loading and active & syncing & loading
 * inactive layers are: inactive and inactive & canceled and active & syncing & canceled
 * active layers are: active
 * @enum {number}
 * @memberOf vcs.vcm.layer
 * @export
 */
const LayerState = {
  INACTIVE: 1,
  ACTIVE: 2,
  LOADING: 4,
  SYNCING: 8,
  CANCELED: 16,
};

export default LayerState;
