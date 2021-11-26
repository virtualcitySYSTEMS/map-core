import Tile from 'ol/layer/Tile.js';
import RasterLayerOpenlayers from './rasterLayerOpenlayers.js';
import { getWMSSource } from '../wmsHelpers.js';

/**
 * represents a specific Cesium WMSOpenlayers Layer class.
 * @class
 * @export
 * @extends {RasterLayerOpenlayers}
 */
class WMSOpenlayers extends RasterLayerOpenlayers {
  static get className() { return 'vcs.vcm.layer.openlayers.WMSOpenlayers'; }

  /**
   * @param {import("@vcmap/core").Openlayers} map
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

export default WMSOpenlayers;
