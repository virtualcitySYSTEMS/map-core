import OLVectorTileLayer from 'ol/layer/VectorTile.js';
import VectorTileSource from 'ol/source/VectorTile.js';
import TileState from 'ol/TileState.js';
import type { Size } from 'ol/size.js';
import type VectorTile from 'ol/VectorTile.js';
import LayerOpenlayersImpl from './layerOpenlayersImpl.js';
import { mercatorProjection } from '../../util/projection.js';
import type {
  VectorTileImplementation,
  VectorTileImplementationOptions,
} from '../vectorTileLayer.js';
import type TileProvider from '../tileProvider/tileProvider.js';
import type Extent from '../../util/extent.js';
import type OpenlayersMap from '../../map/openlayersMap.js';
import type StyleItem from '../../style/styleItem.js';

/**
 * represents a specific vectorTileLayer for openlayers.
 */
class VectorTileOpenlayersImpl
  extends LayerOpenlayersImpl
  implements VectorTileImplementation
{
  static get className(): string {
    return 'VectorTileOpenlayersImpl';
  }

  tileProvider: TileProvider;

  source: VectorTileSource | undefined = undefined;

  tileSize: Size;

  /**
   * tiles to update on next TileRedraw
   */
  private _tilesToUpdate: Set<string> = new Set();

  private _reloadTimeout: number | undefined = undefined;

  minLevel: number | undefined;

  maxLevel: number | undefined;

  extent: Extent | undefined;

  constructor(map: OpenlayersMap, options: VectorTileImplementationOptions) {
    super(map, options);

    this.tileProvider = options.tileProvider;
    this.tileSize = options.tileSize;
    this.minLevel = options.minLevel;
    this.maxLevel = options.maxLevel;
    this.extent = options.extent;
  }

  getOLLayer(): OLVectorTileLayer {
    this.source = new VectorTileSource({
      minZoom: 0,
      maxZoom: 26,
      tileSize: this.tileSize,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      tileLoadFunction: async (tile: VectorTile): Promise<void> => {
        const features = await this.tileProvider.getFeaturesForTile(
          tile.tileCoord[1],
          tile.tileCoord[2],
          tile.tileCoord[0],
          this.headers,
        );
        if (features.length > 0) {
          tile.setFeatures(features);
        } else {
          tile.setFeatures([]);
          tile.setState(TileState.EMPTY);
        }
      },
      // url needs to be set for the tileLoadFunction to work.
      url: '/{z}/{x}/{y}',
    });
    const extent =
      this.extent && this.extent.isValid()
        ? this.extent.getCoordinatesInProjection(mercatorProjection)
        : undefined;
    // make it so that openlayers and cesium zoom level fit together
    const minZoom = this.minLevel ? this.minLevel : undefined;
    const maxZoom = this.maxLevel ? this.maxLevel + 1 : undefined;
    const olLayer = new OLVectorTileLayer({
      visible: false,
      source: this.source,
      renderBuffer: 200,
      renderMode: 'hybrid',
      declutter: true,
      extent,
      minZoom,
      maxZoom,
    });
    return olLayer;
  }

  /**
   * rerenders the specified tiles
   * rendering happens async
   */
  updateTiles(tileIds: string[]): void {
    if (tileIds.length > 0) {
      tileIds.forEach((tileId) => {
        this._tilesToUpdate.add(tileId);
      });
      if (this.source) {
        if (!this._reloadTimeout) {
          this._reloadTimeout = window.setTimeout(() => {
            this._tilesToUpdate.forEach((tileId) => {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              const tCache = this.source.tileCache;
              if (tCache.containsKey(tileId)) {
                // change of key of tile (will trigger a reload)
                const tile = tCache.get(tileId) as VectorTile;
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                tile.key = false;
              }
            });
            this.source!.changed();
            this._tilesToUpdate.clear();
            this._reloadTimeout = undefined;
          }, 0);
        }
      }
    }
  }

  // eslint-disable-next-line no-unused-vars
  updateStyle(_style: StyleItem, _silent?: boolean): void {
    if (this.initialized) {
      window.clearTimeout(this._reloadTimeout);
      this._reloadTimeout = undefined;
      this._tilesToUpdate.clear();
      this.source!.refresh();
    }
  }

  setVisibility(visibility: boolean): void {
    if (this.initialized) {
      this.olLayer!.setVisible(visibility);
    }
  }

  destroy(): void {
    if (this.source) {
      this.source.clear();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.source = null;
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.tileProvider = null;
    super.destroy();
  }
}

export default VectorTileOpenlayersImpl;
