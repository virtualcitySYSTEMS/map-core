import Cesium3DTilePointFeature from 'cesium/Source/Scene/Cesium3DTilePointFeature.js';

/**
 * @returns {string|number}
 */
Cesium3DTilePointFeature.prototype.getId = function getId() {
  return this.getProperty('id') || `${this.content.url}${this._batchId}`;
};
