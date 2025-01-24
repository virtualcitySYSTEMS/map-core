/**
 * Added to ol.Feature, if they are not part of a layer, but provided by an {@link AbstractFeatureProvider}.
 */
export const isProvidedFeature: unique symbol = Symbol('isProvidedFeature');

/**
 * Added to ol.Feature, if a {@link AbstractFeatureProvider} provides more than one feature for one location.
 * The provided feature is a cluster feature. The single features can be accessed by `feature.get('features')`.
 */
export const isProvidedClusterFeature = Symbol('isProvidedClusterFeature');
