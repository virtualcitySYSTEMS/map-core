import Tile from 'ol/layer/Tile.js';
import OSM from 'ol/source/OSM.js';
import RasterLayerOpenlayersImpl from './rasterLayerOpenlayersImpl.js';

/**
 * represents a specific OpenStreetMapLayer layer for openlayers.
 * @class
 * @export
 * @extends {RasterLayerOpenlayersImpl}
 */
class OpenStreetMapOpenlayersImpl extends RasterLayerOpenlayersImpl {
  static get className() { return 'OpenStreetMapOpenlayersImpl'; }

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

export default OpenStreetMapOpenlayersImpl;
