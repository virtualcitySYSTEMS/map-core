import { Color, Cesium3DTileFeature, Cesium3DTilePointFeature, Entity as CesiumEntity } from '@vcmap/cesium';
import Feature from 'ol/Feature.js';
import Style from 'ol/style/Style.js';

import VectorStyleItem, { fromCesiumColor } from '../style/vectorStyleItem.js';
import { emptyStyle } from '../style/styleHelpers.js';
import VcsEvent from '../vcsEvent.js';

/**
 * Set on an ol.Feature or Cesium.Cesium3DTileFeature to indicate its style before it was hidden or highlighted.
 * Can be undefined or ol.style.Style for ol.Features and Cesium.Color for Cesium.Cesium3DTileFeatures.
 * @type {symbol}
 */
export const originalStyle = Symbol('originalStyle');

/**
 * Set on an ol.Feature or Cesium.Cesium3DTileFeature to indicate that this features is highlighted.
 * Its value is a {@link VectorStyleItem}.
 * @type {symbol}
 */
export const highlighted = Symbol('highlighted');

/**
 * Is a boolean value set on ol.Feature or Cesium.Cesium3DTileFeature to indicate it is hidden
 * by the layers {@link FeatureVisibility}.
 * @type {symbol}
 */
export const hidden = Symbol('hidden');

/**
 * Is a boolean value set on ol.Feature or Cesium.Cesium3DTileFeature to indicate it is hidden
 * by the {@link GlobalHider}
 * @type {symbol}
 */
export const globalHidden = Symbol('globalHidden');

/**
 * @typedef {Object} HighlightedObject
 * @property {VectorStyleItem} style
 * @property {Set<import("ol").Feature<import("ol/geom/Geometry").default>|import("@vcmap/cesium").Cesium3DTileFeature|import("@vcmap/cesium").Cesium3DTilePointFeature>} features
 */

/**
 * @typedef {Object} FeatureVisibilityEvent
 * @property {FeatureVisibilityAction} action
 * @property {Array<string>} ids
 * @api
 */

/**
 * @param {import("@vcmap/cesium").Cesium3DTileFeature|import("@vcmap/cesium").Cesium3DTilePointFeature} feature
 * @returns {boolean}
 */
export function featureExists(feature) {
  return feature &&
    feature.content &&
    !feature.content.isDestroyed() &&
    !feature.content.batchTable.isDestroyed();
}

/**
 * @param {import("@vcmap/cesium").Cesium3DTileFeature|import("@vcmap/cesium").Cesium3DTilePointFeature|import("ol").Feature<import("ol/geom/Geometry").default>|import("@vcmap/cesium").Entity} feature
 * @private
 */
export function hideFeature(feature) {
  if (
    (
      (feature instanceof Cesium3DTileFeature || feature instanceof Cesium3DTilePointFeature) &&
      featureExists(feature)
    ) || feature instanceof CesiumEntity
  ) {
    feature.show = false;
  } else if (feature instanceof Feature) {
    feature.setStyle(emptyStyle.clone());
  }
}

/**
 * Caches the original style on the feature using the originalStyle symbol
 * @param {import("@vcmap/cesium").Cesium3DTileFeature|import("@vcmap/cesium").Cesium3DTilePointFeature|import("ol").Feature<import("ol/geom/Geometry").default>|import("@vcmap/cesium").Entity} feature
 * @private
 */
export function cacheOriginalStyle(feature) {
  if (!Reflect.has(feature, originalStyle)) {
    if (
      (feature instanceof Cesium3DTileFeature || feature instanceof Cesium3DTilePointFeature) &&
      featureExists(feature)
    ) {
      feature[originalStyle] = feature.color.clone();
    } else if (feature instanceof Feature) {
      feature[originalStyle] = feature.getStyle();
    }
  }
}

/**
 * @param {import("@vcmap/cesium").Cesium3DTileFeature|import("@vcmap/cesium").Cesium3DTilePointFeature|import("ol").Feature<import("ol/geom/Geometry").default>|import("@vcmap/cesium").Entity} feature
 * @private
 */
export function resetOriginalStyle(feature) {
  if (!(feature[globalHidden] || feature[hidden] || feature[highlighted])) {
    const style = feature[originalStyle];
    if (
      (feature instanceof Cesium3DTileFeature || feature instanceof Cesium3DTilePointFeature) &&
      featureExists(feature)
    ) {
      feature.color = style;
    } else if (feature instanceof Feature) {
      feature.setStyle(style);
    }
    delete feature[originalStyle];
  }
}

/**
 * @param {import("@vcmap/cesium").Cesium3DTileFeature|import("@vcmap/cesium").Cesium3DTilePointFeature|import("ol").Feature<import("ol/geom/Geometry").default>|import("@vcmap/cesium").Entity} feature
 * @private
 */
