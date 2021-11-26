import Tile from 'ol/layer/Tile.js';
import OSM from 'ol/source/OSM.js';
import RasterLayerOpenlayers from './rasterLayerOpenlayers.js';

/**
 * represents a specific OpenStreetMap layer for openlayers.
 * @class
 * @export
 * @extends {RasterLayerOpenlayers}
 */
class OpenStreetMapOpenlayers extends RasterLayerOpenlayers {
  static get className() { return 'vcs.vcm.layer.openlayers.OpenStreetMapOpenlayers'; }

  /**
   * @returns {import("ol/layer/Tile").default}
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
