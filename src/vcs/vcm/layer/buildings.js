import CesiumTileset from './cesiumTileset.js';

/**
 * represents a specific Building layer for cesium.
 * @class
 * @export
 * @extends {vcs.vcm.layer.CesiumTileset}
 * @api stable
 * @memberOf vcs.vcm.layer
 */
class Buildings extends CesiumTileset {
  /** @type {string} */
  static get className() { return 'vcs.vcm.layer.Buildings'; }
}


export default Buildings;
