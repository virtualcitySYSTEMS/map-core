import {
  Color,
  Cesium3DTileFeature,
  Cesium3DTilePointFeature,
  Entity as CesiumEntity,
} from '@vcmap-cesium/engine';
import { is } from '@vcsuite/check';
import Feature from 'ol/Feature.js';
import type { StyleFunction } from 'ol/style/Style.js';
import Style from 'ol/style/Style.js';

import VectorStyleItem, { fromCesiumColor } from '../style/vectorStyleItem.js';
import VcsEvent from '../vcsEvent.js';

/**
 * Set on an ol.Feature or Cesium.Cesium3DTileFeature to indicate that this features is highlighted.
 * Its value is a {@link VectorStyleItem}.
 */
export const highlighted = Symbol('highlighted');

/**
 * Is a boolean value set on ol.Feature or Cesium.Cesium3DTileFeature to indicate it is hidden
 * by the layers {@link FeatureVisibility}.
 */
export const hidden = Symbol('hidden');

/**
 * Is a boolean value set on ol.Feature or Cesium.Cesium3DTileFeature to indicate it is hidden
 * by the {@link GlobalHider}
 */
export const globalHidden = Symbol('globalHidden');

export type HighlightableFeature =
  Feature | Cesium3DTileFeature | Cesium3DTilePointFeature | CesiumEntity;

/**
 * Enumeration of feature visibility actions.
 */
export enum FeatureVisibilityAction {
  HIGHLIGHT = 1,
  UNHIGHLIGHT = 2,
  HIDE = 3,
  SHOW = 4,
}

export type HighlightedObject = {
  style: VectorStyleItem;
  features: Set<HighlightableFeature>;
};

export type FeatureVisibilityEvent = {
  action: FeatureVisibilityAction;
  ids: (string | number)[];
};

export type HighlightStyleType =
  VectorStyleItem | Color | Style | StyleFunction;

export function featureExists(
  feature: Cesium3DTileFeature | Cesium3DTilePointFeature,
): boolean {
  return (
    feature &&
    feature.content &&
    !feature.content.isDestroyed() &&
    !feature.content.batchTable.isDestroyed()
  );
}

export function hideFeature(feature: HighlightableFeature): void {
  if (
    ((feature instanceof Cesium3DTileFeature ||
      feature instanceof Cesium3DTilePointFeature) &&
      featureExists(feature)) ||
    feature instanceof CesiumEntity
  ) {
    feature.show = false;
  } else if (feature instanceof Feature) {
    feature.changed();
  }
}

/**
 * Triggers a re-render of an ol.Feature, once it is no longer hidden or highlighted.
 * Rendering then falls back to the features own style, since the `getStyleFunction` override of the ol.Feature prototype
 * (or the style function of a VectorTileLayer) only applies the highlight or hidden style while the respective symbols are set.
 */
function resetFeature(feature: HighlightableFeature): void {
  if (!(feature[globalHidden] || feature[hidden] || feature[highlighted])) {
    if (feature instanceof Feature) {
      feature.changed();
    }
  }
}

export function highlightFeature(feature: HighlightableFeature): void {
  if (!(feature[globalHidden] || feature[hidden])) {
    const style = feature[highlighted];
    if (
      (feature instanceof Cesium3DTileFeature ||
        feature instanceof Cesium3DTilePointFeature) &&
      featureExists(feature) &&
      style
    ) {
      feature.color = style.cesiumFillColor as Color;
    } else if (feature instanceof Feature) {
      feature.changed();
    }
  }
}

function unhighlightFeature(feature: HighlightableFeature): void {
  delete feature[highlighted];
  resetFeature(feature);
}

export function showFeature(
  feature: HighlightableFeature,
  symbol: keyof HighlightableFeature,
): void {
  delete feature[symbol];

  if (!(feature[hidden] || feature[globalHidden])) {
    if (
      ((feature instanceof Cesium3DTileFeature ||
        feature instanceof Cesium3DTilePointFeature) &&
        featureExists(feature)) ||
      feature instanceof CesiumEntity
    ) {
      feature.show = true;
    }
    if (feature[highlighted]) {
      highlightFeature(feature);
    } else {
      resetFeature(feature);
    }
  }
}

export function synchronizeFeatureVisibility(
  source: FeatureVisibility,
  destination: FeatureVisibility,
): () => void {
  function handler({ action, ids }: FeatureVisibilityEvent): void {
    if (action === FeatureVisibilityAction.HIGHLIGHT) {
      const toHighlight: Record<string, VectorStyleItem> = {};
      ids.forEach((id) => {
        toHighlight[id] = source.highlightedObjects[id].style;
      });
      destination.highlight(toHighlight);
    } else if (action === FeatureVisibilityAction.UNHIGHLIGHT) {
      destination.unHighlight(ids);
    } else if (action === FeatureVisibilityAction.HIDE) {
      destination.hideObjects(ids);
    } else if (action === FeatureVisibilityAction.SHOW) {
      destination.showObjects(ids);
    }
  }

  const toHighlight = Object.keys(source.highlightedObjects);
  if (toHighlight.length > 0) {
    handler({ action: FeatureVisibilityAction.HIGHLIGHT, ids: toHighlight });
  }

  const toHide = Object.keys(source.hiddenObjects);
  if (toHide.length > 0) {
    handler({ action: FeatureVisibilityAction.HIDE, ids: toHide });
  }

  return source.changed.addEventListener(handler);
}

/**
 * FeatureVisibility handles the visibility and highlighting of features of a specific {@link FeatureLayer} or {@link DataSourceLayer}
 * and its {@link FeatureLayerImplementation} resp. {@link DataSourceCesiumImpl}.
 * The visibility is being synchronized with the {@link GlobalHider}.
 */