export function highlightFeature(feature) {
  if (!(feature[globalHidden] || feature[hidden])) {
    const style = feature[highlighted];
    if (
      (feature instanceof Cesium3DTileFeature || feature instanceof Cesium3DTilePointFeature) &&
      featureExists(feature)
    ) {
      feature.color = style.cesiumFillColor;
    } else if (feature instanceof Feature) {
      feature.setStyle(/** @type {import("ol/style/Style").default} */ (style.style));
    }
  }
}

/**
 * Updates the cached original style
 * @param {import("@vcmap/cesium").Cesium3DTileFeature|import("@vcmap/cesium").Cesium3DTilePointFeature|import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @private
 */
export function updateOriginalStyle(feature) {
  delete feature[originalStyle];
  cacheOriginalStyle(feature);
  if (feature[hidden] || feature[globalHidden]) {
    hideFeature(feature);
  } else if (feature[highlighted]) {
    highlightFeature(feature);
  }
}

/**
 * @param {import("@vcmap/cesium").Cesium3DTileFeature|import("@vcmap/cesium").Cesium3DTilePointFeature|import("ol").Feature<import("ol/geom/Geometry").default>} feature
 */
function unhighlightFeature(feature) {
  delete feature[highlighted];
  resetOriginalStyle(feature);
}

/**
 * @param {import("@vcmap/cesium").Cesium3DTileFeature|import("@vcmap/cesium").Cesium3DTilePointFeature|import("ol").Feature<import("ol/geom/Geometry").default>|import("@vcmap/cesium").Entity} feature
 * @param {symbol} symbol
 * @private
 */
export function showFeature(feature, symbol) {
  delete feature[symbol];

  if (!(feature[hidden] || feature[globalHidden])) {
    if (
      (
        (feature instanceof Cesium3DTileFeature || feature instanceof Cesium3DTilePointFeature) &&
        featureExists(feature)
      ) || feature instanceof CesiumEntity
    ) {
      feature.show = true;
    }
    if (feature[highlighted]) {
      highlightFeature(feature);
    } else {
      resetOriginalStyle(feature);
    }
  }
}

/**
 * Enumeration of feature visibility actions.
 * @enum {number}
 * @export
 * @api
 * @property {number} HIGHLIGHT
 * @property {number} UNHIGHLIGHT
 * @property {number} HIDE
 * @property {number} SHOW
 */
export const FeatureVisibilityAction = {
  HIGHLIGHT: 1,
  UNHIGHLIGHT: 2,
  HIDE: 3,
  SHOW: 4,
};

/**
 * @param {FeatureVisibility} source
 * @param {FeatureVisibility} destination
 * @returns {Function}
 */
