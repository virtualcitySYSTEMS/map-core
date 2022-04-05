import OLVectorTileLayer from 'ol/layer/VectorTile.js';
import VectorTileSource from 'ol/source/VectorTile.js';
import TileState from 'ol/TileState.js';
import LayerOpenlayersImpl from './layerOpenlayersImpl.js';
import { mercatorProjection } from '../../util/projection.js';

/**
 * represents a specific vectorTileLayer for openlayers.
 * @class
 * @export
 * @implements {VectorTileImplementation}
 * @extends {LayerOpenlayersImpl}
 */
class VectorTileOpenlayersImpl extends LayerOpenlayersImpl {
  static get className() { return 'VectorTileOpenlayersImpl'; }

  /**
   * @param {import("@vcmap/core").OpenlayersMap} map
   * @param {VectorTileImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);

    /** @type {import("@vcmap/core").TileProvider} */
    this.tileProvider = options.tileProvider;

    /** @type {import("ol/source").VectorTile} */
    this.source = null;

    /**
     * @type {import("ol/size").Size}
     */
    this.tileSize = options.tileSize;

    /**
     * tiles to update on next TileRedraw
     * @type {Set<string>}
     * @private
     */
    this._tilesToUpdate = new Set();

    /**
     * @type {number|null}
     * @private
     */
    this._reloadTimeout = null;

    /**
     * @type {number|undefined}
     */
    this.minLevel = options.minLevel;

    /**
     * @type {number|undefined}
     */
    this.maxLevel = options.maxLevel;

    /**
     * @type {import("@vcmap/core").Extent|undefined}
     */
    this.extent = options.extent;
  }

  /**
   * @inheritDoc
   * @returns {import("ol/layer/VectorTile").default}
   */
  getOLLayer() {
    this.source = new VectorTileSource({
      minZoom: 0,
      maxZoom: 26,
      tileSize: this.tileSize,
      /**
       * @param {import("ol/VectorTile").default} tile
       * @returns {Promise<void>}
       */
      tileLoadFunction: async (tile) => {
        const features =
          await this.tileProvider.getFeaturesForTile(tile.tileCoord[1], tile.tileCoord[2], tile.tileCoord[0]);
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
    const extent = this.extent && this.extent.isValid() ?
      this.extent.getCoordinatesInProjection(mercatorProjection) : undefined;
    // make it so that openlayers and cesium zoom level fit together
    const minZoom = this.minLevel ? this.minLevel : undefined;
    const maxZoom = this.maxLevel ? this.maxLevel + 1 : undefined;
    const olLayer = new OLVectorTileLayer({
      visible: false,
      source: this.source,
      renderBuffer: 200,
      renderMode: 'image',
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
   * @param {Array<string>} tileIds
   * @api
   */
  updateTiles(tileIds) {
    if (tileIds.length > 0) {
      tileIds.forEach((tileId) => {
        this._tilesToUpdate.add(tileId);
      });
      if (this.source) {
        if (!this._reloadTimeout) {
          this._reloadTimeout = window.setTimeout(() => {
            this._tilesToUpdate.forEach((tileId) => {
              // @ts-ignore
              const { tileCache } = this.source;
              if (tileCache.containsKey(tileId)) {
                // change of key of tile (will trigger a reload)
                const tile = tileCache.get(tileId);
                tile.key = false;
              }
            });
            this.source.changed();
            this._tilesToUpdate.clear();
            this._reloadTimeout = null;
          }, 0);
        }
      }
    }
  }

  /**
   * @param {import("@vcmap/core").StyleItem} style
   * @param {boolean=} silent
   * @api
   */
  // eslint-disable-next-line no-unused-vars
  updateStyle(style, silent) {
    if (this.initialized) {
      window.clearTimeout(this._reloadTimeout);
      this._reloadTimeout = null;
      this._tilesToUpdate.clear();
      this.source.refresh();
    }
  }

  /**
   * @param {boolean} visibility
   */
  setVisibility(visibility) {
    if (this.initialized) {
      this.olLayer.setVisible(visibility);
    }
  }

  /**
   * @inheritDoc
   */
  destroy() {
    if (this.source) {
      this.source.clear();
      this.source = null;
    }
    this.tileProvider = null;
    super.destroy();
  }
}

export default VectorTileOpenlayersImpl;
