/**
 * Attached to a geometry to indicate, it is already in mercator and not the layers default projection
 */
export const alreadyTransformedToMercator: unique symbol = Symbol(
  'alreadyTransformedToMercator',
);

/**
 * Attached to a geometry to indicate, it is already in oblique image coordiantes and not mercator
 */
export const alreadyTransformedToImage: unique symbol = Symbol(
  'alreadyTransformedToImage',
);

/**
 * Attached to an ol/Feature to reference the underlying oblique geometry
 */
export const obliqueGeometry: unique symbol = Symbol('obliqueGeometry');

/**
 * Attached to an ol/Feature which should only exist in oblqie coordinates and not be transformed to mercator on change
 */
export const doNotTransform: unique symbol = Symbol('doNotTransform');

/**
 * Attached to oblique features to reference the underlying original ol/Feature
 */
export const originalFeatureSymbol: unique symbol = Symbol('OriginalFeature');

/**
 * Attached to mercator or oblique geometries which are polygons but have a circular counterpart. Used to not
 * mess up circle drawing in oblique
 */
export const actuallyIsCircle: unique symbol = Symbol('ActuallyIsCircle');

/**
 * Can be attached to features to have the primitives be created sync instead of async. Use this
 * for faster response times to changes. Do not use this on bulk insertion etc. since sync creation blocks
 * the rendering thread
 */
export const createSync: unique symbol = Symbol('createSync');

/**
 * Can be present on ol/Feature to indicate the current primitives / billboards / models / labels associated with this feature
 */
export const primitives: unique symbol = Symbol('primitives');

/**
 * An INTERNAL symbol used to keep track of the scale of scaled feature primitives.
 */
export const scaleSymbol: unique symbol = Symbol('Scale');

/**
 * Attached to all panorama features with the properties required to create a panorama image
 */
export const panoramaFeature = Symbol('panoramaFeature');
