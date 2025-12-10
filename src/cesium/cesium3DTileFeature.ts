import type { Cesium3DTilePointFeature } from '@vcmap-cesium/engine';
import { Cesium3DTileFeature } from '@vcmap-cesium/engine';

Cesium3DTileFeature.prototype.getId = function getId(
  this: Cesium3DTileFeature,
): string | number {
  return (
    (this.getProperty('id') as string | number) ||
    `${this.content.url}${String(this._batchId)}`
  ); // XXX there is a new property `featureId` on the Cesium3DTileset. this may cause issues when picking b3dm.
};

export function getAttributes(
  this: Cesium3DTileFeature | Cesium3DTilePointFeature,
): Record<string, unknown> {
  if (
    (this.tileset.asset as { version: string } | undefined)?.version ===
      '1.1' ||
    !this.getPropertyIds().includes('attributes')
  ) {
    const attributes: Record<string, unknown> = {};
    this.getPropertyIds().forEach((id) => {
      attributes[id] = this.getProperty(id);
    });
    return attributes;
  }
  return (this.getProperty('attributes') as Record<string, unknown>) ?? {};
}

Cesium3DTileFeature.prototype.getAttributes = getAttributes;

export function setAttribute(
  this: Cesium3DTileFeature | Cesium3DTilePointFeature,
  key: string,
  value: unknown,
): void {
  if (
    (this.tileset.asset as { version: string } | undefined)?.version ===
      '1.1' ||
    !this.hasProperty('attributes')
  ) {
    this.setProperty(key, value);
  }
  const attributes =
    (this.getProperty('attributes') as Record<string, unknown>) ?? {};
  attributes[key] = value;
  this.setProperty('attributes', attributes);
}

Cesium3DTileFeature.prototype.setAttribute = setAttribute;
