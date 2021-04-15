/**
 * Added to ol.Feature, if they are not part of a layer, but provided by an {@link vcs.vcm.util.featureProvider.AbstractFeatureProvider}.
 * @type {symbol}
 */
export const isProvidedFeature = Symbol('isProvidedFeature');

/**
 * A boolean value, indicating whether {@link vcs.vcm.SelectBehavior} should add the feature to the selected item layer
 * @type {symbol}
 */
export const showProvidedFeature = Symbol('showProvidedFeature');
