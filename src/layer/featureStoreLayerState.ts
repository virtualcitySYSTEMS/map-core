export const featureStoreStateSymbol = Symbol('vcsFeatureType');

/**
 * Enumeration of feature store item states
 */
export type FeatureStoreLayerState =
  | 'dynamic'
  | 'static'
  | 'edited'
  | 'deleted'
  | 'removed';
