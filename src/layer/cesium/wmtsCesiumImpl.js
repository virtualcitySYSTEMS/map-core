import { Rectangle, WebMapTileServiceImageryProvider, ImageryLayer as CesiumImageryLayer } from '@vcmap/cesium';
import RasterLayerCesiumImpl from './rasterLayerCesiumImpl.js';
import { wgs84Projection } from '../../util/projection.js';
import { getTilingScheme } from '../rasterLayer.js';

/**
 * represents a specific WmtsLayer Implementation for {@link CesiumMap}.
 * @class
 * @export
 * @extends {RasterLayerCesiumImpl}
 */
class WmtsCesiumImpl extends RasterLayerCesiumImpl {
  static get className() { return 'WmtsCesiumImpl'; }

  /**
   * @param {import("@vcmap/core").CesiumMap} map
   * @param {WMTSImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);

    /**
     * @type {string}
     */
    this.layer = options.layer;

    /**
     * @type {string}
     */
    this.style = options.style;

    /**
     * @type {string}
     */
    this.format = options.format;

    /**
     * @type {string}
     */
    this.tileMatrixSetID = options.tileMatrixSetID;

    /**
     * @type {import("ol/size").Size}
     */
    this.tileSize = options.tileSize;

    /**
     * @type {number}
     */
    this.numberOfLevelZeroTilesX = options.numberOfLevelZeroTilesX;

    /**
     * @type {number}
     */
    this.numberOfLevelZeroTilesY = options.numberOfLevelZeroTilesY;

    /**
     * @type {Array<string>}
     */
    this.matrixIds = options.matrixIds;
  }


  /**
   * @returns {import("@vcmap/cesium").ImageryLayer}
   */
  getCesiumLayer() {
    // This is a bug in Cesium, they cant cope with {Layer} placeholder..
    const url = this.url.indexOf('{Layer}') !== -1 ? this.url.replace('{Layer}', this.layer) : this.url;
    const extent = this.extent.getCoordinatesInProjection(wgs84Projection);
    const options = {
      url,
      layer: this.layer,
      style: this.style,
      format: this.format,
      tileMatrixSetID: this.tileMatrixSetID,
      maximumLevel: this.maxLevel,
      rectangle: Rectangle.fromDegrees(extent[0], extent[1], extent[2], extent[3]),
      tileWidth: this.tileSize[0],
      tileHeight: this.tileSize[1],
    };


    options.tilingScheme = getTilingScheme({
      tilingSchema: this.tilingSchema,
      numberOfLevelZeroTilesX: this.numberOfLevelZeroTilesX,
      numberOfLevelZeroTilesY: this.numberOfLevelZeroTilesY,
    });

    options.tileMatrixLabels = this.matrixIds;

    const imageryProvider = new WebMapTileServiceImageryProvider(options);
    const layerOptions = {
      alpha: this.opacity,
      splitDirection: this.splitDirection,
    };
    return new CesiumImageryLayer(imageryProvider, layerOptions);
  }
}

export default WmtsCesiumImpl;
