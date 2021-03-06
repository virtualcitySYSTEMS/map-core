import { check } from '@vcsuite/check';
import {
  globalHidden,
  hideFeature,
  cacheOriginalStyle,
  showFeature,
  FeatureVisibilityAction,
} from './featureVisibility.js';
import VcsEvent from '../vcsEvent.js';

/**
 * @typedef {Object} HiddenObject
 * @property {string} id
 */

/**
 * GlobalHider globally hides features existing within a layer of a {@link LayerCollection}.
 * Features can be defined as hidden by {@link VcsAppConfig} or {@link LayerOptions}.
 * Hiding will be performed, when a {@link Context} is loaded, a {@link Layer} is activated or GlobalHider API is called.
 * A feature can be hidden multiple times by different actors, e.g. contexts, layers, which is handled by this class.
 * A feature will be shown again, when a {@link Context} is removed, a {@link Layer} is deactivated or GlobalHider API is called.
 * @class
 */
class GlobalHider {
  constructor() {
    /**
     * @type {Object<string, number>}
     * @api
     */
    this.hiddenObjects = {};
    /**
     * @type {Object<string, Set<import("ol").Feature<import("ol/geom/Geometry").default>|import("@vcmap/cesium").Cesium3DTileFeature|import("@vcmap/cesium").Cesium3DTilePointFeature|import("@vcmap/cesium").Entity>>}
     * @private
     */
    this._hiddenObjectFeatures = {};
    /**
     * @type {number}
     * @api
     */
    this.lastUpdated = Date.now();
    /**
     * An event raised when the hidden ids change. Is called with
     * {@link FeatureVisibilityEvent} as its only argument
     * @type {VcsEvent<FeatureVisibilityEvent>}
     */
    this.changed = new VcsEvent();
  }

  /**
   * Add a tick to the hide count, hidding the features if they are not already hidden
   * @param {Array<string>} uuids
   * @api
   */
  hideObjects(uuids) {
    check(uuids, [String]);

    const updatedIds = [];
    uuids.forEach((uuid) => {
      if (!this.hiddenObjects[uuid]) {
        updatedIds.push(uuid);
        this.hiddenObjects[uuid] = 0;
      }
      this.hiddenObjects[uuid] += 1;
    });

    if (updatedIds.length > 0) {
      this.lastUpdated = Date.now();
      this.changed.raiseEvent({ action: FeatureVisibilityAction.HIDE, ids: updatedIds });
    }
  }

  /**
   * Subtract from the hide count for an Array of ids. If the array reaches 0, features with said UUID will be shown
   * @param {Array<string>} uuids
   * @api
   */
  showObjects(uuids) {
    check(uuids, [String]);

    const updatedIds = [];
    uuids.forEach((uuid) => {
      if (this.hiddenObjects[uuid]) {
        this.hiddenObjects[uuid] -= 1;
        if (this.hiddenObjects[uuid] === 0) {
          if (this._hiddenObjectFeatures[uuid]) {
            this._hiddenObjectFeatures[uuid].forEach((f) => {
              showFeature(f, globalHidden);
            });
            this._hiddenObjectFeatures[uuid].clear();
          }
          delete this.hiddenObjects[uuid];
          updatedIds.push(uuid);
        }
      }
    });

    if (updatedIds.length > 0) {
      this.changed.raiseEvent({ action: FeatureVisibilityAction.SHOW, ids: updatedIds });
    }
  }

  /**
   * @param {number|string} uuid
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>|import("@vcmap/cesium").Cesium3DTileFeature|import("@vcmap/cesium").Cesium3DTilePointFeature|import("@vcmap/cesium").Entity} feature
   */
  addFeature(uuid, feature) {
    if (!this._hiddenObjectFeatures[uuid]) {
      this._hiddenObjectFeatures[uuid] = new Set();
    }
    cacheOriginalStyle(feature);
    this._hiddenObjectFeatures[uuid].add(feature);
    feature[globalHidden] = true;
    hideFeature(feature);
  }

  /**
   * @param {string|number} uuid
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>|import("@vcmap/cesium").Cesium3DTileFeature|import("@vcmap/cesium").Cesium3DTilePointFeature|import("@vcmap/cesium").Entity} feature
   * @returns {boolean}
   */
  hasFeature(uuid, feature) {
    return this._hiddenObjectFeatures[uuid] ? this._hiddenObjectFeatures[uuid].has(feature) : false;
  }

  destroy() {
    this.hiddenObjects = {};
    Object.values(this._hiddenObjectFeatures).forEach((set) => { set.clear(); });
    this._hiddenObjectFeatures = {};
    this.changed.destroy();
  }
}

export default GlobalHider;
