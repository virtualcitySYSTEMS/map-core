import {
  Cesium3DTileFeature,
  Cesium3DTilePointFeature,
} from '@vcmap-cesium/engine';

Cesium3DTileFeature.prototype.getId = function getId(
  this: Cesium3DTileFeature,
): string | number {
  return (
    (this.getProperty('id') as string | number) ||
    `${this.content.url}${this._batchId}`
  ); // XXX there is a new property `featureId` on the Cesium3DTileset. this may cause issues when picking b3dm.
};

// eslint-disable-next-line import/prefer-default-export
export function getAttributes(
  this: Cesium3DTileFeature | Cesium3DTilePointFeature,
): Record<string, unknown> {
  if ((this.tileset.asset as { version: string })?.version === '1.1') {
    const attributes: Record<string, unknown> = {};
    this.getPropertyIds().forEach((id) => {
      attributes[id] = this.getProperty(id);
    });
    return attributes;
  }
  return this.getProperty('attributes') as Record<string, unknown>;
}

Cesium3DTileFeature.prototype.getAttributes = getAttributes;
