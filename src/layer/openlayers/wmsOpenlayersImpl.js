import Tile from 'ol/layer/Tile.js';
import RasterLayerOpenlayersImpl from './rasterLayerOpenlayersImpl.js';
import { getWMSSource } from '../wmsHelpers.js';

/**
 * represents a specific Cesium WmsOpenlayersImpl Layer class.
 * @class
 * @export
 * @extends {RasterLayerOpenlayersImpl}
 */
class WmsOpenlayersImpl extends RasterLayerOpenlayersImpl {
  static get className() { return 'WmsOpenlayersImpl'; }

  /**
   * @param {import("@vcmap/core").OpenlayersMap} map
   * @param {WMSImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);
    /**
     * @type {Object<string, *>}
     */
    this.parameters = options.parameters;
    /**
     * @type {string}
     */
    this.version = options.version;
    /**
     * @type {import("ol/size").Size}
     */
    this.tileSize = options.tileSize;
  }

  /**
   * @returns {import("ol/layer/Tile").default}
   */
  getOLLayer() {
    return new Tile({
      visible: false,
      source: getWMSSource({
        url: this.url,
        parameters: this.parameters,
        version: this.version,
        extent: this.extent,
        tileSize: this.tileSize,
        minLevel: this.minLevel,
        maxLevel: this.maxLevel,
        tilingSchema: this.tilingSchema,
      }),
      opacity: this.opacity,
    });
  }
}

export default WmsOpenlayersImpl;
