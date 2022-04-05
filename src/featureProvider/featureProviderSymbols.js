/**
 * Added to ol.Feature, if they are not part of a layer, but provided by an {@link AbstractFeatureProvider}.
 * @type {symbol}
 */
export const isProvidedFeature = Symbol('isProvidedFeature');

/**
 * A boolean value, indicating whether {@link SelectBehavior} should add the feature to the selected item layer
 * @type {symbol}
 */
export const showProvidedFeature = Symbol('showProvidedFeature');
