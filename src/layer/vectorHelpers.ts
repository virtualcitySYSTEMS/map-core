import { unByKey } from 'ol/Observable.js';
import type VectorSource from 'ol/source/Vector.js';
import type FeatureVisibility from './featureVisibility.js';
import { FeatureVisibilityAction } from './featureVisibility.js';
import type GlobalHider from './globalHider.js';

/**
 * Added to ol.source.Vector to determine, when the source has last had an update to its features visibility.
 */
export const fvLastUpdated = Symbol('FVlastUpdated');

/**
 * Added to ol.source.Vector to determine, when the source has last had an update to its features global visibility.
 */
export const globalHiderLastUpdated = Symbol('GlobalHiderLastUpdated');

export function updateFeatureVisibility(
  featureVisibility: FeatureVisibility,
  source: VectorSource,
): void {
  Object.keys(featureVisibility.highlightedObjects).forEach((id) => {
    const feat = source.getFeatureById(id);
    if (feat && !featureVisibility.hasHighlightFeature(id, feat)) {
      featureVisibility.addHighlightFeature(id, feat);
    }
  });

  Object.keys(featureVisibility.hiddenObjects).forEach((id) => {
    const feat = source.getFeatureById(id);
    if (feat && !featureVisibility.hasHiddenFeature(id, feat)) {
      featureVisibility.addHiddenFeature(id, feat);
    }
  });
  source[fvLastUpdated] = Date.now();
}

export function updateGlobalHider(
  globalHider: GlobalHider,
  source: VectorSource,
): void {
  Object.keys(globalHider.hiddenObjects).forEach((id) => {
    const feat = source.getFeatureById(id);
    if (feat && !globalHider.hasFeature(id, feat)) {
      globalHider.addFeature(id, feat);
    }
  });
  source[globalHiderLastUpdated] = Date.now();
}

export function synchronizeFeatureVisibilityWithSource(
  featureVisibility: FeatureVisibility,
  source: VectorSource,
  globalHider: GlobalHider,
): (() => void)[] {
  const sourceListener = source.on('addfeature', (event) => {
    if (!event.feature) {
      return;
    }
    const { feature } = event;
    const id = feature.getId() as string | number;
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

  if (
    !source[fvLastUpdated] ||
    source[fvLastUpdated] < featureVisibility.lastUpdated
  ) {
    updateFeatureVisibility(featureVisibility, source);
  }

  if (
    !source[globalHiderLastUpdated] ||
    source[globalHiderLastUpdated] < featureVisibility.lastUpdated
  ) {
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
    (): void => {
      unByKey(sourceListener);
    },
  ];
}
