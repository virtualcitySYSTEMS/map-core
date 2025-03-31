import type { QuadtreeTile, TileBoundingRegion } from '@vcmap-cesium/engine';
import { PrimitiveCollection } from '@vcmap-cesium/engine';
import { getLogger } from '@vcsuite/logger';
import type { EventsKey } from 'ol/events.js';
import { unByKey } from 'ol/Observable.js';
import { containsCoordinate, getCenter } from 'ol/extent.js';
import type { StyleLike } from 'ol/style/Style.js';
import VectorContext from '../vectorContext.js';
import { vcsLayerName } from '../../layerSymbols.js';
import type { VcsTile, VcsTileOptions } from './vcsTileHelpers.js';
import {
  getTileBoundingRegion,
  getTileWebMercatorExtent,
  VcsTileState,
  VcsTileType,
} from './vcsTileHelpers.js';
import type CesiumMap from '../../../map/cesiumMap.js';
import type VectorProperties from '../../vectorProperties.js';
import type TileProvider from '../../tileProvider/tileProvider.js';

export default class VcsVectorTile implements VcsTile {
  state = VcsTileState.LOADING;

  type = VcsTileType.VECTOR;

  tileBoundingRegion: TileBoundingRegion;

  private _tile: QuadtreeTile<VcsTile>;

  private _vectorContext: VectorContext;

  private _rootCollection = new PrimitiveCollection();

  private _featureListeners: EventsKey[] = [];

  private _map: CesiumMap;

  private _tileProvider: TileProvider;

  private _style: StyleLike;

  private _vectorProperties: VectorProperties;

  private _layerPrimitiveCollection: PrimitiveCollection;

  private _isDestroyed: boolean;

  constructor(tile: QuadtreeTile<VcsTile>, options: VcsTileOptions) {
    this._tile = tile;
    this._map = options.map;
    this._tileProvider = options.tileProvider;
    this._style = options.style;
    this._vectorProperties = options.vectorProperties;
    this._layerPrimitiveCollection = options.primitiveCollection;

    this._vectorContext = new VectorContext(
      options.map,
      this._rootCollection,
      options.splitDirection,
    );
    this._rootCollection[vcsLayerName] = options.name;
    this._rootCollection.show = false;
    options.primitiveCollection.add(this._rootCollection);

    this.tileBoundingRegion = getTileBoundingRegion(tile, options.map);
    this._load().catch(() => {
      this.state = VcsTileState.FAILED;
    });
    this._isDestroyed = false;
  }

  private async _load(): Promise<void> {
    this.state = VcsTileState.LOADING;
    const scene = this._map.getScene()!;

    const features = await this._tileProvider.getFeaturesForTile(
      this._tile.x,
      this._tile.y,
      this._tile.level,
    );
    if (this._isDestroyed) {
      return;
    }
    const tileWebmercator = getTileWebMercatorExtent(
      this._tile,
      this._tileProvider.tilingScheme,
    );

    this.state = VcsTileState.PROCESSING;
    await Promise.all(
      features.map(async (f) => {
        if (this._isDestroyed) {
          return;
        }
        const featureExtent = f.getGeometry()?.getExtent();
        if (
          featureExtent &&
          containsCoordinate(tileWebmercator, getCenter(featureExtent))
        ) {
          this._featureListeners.push(
            f.on('change', () => {
              this._vectorContext
                .addFeature(f, this._style, this._vectorProperties, scene)
                .catch(() => {
                  getLogger('VcsVectorTile').error(
                    'failed to add changed feature',
                  );
                });
            }),
          );
          await this._vectorContext.addFeature(
            f,
            this._style,
            this._vectorProperties,
            scene,
          );
        }
      }),
    );
    if (this._isDestroyed) {
      return;
    }
    this.state = VcsTileState.READY;
  }

  get show(): boolean {
    return this._rootCollection.show;
  }

  set show(show: boolean) {
    this._rootCollection.show = show;
  }

  freeResources(): void {
    this.destroy();
  }

  destroy(): void {
    unByKey(this._featureListeners);
    this._isDestroyed = true;
    this._vectorContext.destroy();
    this._layerPrimitiveCollection.remove(this._rootCollection);
    this._tile.data = undefined;
  }
}
