import Tile from 'ol/layer/Tile.js';
import TileDebug from 'ol/source/TileDebug.js';
import LayerOpenlayersImpl from './layerOpenlayersImpl.js';

/**
 * layer Implementation to render tile boundaries.
 * @class
 * @export
 * @extends {LayerOpenlayersImpl}
 * @implements {VectorTileImplementation}
 */
class TileDebugOpenlayersImpl extends LayerOpenlayersImpl {
  static get className() { return 'TileDebugOpenlayersImpl'; }

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

export default TileDebugOpenlayersImpl;
