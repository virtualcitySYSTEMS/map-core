export const featureStoreStateSymbol = Symbol('vcsFeatureType');

/**
 * Enumeration of feature store item states
 */
export enum FeatureStoreLayerState {
  DYNAMIC = 'dynamic',
  STATIC = 'static',
  EDITED = 'edited',
}
