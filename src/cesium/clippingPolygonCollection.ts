import { ClippingPolygonCollection } from '@vcmap-cesium/engine';

ClippingPolygonCollection.prototype.setDirty = function setDirty(): void {
  this._totalPositions = -1;
};
