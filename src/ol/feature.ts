import Feature from 'ol/Feature.js';
import { Style } from 'ol/style.js';
import type { StyleFunction, StyleLike } from 'ol/style/Style.js';
import {
  globalHidden,
  hidden,
  highlighted,
} from '../layer/featureVisibility.js';

/**
 * To be used for cesium 3D style functions
 * @param {string} property
 * @returns {*}
 */
Feature.prototype.getProperty = function getProperty(
  this: Feature,
  property,
): unknown {
  if (property === 'attributes') {
    const properties = this.getProperties();
    if (this.getGeometryName()) {
      delete properties[this.getGeometryName()];
    }
    return properties;
  } else if (property === 'olcs_geometryType') {
    const type = this.getGeometry()?.getType();
    if (type === 'Polygon') {
      return 1;
    } else if (type === 'LineString') {
      return 2;
    } else if (type === 'Point') {
      return 3;
    } else if (type === 'Circle') {
      return 1;
    } else if (type === 'MultiPolygon') {
      return 1;
    } else if (type === 'MultiLineString') {
      return 2;
    } else if (type === 'MultiPoint') {
      return 3;
    }
    return undefined;
  }
  return this.get(property);
};

Feature.prototype.getAttributes = function getAttributes(
  this: Feature,
): Record<string, unknown> {
  const properties = this.getProperties();
  if (this.getGeometryName()) {
    delete properties[this.getGeometryName()];
  }
  return properties;
};

/**
 * To be used for cesium 3D style functions
 * @param {string} property
 * @returns {*}
 */
Feature.prototype.getPropertyInherited = function getPropertyInherited(
  this: Feature,
  property,
  // eslint-disable-next-line
): any {
  return this.getProperty(property);
};

// eslint-disable-next-line @typescript-eslint/unbound-method
const originalStyleFunction = Feature.prototype.getStyleFunction;
Feature.prototype.getStyleFunction = function getStyleFunction(
  this: Feature,
): StyleFunction | undefined {
  if (this[hidden] || this[globalHidden]) {
    return () => [];
  }

  if (this[highlighted]) {
    return ((feature, res) => {
      if (typeof this[highlighted]?.style === 'function') {
        return this[highlighted]?.style(feature, res);
      }
      return [this[highlighted]?.style];
    }) as StyleFunction;
  }
  return originalStyleFunction.call(this);
};

// eslint-disable-next-line @typescript-eslint/unbound-method
const originalGetStyle = Feature.prototype.getStyle;
Feature.prototype.getStyle = function getStyle(
  this: Feature,
): StyleLike | undefined {
  if (this[hidden] || this[globalHidden]) {
    return new Style({});
  }

  if (this[highlighted]) {
    return this[highlighted].style;
  }

  return originalGetStyle.call(this);
};

/**
 * Returns the style set on the feature, ignoring hidden & highlighted states.
 * In contrast to getStyle, which returns the highlight style or an empty style if the feature is highlighted or hidden.
 * Returns undefined, if no style is set on the feature.
 */
Feature.prototype.getOriginalStyle = function getOriginalStyle(
  this: Feature,
): StyleLike | undefined {
  // ol initializes the style with null
  return originalGetStyle.call(this) ?? undefined;
};

// eslint-disable-next-line @typescript-eslint/unbound-method
const originalClone = Feature.prototype.clone;
/**
 * ol's clone sets the style returned by getStyle on the cloned feature, which is the highlight style or an empty style
 * for highlighted or hidden features. Ensures the cloned feature gets the features own style instead (same instance, not a copy).
 */
Feature.prototype.clone = function clone(this: Feature): Feature {
  const clonedFeature = originalClone.call(this);
  if (this[hidden] || this[globalHidden] || this[highlighted]) {
    clonedFeature.setStyle(this.getOriginalStyle());
  }
  return clonedFeature;
};

// TODO implement getExactClassName, isClass & isExactClass
// TODO implement feature.content.tileset.timeSinceLoad
