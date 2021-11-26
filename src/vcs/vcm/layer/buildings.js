import { VcsClassRegistry } from '../classRegistry.js';
import CesiumTileset from './cesiumTileset.js';

/**
 * represents a specific Building layer for cesium.
 * @class
 * @export
 * @extends {CesiumTileset}
 * @api stable
 */
class Buildings extends CesiumTileset {
  /** @type {string} */
  static get className() { return 'vcs.vcm.layer.Buildings'; }
}

VcsClassRegistry.registerClass(Buildings.className, Buildings);
export default Buildings;
