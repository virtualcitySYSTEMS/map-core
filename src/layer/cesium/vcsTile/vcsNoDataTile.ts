import { QuadtreeTile, TileBoundingRegion } from '@vcmap-cesium/engine';
import type CesiumMap from '../../../map/cesiumMap.js';
import {
  getTileBoundingRegion,
  VcsTile,
  VcsTileState,
  VcsTileType,
} from './vcsTileHelpers.js';

export default class VcsNoDataTile implements VcsTile {
  state = VcsTileState.LOADING;

  type = VcsTileType.NO_DATA;

  tileBoundingRegion: TileBoundingRegion;

  constructor(tile: QuadtreeTile<VcsTile>, map: CesiumMap) {
    this.tileBoundingRegion = getTileBoundingRegion(tile, map);

    this.state = VcsTileState.READY;
  }

  // eslint-disable-next-line class-methods-use-this
  get show(): boolean {
    return false;
  }

  // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-empty-function
  set show(_show: boolean) {}
}
