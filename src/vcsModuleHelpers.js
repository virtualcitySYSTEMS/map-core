import { getLogger as getLoggerByName } from '@vcsuite/logger';
import Viewpoint from './util/viewpoint.js';
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
export const moduleIdSymbol = Symbol('moduleId');

/**
 * @typedef {LayerOptions} ModuleLayerOptions
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
 * @param {ViewpointOptions} viewpointObject
 * @returns {null|import("@vcmap/core").Viewpoint}
 */
export function deserializeViewpoint(viewpointObject) {
  const viewpoint = new Viewpoint(viewpointObject);
  if (viewpoint && viewpoint.isValid()) {
    return viewpoint;
  }
  getLogger().warning(`Viewpoint ${viewpointObject.name} is not valid`);
  return null;
}

/**
 * @param {import("@vcmap/core").VcsApp} vcsApp
 * @param {ModuleLayerOptions} layerConfig
 * @returns {import("@vcmap/core").Layer|null}
 */
export function deserializeLayer(vcsApp, layerConfig) {
  let style;
  if (layerConfig.style) {
    if (typeof layerConfig.style === 'string') {
      style = vcsApp.styles.getByKey(layerConfig.style);
    } else {
      style = getObjectFromClassRegistry(
        vcsApp.styleClassRegistry,
        layerConfig.style,
      );
    }
  } // TODO highlightStyle

  let tileProvider;
  if (layerConfig.tileProvider) {
    tileProvider = getObjectFromClassRegistry(
      vcsApp.tileProviderClassRegistry,
      layerConfig.tileProvider,
    );
  }

  let featureProvider;
  if (layerConfig.featureProvider) {
    featureProvider = getObjectFromClassRegistry(
      vcsApp.featureProviderClassRegistry,
      layerConfig.featureProvider,
    );
  }

  return getObjectFromClassRegistry(vcsApp.layerClassRegistry, {
    ...layerConfig,
    style,
    tileProvider,
    featureProvider,
  });
}

/**
 * @param {import("@vcmap/core").VcsApp} vcsApp
 * @param {import("@vcmap/core").Layer} layer
 * @returns {ModuleLayerOptions}
 */
export function serializeLayer(vcsApp, layer) {
  const serializedLayer = /** @type {ModuleLayerOptions} */ (layer.toJSON());
  serializedLayer.zIndex = layer[vcsApp.layers.zIndexSymbol];
  if (
    /** @type {StyleItemOptions} */ (serializedLayer?.style)?.name &&
    vcsApp.styles.hasKey(
      /** @type {StyleItemOptions} */ (serializedLayer.style).name,
    )
  ) {
    serializedLayer.style = /** @type {StyleItemOptions} */ (
      serializedLayer.style
    ).name;
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
