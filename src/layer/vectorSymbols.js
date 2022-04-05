/**
 * Attached to a geometry to indicate, it is already in mercator and not the layers default projection
 * @type {symbol}
 * @const
 */
export const alreadyTransformedToMercator = Symbol('alreadyTransformedToMercator');

/**
 * Attached to a geometry to indicate, it is already in oblique image coordiantes and not mercator
 * @type {symbol}
 * @const
 */
export const alreadyTransformedToImage = Symbol('alreadyTransformedToImage');

/**
 * Attached to an ol/Feature to reference the underlying oblique geometry
 * @type {symbol}
 * @const
 */
export const obliqueGeometry = Symbol('obliqueGeometry');

/**
 * Attached to an ol/Feature which should only exist in oblqie coordinates and not be transformed to mercator on change
 * @type {symbol}
 * @const
 */
export const doNotTransform = Symbol('doNotTransform');

/**
 * Attached to oblique features to reference the underlying original ol/Feature
 * @type {symbol}
 */
export const originalFeatureSymbol = Symbol('OriginalFeature');

/**
 * Attached to mercator or oblique geometries which are polygons but have a circular counterpart. Used to not
 * mess up circle drawing in oblique
 * @type {symbol}
 */
export const actuallyIsCircle = Symbol('ActuallyIsCircle');
