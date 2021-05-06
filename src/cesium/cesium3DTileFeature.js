import Cesium3DTileFeature from '@vcmap/cesium/Source/Scene/Cesium3DTileFeature.js';

/**
 * @returns {string|number}
 */
Cesium3DTileFeature.prototype.getId = function getId() {
  return this.getProperty('id') || `${this.content.url}${this._batchId}`;
};
