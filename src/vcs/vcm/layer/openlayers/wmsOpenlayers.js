import Tile from 'ol/layer/Tile.js';
import RasterLayerOpenlayers from './rasterLayerOpenlayers.js';
import { getWMSSource } from '../wmsHelpers.js';

/**
 * represents a specific Cesium WMSOpenlayers Layer class.
 * @class
 * @export
 * @extends {vcs.vcm.layer.openlayers.RasterLayerOpenlayers}
 * @memberOf vcs.vcm.layer.openlayers
 */
class WMSOpenlayers extends RasterLayerOpenlayers {
  static get className() { return 'vcs.vcm.layer.openlayers.WMSOpenlayers'; }

  /**
   * @param {vcs.vcm.maps.Openlayers} map
   * @param {vcs.vcm.layer.WMS.ImplementationOptions} options
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
     * @type {ol/Size}
     */
    this.tileSize = options.tileSize;
  }

  /**
   * @returns {ol/layer/Tile}
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
