import { Cesium3DTileFeature } from '@vcmap-cesium/engine';

Cesium3DTileFeature.prototype.getId = function getId(
  this: Cesium3DTileFeature,
): string | number {
  return (
    (this.getProperty('id') as string | number) ||
    `${this.content.url}${this._batchId}`
  ); // XXX there is a new property `featureId` on the Cesium3DTileset. this may cause issues when picking b3dm.
};