export function synchronizeFeatureVisibility(source, destination) {
  function handler({ action, ids }) {
    if (action === FeatureVisibilityAction.HIGHLIGHT) {
      /** @type {Object<string, VectorStyleItem>} */
      const toHighlight = {};
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
 * @class
 */
class FeatureVisibility {
  constructor() {
    /** @type {Object<string, Set<(import("@vcmap/cesium").Cesium3DTileFeature|import("ol").Feature<import("ol/geom/Geometry").default>|import("@vcmap/cesium").Entity)>>} */
    this.hiddenObjects = {};
    /** @type {Object<string, HighlightedObject>} */
    this.highlightedObjects = {};
    /** @type {number} */
    this.lastUpdated = Date.now();
    /**
     * An event raised when the hidden or highlighted ids change. Is called with
     * {@link FeatureVisibilityEvent} as its only argument
     * @type {VcsEvent<FeatureVisibilityEvent>}
     */
    this.changed = new VcsEvent();
  }

  /**
   * highlights a number of features by ID (import("@vcmap/cesium").Cesium3DTileFeature|ol/Feature) with the given color.
   * @param {Object<string, (VectorStyleItem|import("@vcmap/cesium").Color|import("ol/style/Style").default)>} toHighlight
   * @api stable
   */
  highlight(toHighlight) {
    const updatedIds = [];
    Object.entries(toHighlight)
      .forEach(([id, style]) => {
        let usedStyle = style;
        if (style instanceof Color) {
          usedStyle = fromCesiumColor(style);
        } else if (style instanceof Style) {
          usedStyle = new VectorStyleItem({});
          if (style.getText() && style.getText().getText() && !Array.isArray(style.getText().getText())) {
            // getText can return a rich Text Array<string> We do not support this at the moment.
            usedStyle.label = String(style.getText().getText());
          }
          usedStyle.style = style;
        }
        // eslint-disable-next-line no-self-assign
        usedStyle = /** @type {VectorStyleItem} */ (usedStyle);

        if (!this.highlightedObjects[id]) {
          this.highlightedObjects[id] = {
            style: usedStyle,
            features: new Set(),
          };
          updatedIds.push(id);
          // @ts-ignore
        } else if (this.highlightedObjects[id].style !== usedStyle) {
          this.highlightedObjects[id].style = usedStyle;
          this.highlightedObjects[id].features.forEach((s, feature) => {
            feature[highlighted] = usedStyle;
            highlightFeature(feature);
          });
        }
      });

    if (updatedIds.length > 0) {
      this.lastUpdated = Date.now();
      this.changed.raiseEvent({ action: FeatureVisibilityAction.HIGHLIGHT, ids: updatedIds });
    }
  }

  /**
   * unhighlights a number of features given by the ID (import("@vcmap/cesium").Cesium3DTileFeature|import("ol").Feature<import("ol/geom/Geometry").default>)
   * @param {Array<string>} toUnHighlight Array with IDS to unhighlight
   * @api stable
   */
  unHighlight(toUnHighlight) {
    const updatedIds = [];
    toUnHighlight.forEach((id) => {
      if (this.highlightedObjects[id]) {
        this.highlightedObjects[id].features
          .forEach((f) => {
            unhighlightFeature(f);
          });
        delete this.highlightedObjects[id];
        updatedIds.push(id);
      }
    });

    if (updatedIds.length > 0) {
      this.changed.raiseEvent({ action: FeatureVisibilityAction.UNHIGHLIGHT, ids: updatedIds });
    }
  }

  /**
   * clears all highlighted objects
   * @api stable
   */
  clearHighlighting() {
    this.unHighlight(Object.keys(this.highlightedObjects));
  }

  /**
   * @param {string|number} id
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>|import("@vcmap/cesium").Cesium3DTileFeature} feature
   * @returns {boolean}
   */
  hasHighlightFeature(id, feature) {
    return this.highlightedObjects[id] && this.highlightedObjects[id].features.has(feature);
  }

  /**
   * @param {string|number} id
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>|import("@vcmap/cesium").Cesium3DTileFeature} feature
   */
  addHighlightFeature(id, feature) {
    if (this.highlightedObjects[id]) {
      cacheOriginalStyle(feature);
      this.highlightedObjects[id].features.add(feature);
      feature[highlighted] = this.highlightedObjects[id].style;
      highlightFeature(feature);
    }
  }

  /**
   * hides a number of objects
   * @param {Array<string|number>} toHide A list of Object Ids which will be hidden
   * @api stable
   */
  hideObjects(toHide) {
    const updatedIds = [];
    toHide.forEach((id) => {
      if (!this.hiddenObjects[id]) {
        this.hiddenObjects[id] = new Set();
        updatedIds.push(id);
      }
    });

    if (updatedIds.length > 0) {
      this.lastUpdated = Date.now();
      this.changed.raiseEvent({ action: FeatureVisibilityAction.HIDE, ids: updatedIds });
    }
  }

  /**
   * unHides a number of objects
   * @param {Array<string|number>} unHide A list of Object Ids which will be unHidden
   * @api stable
   */
  showObjects(unHide) {
    const updatedIds = [];
    unHide.forEach((id) => {
      if (this.hiddenObjects[id]) {
        this.hiddenObjects[id]
          .forEach((f) => {
            showFeature(f, hidden);
          });
        delete this.hiddenObjects[id];
        updatedIds.push(id);
      }
    });

    if (updatedIds.length > 0) {
      this.changed.raiseEvent({ action: FeatureVisibilityAction.SHOW, ids: updatedIds });
    }
  }

  /**
   * clears all the hidden objects
   * @api stable
   */
  clearHiddenObjects() {
    this.showObjects(Object.keys(this.hiddenObjects));
  }

  /**
   * @param {string|number} id
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>|import("@vcmap/cesium").Cesium3DTileFeature|import("@vcmap/cesium").Entity} feature
   * @returns {boolean}
   */
  hasHiddenFeature(id, feature) {
    return this.hiddenObjects[id] && this.hiddenObjects[id].has(feature);
  }

  /**
   * @param {string|number} id
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>|import("@vcmap/cesium").Cesium3DTileFeature|import("@vcmap/cesium").Entity} feature
   */
  addHiddenFeature(id, feature) {
    if (this.hiddenObjects[id]) {
      cacheOriginalStyle(feature);
      this.hiddenObjects[id].add(feature);
      feature[hidden] = true;
      hideFeature(feature);
    }
  }

  /**
   * Clears all caches and removes cesium events.
   */
  destroy() {
    Object.values(this.hiddenObjects).forEach((s) => { s.clear(); });
    this.hiddenObjects = {};
    Object.values(this.highlightedObjects).forEach(({ features }) => { features.clear(); });
    this.highlightedObjects = {};
    this.changed.destroy();
  }
}

export default FeatureVisibility;
