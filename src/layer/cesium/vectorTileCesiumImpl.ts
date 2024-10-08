import {
  PrimitiveCollection,
  QuadtreePrimitive,
  SplitDirection,
} from '@vcmap-cesium/engine';
import StyleItem from '../../style/styleItem.js';
import LayerImplementation from '../layerImplementation.js';
import type CesiumMap from '../../map/cesiumMap.js';
import {
  VectorTileImplementation,
  VectorTileImplementationOptions,
} from '../vectorTileLayer.js';
import { vcsLayerName } from '../layerSymbols.js';
import VcsQuadtreeTileProvider from './vcsTile/vcsQuadtreeTileProvider.js';

export default class VectorTileCesiumImpl
  extends LayerImplementation<CesiumMap>
  implements VectorTileImplementation
{
  static get className(): string {
    return 'VectorTileCesiumImpl';
  }

  private _quadtreeProvider: VcsQuadtreeTileProvider;

  private _quadtreePrimitive: QuadtreePrimitive;

  private _primitiveCollection = new PrimitiveCollection();

  constructor(map: CesiumMap, options: VectorTileImplementationOptions) {
    super(map, options);
    this._quadtreeProvider = new VcsQuadtreeTileProvider(
      map,
      this._primitiveCollection,
      options,
    );
    this._quadtreePrimitive = new QuadtreePrimitive({
      tileProvider: this._quadtreeProvider,
    });
    this._primitiveCollection.add(this._quadtreePrimitive);
    this._primitiveCollection[vcsLayerName] = this.name;
    this._primitiveCollection.show = false;
  }

  updateTiles(_tiles: string[], featureVisibility: boolean): void {
    if (!featureVisibility) {
      this._quadtreePrimitive.invalidateAllTiles(); // XXX this we can do bette
    }
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      this.map.addPrimitiveCollection(this._primitiveCollection);
    }
    await super.initialize();
  }

  async activate(): Promise<void> {
    this._primitiveCollection.show = true;
    return super.activate();
  }

  deactivate(): void {
    this._primitiveCollection.show = false;
    super.deactivate();
  }

  updateStyle(style: StyleItem, _silent?: boolean): void {
    this._quadtreeProvider.updateStyle(style);
    this._quadtreePrimitive.invalidateAllTiles();
  }

  updateSplitDirection(direction: SplitDirection): void {
    this._quadtreeProvider.updateSplitDirection(direction);
    this._quadtreePrimitive.invalidateAllTiles();
  }

  destroy(): void {
    if (!this.isDestroyed) {
      this._quadtreeProvider.destroy();
      this._quadtreePrimitive.invalidateAllTiles();
      if (this.map.initialized) {
        this.map.removePrimitiveCollection(this._primitiveCollection);
      } else {
        this._primitiveCollection.destroy();
      }
    }

    super.destroy();
  }
}
