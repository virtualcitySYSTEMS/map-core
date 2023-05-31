import Tile from 'ol/layer/Tile.js';
import TileDebug from 'ol/source/TileDebug.js';
import LayerOpenlayersImpl from './layerOpenlayersImpl.js';
import { VectorTileImplementation } from '../vectorTileLayer.js';
import type StyleItem from '../../style/styleItem.js';

/**
 * layer Implementation to render tile boundaries.
 */
class TileDebugOpenlayersImpl
  extends LayerOpenlayersImpl
  implements VectorTileImplementation
{
  static get className(): string {
    return 'TileDebugOpenlayersImpl';
  }

  // eslint-disable-next-line class-methods-use-this
  getOLLayer(): Tile<TileDebug> {
    return new Tile({
      source: new TileDebug(),
    });
  }

  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  updateStyle(_styleItem: StyleItem, _silent?: boolean): void {}

  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  updateTiles(_args: string[]): void {}
}

export default TileDebugOpenlayersImpl;
