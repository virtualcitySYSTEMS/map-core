import { unByKey } from 'ol/Observable.js';
import { FeatureVisibilityAction } from './featureVisibility.js';

/**
 * Added to ol.source.Vector to determine, when the source has last had an update to its features visibility.
 * @type {symbol}
 */
export const fvLastUpdated = Symbol('FVlastUpdated');

/**
 * Added to ol.source.Vector to determine, when the source has last had an update to its features global visibility.
 * @type {symbol}
 */
export const globalHiderLastUpdated = Symbol('GlobalHiderLastUpdated');

/**
 * @param {import("@vcmap/core").FeatureVisibility} featureVisibility
 * @param {import("ol/source").Vector<import("ol/geom/Geometry").default>} source
 */
export function updateFeatureVisibility(featureVisibility, source) {
  Object.keys(featureVisibility.highlightedObjects)
    .forEach((id) => {
      const feat = source.getFeatureById(id);
      if (feat && !featureVisibility.hasHighlightFeature(id, feat)) {
        featureVisibility.addHighlightFeature(id, feat);
      }
    });

  Object.keys(featureVisibility.hiddenObjects)
    .forEach((id) => {
      const feat = source.getFeatureById(id);
      if (feat && !featureVisibility.hasHiddenFeature(id, feat)) {
        featureVisibility.addHiddenFeature(id, feat);
      }
    });
  source[fvLastUpdated] = Date.now();
}

/**
 * @param {import("@vcmap/core").GlobalHider} globalHider
 * @param {import("ol/source").Vector<import("ol/geom/Geometry").default>} source
 */
export function updateGlobalHider(globalHider, source) {
  Object.keys(globalHider.hiddenObjects)
    .forEach((id) => {
      const feat = source.getFeatureById(id);
      if (feat && !globalHider.hasFeature(id, feat)) {
        globalHider.addFeature(id, feat);
      }
    });
  source[globalHiderLastUpdated] = Date.now();
}

/**
 * @param {import("@vcmap/core").FeatureVisibility} featureVisibility
 * @param {import("ol/source").Vector<import("ol/geom/Geometry").default>} source
 * @param {import("@vcmap/core").GlobalHider} globalHider
 * @returns {Array<Function>}
 */
export function synchronizeFeatureVisibilityWithSource(featureVisibility, source, globalHider) {
  const sourceListener = source.on('addfeature', ({ feature }) => {
    const id = feature.getId();
    if (featureVisibility.highlightedObjects[id]) {
      featureVisibility.addHighlightFeature(id, feature);
    }

    if (featureVisibility.hiddenObjects[id]) {
      featureVisibility.addHiddenFeature(id, feature);
    }

    if (globalHider.hiddenObjects[id]) {
      globalHider.addFeature(id, feature);
    }
    const now = Date.now();
    source[fvLastUpdated] = now;
    source[globalHiderLastUpdated] = now;
  });

  if (!source[fvLastUpdated] || source[fvLastUpdated] < featureVisibility.lastUpdated) {
    updateFeatureVisibility(featureVisibility, source);
  }

  if (!source[globalHiderLastUpdated] || source[globalHiderLastUpdated] < featureVisibility.lastUpdated) {
    updateGlobalHider(globalHider, source);
  }

  return [
    featureVisibility.changed.addEventListener(({ action, ids }) => {
      if (action === FeatureVisibilityAction.HIGHLIGHT) {
        ids.forEach((id) => {
          const feat = source.getFeatureById(id);
          if (feat) {
            featureVisibility.addHighlightFeature(id, feat);
          }
        });
        source[fvLastUpdated] = Date.now();
      } else if (action === FeatureVisibilityAction.HIDE) {
        ids.forEach((id) => {
          const feat = source.getFeatureById(id);
          if (feat) {
            featureVisibility.addHiddenFeature(id, feat);
          }
        });
        source[fvLastUpdated] = Date.now();
      }
    }),
    globalHider.changed.addEventListener(({ action, ids }) => {
      if (action === FeatureVisibilityAction.HIDE) {
        ids.forEach((id) => {
          const feat = source.getFeatureById(id);
          if (feat) {
            globalHider.addFeature(id, feat);
          }
        });
        source[globalHiderLastUpdated] = Date.now();
      }
    }),
    () => { unByKey(sourceListener); },
  ];
}
