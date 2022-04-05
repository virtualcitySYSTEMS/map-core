import { getLogger as getLoggerByName } from '@vcsuite/logger';
import { VcsClassRegistry } from './classRegistry.js';

/**
 * @returns {import("@vcsuite/logger").Logger}
 */
function getLogger() {
  return getLoggerByName('init');
}

/**
 * @type {symbol}
 */
export const contextIdSymbol = Symbol('contextId');

/**
 * returns a constructor of a type.
 * @api stable
 * @export
 * @param {Object} options
 * @param {...*} args
 * @returns {Promise<Object|null>}
 */
export async function getObjectFromOptions(options, ...args) {
  if (!options.type) {
    getLogger().warning(`ObjectCreation failed: could not find type in options ${options}`);
    return null;
  }
  const ObjectConstructor = await VcsClassRegistry.getClass(options.type);
  if (!ObjectConstructor) {
    getLogger().warning(`ObjectCreation failed: could not find javascript class of type ${options.type}`);
    return null;
  }
  let object;
  try {
    object = new ObjectConstructor(options, ...args);
  } catch (ex) {
    getLogger().warning(`Error: ${ex}`);
  }

  if (!object) {
    getLogger().warning('ObjectCreation failed: could not create new Object');
    return null;
  }
  return object;
}

/**
 * @param {import("@vcmap/core").VcsApp} vcsApp
 * @param {VcsMapOptions} mapConfig
 * @returns {Promise<import("@vcmap/core").VcsMap|null>}
 */
export async function deserializeMap(vcsApp, mapConfig) {
  const map = await getObjectFromOptions(mapConfig);
  if (map) {
    map.layerCollection = vcsApp.layers;
  }
  return map;
}

/**
 * @param {ViewPointOptions} viewPointObject
 * @returns {Promise<null|import("@vcmap/core").ViewPoint>}
 */
export async function deserializeViewPoint(viewPointObject) {
  const viewpoint = /** @type {import("@vcmap/core").ViewPoint} */ (await getObjectFromOptions(viewPointObject));
  if (viewpoint && viewpoint.isValid()) {
    return viewpoint;
  }
  getLogger().warning(`Viewpoint ${viewPointObject.name} is not valid`);
  return null;
}

/**
 * @param {import("@vcmap/core").VcsApp} vcsApp
 * @param {import("@vcmap/core").Layer} layer
 * @returns {LayerOptions}
 */
export function serializeLayer(vcsApp, layer) {
  const serializedLayer = layer.toJSON();
  serializedLayer.zIndex = layer[vcsApp.layers.zIndexSymbol];
  return serializedLayer;
}

/**
 * @param {import("@vcmap/core").Layer} current
 * @param {import("@vcmap/core").Layer} previous
 * @param {number} currentIndex
 * @returns {number|null}
 */
export function getLayerIndex(current, previous, currentIndex) {
  if (current.zIndex !== previous.zIndex) {
    return null;
  }
  return currentIndex;
}

/**
 * @param {import("@vcmap/core").Collection<*>} collection
 */
export function destroyCollection(collection) {
  [...collection].forEach((i) => {
    if (i.destroy && !i.isDestroyed) {
      i.destroy();
    }
  });
  collection.destroy();
}
