import { Rectangle, WebMapTileServiceImageryProvider, ImageryLayer as CesiumImageryLayer } from '@vcmap/cesium';
import RasterLayerCesium from './rasterLayerCesium.js';
import { wgs84Projection } from '../../util/projection.js';
import { getTilingScheme } from '../rasterLayer.js';

/**
 * represents a specific WMTS Implementation for {@link vcs.vcm.maps.CesiumMap}.
 * @class
 * @export
 * @extends {vcs.vcm.layer.cesium.RasterLayerCesium}
 * @memberOf vcs.vcm.layer.cesium
 */
class WMTSCesium extends RasterLayerCesium {
  static get className() { return 'vcs.vcm.layer.cesium.WMTSCesium'; }

  /**
   * @param {vcs.vcm.maps.CesiumMap} map
   * @param {vcs.vcm.layer.WMTS.ImplementationOptions} options
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
     * @type {ol/Size}
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
   * @returns {Cesium/ImageryLayer}
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

export default WMTSCesium;
