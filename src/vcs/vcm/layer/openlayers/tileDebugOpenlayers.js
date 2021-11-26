import Tile from 'ol/layer/Tile.js';
import TileDebug from 'ol/source/TileDebug.js';
import LayerOpenlayers from './layerOpenlayers.js';

/**
 * layer Implementation to render tile boundaries.
 * @class
 * @export
 * @extends {LayerOpenlayers}
 * @implements {VectorTileImplementation}
 */
class TileDebugOpenlayers extends LayerOpenlayers {
  static get className() { return 'vcs.vcm.layer.openlayers.TileDebugOpenlayers'; }

  /**
   * @returns {import("ol/layer/Tile").default}
   */
  // eslint-disable-next-line class-methods-use-this
  getOLLayer() {
    return new Tile({
      source: new TileDebug(),
    });
  }

  /**
   * @param {import("@vcmap/core").StyleItem} styleItem
   * @param {boolean} silent
   */
  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  updateStyle(styleItem, silent) {}

  /**
   * @param {Array<string>} args
   */
  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  updateTiles(args) {}
}

export default TileDebugOpenlayers;
