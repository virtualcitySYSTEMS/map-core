import { getTopLeft, getWidth } from 'ol/extent.js';
import WMTSTileGrid from 'ol/tilegrid/WMTS.js';
import Tile from 'ol/layer/Tile.js';
import WMTSSource from 'ol/source/WMTS.js';
import { wgs84Projection, mercatorProjection } from '../../util/projection.js';
import RasterLayerOpenlayersImpl from './rasterLayerOpenlayersImpl.js';
import { TilingScheme } from '../rasterLayer.js';
import { isSameOrigin } from '../../util/urlHelpers.js';

/**
 * WmtsLayer implementation for {@link Openlayers}.
 * @class
 * @export
 * @extends {RasterLayerOpenlayersImpl}
 */
class WmtsOpenlayersImpl extends RasterLayerOpenlayersImpl {
  static get className() { return 'WmtsOpenlayersImpl'; }

  /**
   * @param {import("@vcmap/core").OpenlayersMap} map
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

    /**
     * @type {Object}
     */
    this.openlayersOptions = options.openlayersOptions;
  }

  /**
   * @returns {import("ol/layer/Tile").default}
   */
  getOLLayer() {
    const projection = this.tilingSchema === TilingScheme.GEOGRAPHIC ? wgs84Projection : mercatorProjection;
    const projectionExtent = projection.proj.getExtent();
    let size = getWidth(projectionExtent) / this.tileSize[0];
    if (this.numberOfLevelZeroTilesX > 1) {
      size /= this.numberOfLevelZeroTilesX;
    }
    if (this.tilingSchema === TilingScheme.GEOGRAPHIC) {
      size = getWidth(projectionExtent) / (this.tileSize[0] * 2);
    }

    const maxZoom = this.maxLevel + 1;
    const resolutions = new Array(maxZoom).fill(undefined).map((value, index) => {
      return size / (2 ** index);
    });

    const extent = this.extent.getCoordinatesInProjection(projection);
    const tileGridOptions = {
      origin: getTopLeft(projectionExtent),
      extent,
      resolutions,
      matrixIds: this.matrixIds,
      minZoom: this.minLevel,
      tileSize: this.tileSize,
    };

    if (this.numberOfLevelZeroTilesX > 1 || this.numberOfLevelZeroTilesY > 1) {
      const sizes = [];
      let sizeX = this.numberOfLevelZeroTilesX;
      let sizeY = this.numberOfLevelZeroTilesY;
      for (let i = 0; i <= maxZoom; i++) {
        sizes.push([sizeX, sizeY]);
        sizeX *= 2;
        sizeY *= 2;
      }
      tileGridOptions.sizes = sizes;
    }
    const tileGrid = new WMTSTileGrid(tileGridOptions);

    const requestEncoding = this.url.indexOf('{') >= 0 ? 'REST' : 'KVP';
    const wmtsOptions = {
      tileGrid,
      requestEncoding,
      layer: this.layer,
      style: this.style,
      format: this.format,
      matrixSet: this.tileMatrixSetID,
      url: this.url,
    };

    if (!isSameOrigin(this.url)) {
      wmtsOptions.crossOrigin = 'anonymous';
    }

    if (this.tilingSchema === TilingScheme.GEOGRAPHIC) {
      wmtsOptions.projection = 'EPSG:4326';
    }

    Object.assign(wmtsOptions, this.openlayersOptions);
    return new Tile({
      opacity: this.opacity,
      source: new WMTSSource(wmtsOptions),
    });
  }
}

export default WmtsOpenlayersImpl;
