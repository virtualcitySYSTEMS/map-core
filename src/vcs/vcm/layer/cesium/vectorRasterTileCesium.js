import CesiumImageryLayer from '@vcmap/cesium/Source/Scene/ImageryLayer.js';
import Rectangle from '@vcmap/cesium/Source/Core/Rectangle.js';
import VectorTileImageryProvider from './vectorTileImageryProvider.js';
import RasterLayerCesium from './rasterLayerCesium.js';
import { wgs84Projection } from '../../util/projection.js';

/**
 * represents a rasterized tiled vector layer implementation for cesium.
 * @class
 * @export
 * @extends {vcs.vcm.layer.RasterLayerCesium}
 * @implements {vcs.vcm.layer.VectorTileImplementation}
 * @memberOf vcs.vcm.layer.cesium
 */
class VectorRasterTileCesium extends RasterLayerCesium {
  static get className() {
    return 'vcs.vcm.layer.cesium.VectorRasterTileCesium';
  }

  /**
   * @param {vcs.vcm.maps.CesiumMap} map
   * @param {vcs.vcm.layer.VectorTile.ImplementationOptions} options
   */
  constructor(map, options) {
    /** @type {vcs.vcm.layer.RasterLayer.ImplementationOptions} */
    const rasterLayerOptions = {
      ...options,
      tilingSchema: 'mercator',
      splitDirection: undefined,
      opacity: undefined,
    };
    super(map, rasterLayerOptions);
    /** @type {vcs.vcm.layer.tileProvider.TileProvider} */
    this.tileProvider = options.tileProvider;

    /**
     * @type {ol/Size}
     */
    this.tileSize = options.tileSize;

    /**
     * @type {number|null}
     * @private
     */
    this._reloadTimeout = null;

    /**
     * @type {vcs.vcm.layer.cesium.VectorTileImageryProvider}
     */
    this.imageryProvider = null;
  }

  /**
   * @returns {Cesium/ImageryLayer}
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
   * @param {vcs.vcm.util.style.StyleItem} style
   * @param {boolean=} silent
   * @api
   */
  // eslint-disable-next-line no-unused-vars
  updateStyle(style, silent) {
    this._reloadTiles();
  }
}

export default VectorRasterTileCesium;
