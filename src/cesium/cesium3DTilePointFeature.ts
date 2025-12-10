import { Cesium3DTilePointFeature } from '@vcmap-cesium/engine';
import { getAttributes, setAttribute } from './cesium3DTileFeature.js';

Cesium3DTilePointFeature.prototype.getId = function getId(
  this: Cesium3DTilePointFeature,
): string | number {
  return (
    (this.getProperty('id') as string | number) ||
    `${this.content.url}${this._batchId}`
  );
};

Cesium3DTilePointFeature.prototype.getAttributes = getAttributes;

Cesium3DTilePointFeature.prototype.setAttribute = setAttribute;
