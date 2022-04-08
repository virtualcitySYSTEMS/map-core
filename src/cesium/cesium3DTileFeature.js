// @ts-nocheck
import { Cesium3DTileFeature } from '@vcmap/cesium';

/**
 * @returns {string|number}
 */
Cesium3DTileFeature.prototype.getId = function getId() {
  return this.getProperty('id') || `${this.content.url}${this._batchId}`; // XXX there is a new property `featureId` on the Cesium3DTileset. this may cause issues when picking b3dm.
};
