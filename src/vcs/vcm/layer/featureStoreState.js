/**
 * @type {symbol}
 */
export const featureStoreStateSymbol = Symbol('vcsFeatureType');

/**
 * @enum {string}
 * @property {string} DYNAMIC
 * @property {string} STATIC
 * @property {string} EDITED
 * @api
 * @export
 * @memberOf vcs.vcm.layer.FeatureStore
 */
export const featureStoreState = {
  DYNAMIC: 'dynamic',
  STATIC: 'static',
  EDITED: 'edited',
};
