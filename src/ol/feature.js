import Feature from 'ol/Feature.js';
import { Style } from 'ol/style.js';
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
Feature.prototype.getProperty = function getProperty(property) {
  if (property === 'attributes') {
    const properties = this.getProperties();
    if (this.getGeometryName()) {
      delete properties[this.getGeometryName()];
    }
    return properties;
  } else if (property === 'olcs_geometryType') {
    const type = this.getGeometry().getType();
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

/**
 * To be used for cesium 3D style functions
 * @param {string} property
 * @returns {*}
 */
Feature.prototype.getPropertyInherited = function getPropertyInherited(
  property,
) {
  return this.getProperty(property);
};

const originalStyleFunction = Feature.prototype.getStyleFunction;
Feature.prototype.getStyleFunction = function getStyleFunction() {
  if (this[hidden] || this[globalHidden]) {
    return () => [];
  }

  if (this[highlighted]) {
    return () => [this[highlighted].style];
  }
  return originalStyleFunction.bind(this)();
};

const originalGetStyle = Feature.prototype.getStyle;
Feature.prototype.getStyle = function getStyle() {
  if (this[hidden] || this[globalHidden]) {
    return new Style({});
  }

  if (this[highlighted]) {
    return this[highlighted].style;
  }

  return originalGetStyle.bind(this)();
};

// TODO implement getExactClassName, isClass & isExactClass
// TODO implement feature.content.tileset.timeSinceLoad
