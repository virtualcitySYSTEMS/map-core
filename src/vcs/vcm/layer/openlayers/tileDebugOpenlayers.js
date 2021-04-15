import Tile from 'ol/layer/Tile.js';
import TileDebug from 'ol/source/TileDebug.js';
import LayerOpenlayers from './layerOpenlayers.js';

/**
 * layer Implementation to render tile boundaries.
 * @class
 * @export
 * @extends {vcs.vcm.layer.openlayers.LayerOpenlayers}
 * @memberOf vcs.vcm.layer.openlayers
 * @implements {vcs.vcm.layer.VectorTileImplementation}
 */
class TileDebugOpenlayers extends LayerOpenlayers {
  static get className() { return 'vcs.vcm.layer.openlayers.TileDebugOpenlayers'; }

  /**
   * @returns {ol/layer/Tile}
   */
  // eslint-disable-next-line class-methods-use-this
  getOLLayer() {
    return new Tile({
      source: new TileDebug(),
    });
  }

  // eslint-disable-next-line class-methods-use-this
  updateStyle() {}

  // eslint-disable-next-line class-methods-use-this
  updateTiles() {}
}

export default TileDebugOpenlayers;
