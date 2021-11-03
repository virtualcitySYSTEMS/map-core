import Feature from 'ol/Feature.js';

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
Feature.prototype.getPropertyInherited = function getPropertyInherited(property) {
  return this.getProperty(property);
};

// TODO implement getExactClassName, isClass & isExactClass
// TODO implement feature.content.tileset.timeSinceLoad