class FeatureVisibility {
  hiddenObjects: Record<string, Set<HighlightableFeature>> = {};

  highlightedObjects: Record<string, HighlightedObject> = {};

  lastUpdated: number = Date.now();

  /**
   * An event raised when the hidden or highlighted ids change. Is called with
   * {@link FeatureVisibilityEvent} as its only argument
   */
  changed = new VcsEvent<FeatureVisibilityEvent>();

  /**
   * highlights a number of features by ID (import("@vcmap-cesium/engine").Cesium3DTileFeature|ol/Feature) with the given color.
   */
  highlight(toHighlight: Record<string, HighlightStyleType>): void {
    const updatedIds: string[] = [];
    Object.entries(toHighlight).forEach(([id, style]) => {
      let usedStyle: VectorStyleItem;
      if (style instanceof Color) {
        usedStyle = fromCesiumColor(style);
      } else if (style instanceof Style) {
        usedStyle = new VectorStyleItem({});
        const text = style.getText()?.getText();
        if (text && !Array.isArray(text)) {
          // getText can return a rich Text string[] We do not support this at the moment.
          usedStyle.label = text;
        }
        usedStyle.style = style;
      } else if (is(style, Function)) {
        usedStyle = new VectorStyleItem({});
        usedStyle.style = style;
      } else {
        usedStyle = style;
      }

      if (!this.highlightedObjects[id]) {
        this.highlightedObjects[id] = {
          style: usedStyle,
          features: new Set(),
        };
        updatedIds.push(id);
      } else if (this.highlightedObjects[id].style !== usedStyle) {
        this.highlightedObjects[id].style = usedStyle;
        this.highlightedObjects[id].features.forEach((_s, feature) => {
          feature[highlighted] = usedStyle;
          highlightFeature(feature);
        });
      }
    });

    if (updatedIds.length > 0) {
      this.lastUpdated = Date.now();
      this.changed.raiseEvent({
        action: FeatureVisibilityAction.HIGHLIGHT,
        ids: updatedIds,
      });
    }
  }

  /**
   * unhighlights a number of features given by the ID (import("@vcmap-cesium/engine").Cesium3DTileFeature|import("ol").Feature<import("ol/geom/Geometry").default>)
   * @param  toUnHighlight Array with IDS to unhighlight
   */
  unHighlight(toUnHighlight: (string | number)[]): void {
    const updatedIds: (string | number)[] = [];
    toUnHighlight.forEach((id) => {
      if (this.highlightedObjects[id]) {
        this.highlightedObjects[id].features.forEach((f) => {
          unhighlightFeature(f);
        });
        delete this.highlightedObjects[id];
        updatedIds.push(id);
      }
    });

    if (updatedIds.length > 0) {
      this.changed.raiseEvent({
        action: FeatureVisibilityAction.UNHIGHLIGHT,
        ids: updatedIds,
      });
    }
  }

  /**
   * clears all highlighted objects
   */
  clearHighlighting(): void {
    this.unHighlight(Object.keys(this.highlightedObjects));
  }

  hasHighlightFeature(
    id: string | number,
    feature: HighlightableFeature,
  ): boolean {
    return (
      this.highlightedObjects[id] &&
      this.highlightedObjects[id].features.has(feature)
    );
  }

  addHighlightFeature(
    id: string | number,
    feature: HighlightableFeature,
  ): void {
    if (this.highlightedObjects[id]) {
      this.highlightedObjects[id].features.add(feature);
      feature[highlighted] = this.highlightedObjects[id].style;
      highlightFeature(feature);
    }
  }

  /**
   * hides a number of objects
   * @param  toHide A list of Object Ids which will be hidden
   */
  hideObjects(toHide: (string | number)[]): void {
    const updatedIds: string[] = [];
    toHide.forEach((id) => {
      if (!this.hiddenObjects[id]) {
        this.hiddenObjects[id] = new Set();
        updatedIds.push(String(id));
      }
    });

    if (updatedIds.length > 0) {
      this.lastUpdated = Date.now();
      this.changed.raiseEvent({
        action: FeatureVisibilityAction.HIDE,
        ids: updatedIds,
      });
    }
  }

  /**
   * unHides a number of objects
   * @param  unHide A list of Object Ids which will be unHidden
   */
  showObjects(unHide: (string | number)[]): void {
    const updatedIds: string[] = [];
    unHide.forEach((id) => {
      if (this.hiddenObjects[id]) {
        this.hiddenObjects[id].forEach((f) => {
          showFeature(f, hidden);
        });
        delete this.hiddenObjects[id];
        updatedIds.push(String(id));
      }
    });

    if (updatedIds.length > 0) {
      this.changed.raiseEvent({
        action: FeatureVisibilityAction.SHOW,
        ids: updatedIds,
      });
    }
  }

  /**
   * clears all the hidden objects
   */
  clearHiddenObjects(): void {
    this.showObjects(Object.keys(this.hiddenObjects));
  }

  hasHiddenFeature(
    id: string | number,
    feature: HighlightableFeature,
  ): boolean {
    return this.hiddenObjects[id] && this.hiddenObjects[id].has(feature);
  }

  addHiddenFeature(id: string | number, feature: HighlightableFeature): void {
    if (this.hiddenObjects[id]) {
      this.hiddenObjects[id].add(feature);
      feature[hidden] = true;
      hideFeature(feature);
    }
  }

  /**
   * Clears all caches and removes cesium events.
   */
  destroy(): void {
    Object.values(this.hiddenObjects).forEach((s) => {
      s.clear();
    });
    this.hiddenObjects = {};
    Object.values(this.highlightedObjects).forEach(({ features }) => {
      features.clear();
    });
    this.highlightedObjects = {};
    this.changed.destroy();
  }
}

export default FeatureVisibility;
