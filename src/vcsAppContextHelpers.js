import { getLogger as getLoggerByName } from '@vcsuite/logger';
import ViewPoint from './util/viewpoint.js';
import { getObjectFromClassRegistry } from './classRegistry.js';

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
 * @typedef {LayerOptions} ContextLayerOptions
 * @property {string|StyleItemOptions} [style]
 * @property {TileProviderOptions} [tileProvider]
 * @property {AbstractFeatureProviderOptions} [featureProvider]
 */

/**
 * @param {import("@vcmap/core").VcsApp} vcsApp
 * @param {VcsMapOptions} mapConfig
 * @returns {import("@vcmap/core").VcsMap|null}
 */
export function deserializeMap(vcsApp, mapConfig) {
  const map = getObjectFromClassRegistry(vcsApp.mapClassRegistry, mapConfig);
  if (map) {
    map.layerCollection = vcsApp.layers;
  }
  return map;
}

/**
 * @param {ViewPointOptions} viewPointObject
 * @returns {null|import("@vcmap/core").ViewPoint}
 */
export function deserializeViewPoint(viewPointObject) {
  const viewpoint = new ViewPoint(viewPointObject);
  if (viewpoint && viewpoint.isValid()) {
    return viewpoint;
  }
  getLogger().warning(`Viewpoint ${viewPointObject.name} is not valid`);
  return null;
}

/**
 * @param {import("@vcmap/core").VcsApp} vcsApp
 * @param {ContextLayerOptions} layerConfig
 * @returns {import("@vcmap/core").Layer|null}
 */
export function deserializeLayer(vcsApp, layerConfig) {
  let style;
  if (layerConfig.style) {
    if (typeof layerConfig.style === 'string') {
      style = vcsApp.styles.getByKey(layerConfig.style);
    } else {
      style = getObjectFromClassRegistry(vcsApp.styleClassRegistry, layerConfig.style);
    }
  } // TODO highlightStyle

  let tileProvider;
  if (layerConfig.tileProvider) {
    tileProvider = getObjectFromClassRegistry(vcsApp.tileProviderClassRegistry, layerConfig.tileProvider);
  }

  let featureProvider;
  if (layerConfig.featureProvider) {
    featureProvider = getObjectFromClassRegistry(vcsApp.featureProviderClassRegistry, layerConfig.featureProvider);
  }

  return getObjectFromClassRegistry(
    vcsApp.layerClassRegistry,
    { ...layerConfig, style, tileProvider, featureProvider },
  );
}

/**
 * @param {import("@vcmap/core").VcsApp} vcsApp
 * @param {import("@vcmap/core").Layer} layer
 * @returns {ContextLayerOptions}
 */
export function serializeLayer(vcsApp, layer) {
  const serializedLayer = /** @type {ContextLayerOptions} */ (layer.toJSON());
  serializedLayer.zIndex = layer[vcsApp.layers.zIndexSymbol];
  if (
    /** @type {StyleItemOptions} */ (serializedLayer?.style)?.name &&
    vcsApp.styles.hasKey(/** @type {StyleItemOptions} */ (serializedLayer.style).name)
  ) {
    serializedLayer.style = /** @type {StyleItemOptions} */ (serializedLayer.style).name;
  } // TODO highlightStyle
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
