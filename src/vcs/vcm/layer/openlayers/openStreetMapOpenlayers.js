import Tile from 'ol/layer/Tile.js';
import OSM from 'ol/source/OSM.js';
import RasterLayerOpenlayers from './rasterLayerOpenlayers.js';

/**
 * represents a specific OpenStreetMap layer for openlayers.
 * @class
 * @export
 * @extends {vcs.vcm.layer.openlayers.RasterLayerOpenlayers}
 * @memberOf vcs.vcm.layer.openlayers
 */
class OpenStreetMapOpenlayers extends RasterLayerOpenlayers {
  static get className() { return 'vcs.vcm.layer.openlayers.OpenStreetMapOpenlayers'; }

  /**
   * @returns {ol/layer/Tile}
   */
  getOLLayer() {
    return new Tile({
      opacity: this.opacity,
      source: new OSM({
        maxZoom: this.maxLevel,
      }),
    });
  }
}

export default OpenStreetMapOpenlayers;
