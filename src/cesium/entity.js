// @ts-nocheck
import { Entity } from '@vcmap-cesium/engine';

/**
 * @returns {string|number}
 */
Entity.prototype.getId = function getId() {
  return this.id;
};

/**
 * To be used for cesium 3D style functions
 * @param {string} property
 * @returns {*}
 */
Entity.prototype.getProperty = function getProperty(property) {
  return this[property];
};

/**
 * To be used for cesium 3D style functions
 * @param {string} property
 * @returns {*}
 */
Entity.prototype.getPropertyInherited = function getPropertyInherited(
  property,
) {
  return this.getProperty(property);
};
