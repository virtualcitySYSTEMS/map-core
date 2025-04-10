import type { QuadtreeTile, TileBoundingRegion } from '@vcmap-cesium/engine';
import type { VcsTile } from './vcsTileHelpers.js';
import {
  getTileBoundingRegion,
  VcsTileState,
  VcsTileType,
} from './vcsTileHelpers.js';
import type CesiumMap from '../../../map/cesiumMap.js';

export default class VcsChildTile implements VcsTile {
  state = VcsTileState.LOADING;

  type = VcsTileType.CHILD;

  tileBoundingRegion: TileBoundingRegion;

  private _tile: QuadtreeTile<VcsTile>;

  constructor(tile: QuadtreeTile<VcsTile>, map: CesiumMap) {
    this.tileBoundingRegion = getTileBoundingRegion(tile, map);
    this.state = VcsTileState.READY;
    this._tile = tile;
  }

  get show(): boolean {
    return this._tile.parent?.data?.show ?? false;
  }

  // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-empty-function,no-empty-function
  set show(_show: boolean) {}
}
