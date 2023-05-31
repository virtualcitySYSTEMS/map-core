import { Cesium3DTilePointFeature } from '@vcmap-cesium/engine';

Cesium3DTilePointFeature.prototype.getId = function getId(
  this: Cesium3DTilePointFeature,
): string | number {
  return (
    (this.getProperty('id') as string | number) ||
    `${this.content.url}${this._batchId}`
  );
};
