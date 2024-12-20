import Tile from 'ol/layer/Tile.js';
import OSM from 'ol/source/OSM.js';
import RasterLayerOpenlayersImpl from './rasterLayerOpenlayersImpl.js';

/**
 * represents a specific OpenStreetMapLayer layer for openlayers.
 */
class OpenStreetMapOpenlayersImpl extends RasterLayerOpenlayersImpl {
  static get className(): string {
    return 'OpenStreetMapOpenlayersImpl';
  }

  getOLLayer(): Tile<OSM> {
    return new Tile({
      opacity: this.opacity,
      source: new OSM({
        maxZoom: this.maxLevel,
      }),
      minZoom: this.minRenderingLevel,
      maxZoom: this.maxRenderingLevel,
    });
  }
}

export default OpenStreetMapOpenlayersImpl;
