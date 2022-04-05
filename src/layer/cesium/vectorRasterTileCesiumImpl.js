import { ImageryLayer as CesiumImageryLayer, Rectangle } from '@vcmap/cesium';
import VectorTileImageryProvider from './vectorTileImageryProvider.js';
import RasterLayerCesiumImpl from './rasterLayerCesiumImpl.js';
import { wgs84Projection } from '../../util/projection.js';

/**
 * represents a rasterized tiled vector layer implementation for cesium.
 * @class
 * @export
 * @extends {RasterLayerCesiumImpl}
 * @implements {VectorTileImplementation}
 */
class VectorRasterTileCesiumImpl extends RasterLayerCesiumImpl {
  static get className() {
    return 'VectorRasterTileCesiumImpl';
  }

  /**
   * @param {import("@vcmap/core").CesiumMap} map
   * @param {VectorTileImplementationOptions} options
   */
  constructor(map, options) {
    /** @type {RasterLayerImplementationOptions} */
    const rasterLayerOptions = {
      ...options,
      tilingSchema: 'mercator',
      splitDirection: undefined,
      opacity: undefined,
    };
    super(map, rasterLayerOptions);
    /** @type {import("@vcmap/core").TileProvider} */
    this.tileProvider = options.tileProvider;

    /**
     * @type {import("ol/size").Size}
     */
    this.tileSize = options.tileSize;

    /**
     * @type {number|null}
     * @private
     */
    this._reloadTimeout = null;

    /**
     * @type {VectorTileImageryProvider}
     */
    this.imageryProvider = null;
  }

  /**
   * @returns {import("@vcmap/cesium").ImageryLayer}
   */
  getCesiumLayer() {
    this.imageryProvider = new VectorTileImageryProvider({
      tileProvider: this.tileProvider,
      tileSize: this.tileSize,
    });

    const layerOptions = {
      alpha: this.opacity,
      splitDirection: this.splitDirection,
      minimumTerrainLevel: this.minLevel,
      maximumTerrainLevel: this.maxLevel,
    };
    if (this.extent && this.extent.isValid()) {
      const extent = this.extent.getCoordinatesInProjection(wgs84Projection);
      layerOptions.rectangle = Rectangle.fromDegrees(extent[0], extent[1], extent[2], extent[3]);
    }
    // @ts-ignore
    const imageryLayer = new CesiumImageryLayer(this.imageryProvider, layerOptions);
    return imageryLayer;
  }


  /**
   * reloads the tiles
   * @private
   */
  _reloadTiles() {
    window.clearTimeout(this._reloadTimeout);
    // eslint-disable-next-line no-underscore-dangle
    if (this.imageryProvider && this.imageryProvider._reload) {
      this._reloadTimeout = window.setTimeout(() => {
        // todo find a way to reload specific tiles
        // eslint-disable-next-line no-underscore-dangle
        this.imageryProvider._reload();
        this._reloadTimeout = null;
      });
    }
  }

  /**
   * rerenders the specified tiles
   * rendering happens async
   * @param {Array<string>} tileIds
   * @api
   */
  updateTiles(tileIds) {
    if (tileIds.length > 0) {
      this._reloadTiles();
    }
  }

  /**
   * @param {import("@vcmap/core").StyleItem} style
   * @param {boolean=} silent
   * @api
   */
  // eslint-disable-next-line no-unused-vars
  updateStyle(style, silent) {
    this._reloadTiles();
  }
}

export default VectorRasterTileCesiumImpl;
