import { VcsClassRegistry } from '../../classRegistry.js';
import TileProvider from './tileProvider.js';
import URLTemplateTileProvider from './urlTemplateTileProvider.js';
import StaticGeoJSONTileProvider from './staticGeojsonTileProvider.js';
import MVTTileProvider from './mvtTileProvider.js';

VcsClassRegistry.registerClass(TileProvider.className, TileProvider);
VcsClassRegistry.registerClass(URLTemplateTileProvider.className, URLTemplateTileProvider);
VcsClassRegistry.registerClass(StaticGeoJSONTileProvider.className, StaticGeoJSONTileProvider);
VcsClassRegistry.registerClass(MVTTileProvider.className, MVTTileProvider);

/**
 * TileProvider
 * @namespace tileProvider
 * @api stable
 */

/**
 * @param {Object} options
 * @returns {Promise<TileProvider>}
 * @api
 * @export
 */
function factory(options) {
  return VcsClassRegistry.create(options.type, options);
}

export default factory;
