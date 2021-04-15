import { VcsClassRegistry } from '../../classRegistry.js';
import TileProvider from './tileProvider.js';
import URLTemplateTileProvider from './urlTemplateTileProvider.js';
import StaticGeojsonTileProvider from './staticGeojsonTileProvider.js';
import MVTTileProvider from './mvtTileProvider.js';

VcsClassRegistry.registerClass(TileProvider.className, TileProvider);
VcsClassRegistry.registerClass(URLTemplateTileProvider.className, URLTemplateTileProvider);
VcsClassRegistry.registerClass(StaticGeojsonTileProvider.className, StaticGeojsonTileProvider);
VcsClassRegistry.registerClass(MVTTileProvider.className, MVTTileProvider);

/**
 * TileProvider
 * @namespace tileProvider
 * @memberOf vcs.vcm.layer
 * @api stable
 */

/**
 * @param {Object} options
 * @returns {Promise<vcs.vcm.layer.tileProvider.TileProvider>}
 * @api
 * @memberOf vcs.vcm.layer.tileProvider
 * @export
 */
function factory(options) {
  return VcsClassRegistry.create(options.type, options);
}

export default factory;
