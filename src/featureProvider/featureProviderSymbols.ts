/**
 * Added to ol.Feature, if they are not part of a layer, but provided by an {@link AbstractFeatureProvider}.
 */
export const isProvidedFeature: unique symbol = Symbol('isProvidedFeature');

/**
 * A boolean value, indicating whether selecting should add the feature to the selected item layer
 * @deprecated
 */
export const showProvidedFeature: unique symbol = Symbol('showProvidedFeature');
