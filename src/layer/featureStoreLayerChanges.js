import { unByKey } from 'ol/Observable.js';
import Feature from 'ol/Feature.js';
import { check } from '@vcsuite/check';
import { FeatureStoreLayerState, featureStoreStateSymbol } from './featureStoreLayerState.js';
import { parseGeoJSON, writeGeoJSONFeature } from './geojsonHelpers.js';
import VcsObject from '../vcsObject.js';
import { requestJson } from '../util/fetch.js';

/**
 * @typedef {Object} FeatureStoreTrackResults
 * @property {Array<import("ol").Feature<import("ol/geom/Geometry").default>>} add
 * @property {Array<import("ol").Feature<import("ol/geom/Geometry").default>>} edit
 * @property {Array<import("ol").Feature<import("ol/geom/Geometry").default>>} remove
 * @api
 */

/**
 * @typedef {Object} FeatureStoreChangesListeners
 * @property {import("ol/events").EventsKey|Array<import("ol/events").EventsKey>|null} addfeature
 * @property {import("ol/events").EventsKey|Array<import("ol/events").EventsKey>|null} changefeature
 * @property {import("ol/events").EventsKey|Array<import("ol/events").EventsKey>|null} removefeature
 */

/**
 * @typedef {Object} FeatureStoreChangesValues
 * @property {boolean} changed
 */

/**
 * @typedef {Object} CommitAction
 * @property {string} action
 * @property {import("ol/format/GeoJSON").GeoJSONFeature} feature
 * @property {import("ol").Feature<import("ol/geom/Geometry").default>} original
 * @property {function(string=):void} success
 */

/**
 * @param {Set<import("ol").Feature<import("ol/geom/Geometry").default>>} added
 * @param {Set<import("ol").Feature<import("ol/geom/Geometry").default>>} edited
 * @param {Set<import("ol").Feature<import("ol/geom/Geometry").default>>} removed
 * @returns {Array<CommitAction>}
 * @private
 */
export function createCommitActions(added, edited, removed) {
  const actions = [];
  added.forEach((f) => {
    const feature = writeGeoJSONFeature(f, { writeStyle: true });
    actions.push({
      action: 'add',
      feature,
      original: f,
      success(data) {
        f.setId(data);
        f[featureStoreStateSymbol] = FeatureStoreLayerState.DYNAMIC;
      },
    });
  });

  edited.forEach((f) => {
    const feature = writeGeoJSONFeature(f, { writeStyle: true });
    feature._id = f.getId();
    feature.geomety = 'test'; // XXX why test???
    actions.push({
      action: 'edit',
      original: f,
      feature,
      success() {
        if (f[featureStoreStateSymbol] === FeatureStoreLayerState.STATIC) {
          f[featureStoreStateSymbol] = FeatureStoreLayerState.EDITED;
        }
      },
    });
  });

  removed.forEach((f) => {
    const _id = f.getId();
    actions.push({
      original: f,
      action: 'remove',
      feature: { _id },
      success() {},
    });
  });

  return actions;
}

/**
 * do not construct directly, use the layers .changeTracker instead
 * @class
 * @extends {VcsObject}
 * @api
 */
class FeatureStoreLayerChanges extends VcsObject {
  static get className() { return 'FeatureStoreLayerChanges'; }

  /**
   * @param {import("@vcmap/core").FeatureStoreLayer} layer
   */
  constructor(layer) {
    super({});

    /** @type {import("@vcmap/core").FeatureStoreLayer} */
    this.layer = layer;
    /** @type {FeatureStoreChangesListeners} */
    this._changesListeners = {
      addfeature: null,
      changefeature: null,
      removefeature: null,
    };
    /** @type {Set<import("ol").Feature<import("ol/geom/Geometry").default>>} */
    this._addedFeatures = new Set();
    /** @type {Set<import("ol").Feature<import("ol/geom/Geometry").default>>} */
    this._editedFeatures = new Set();
    /** @type {Set<import("ol").Feature<import("ol/geom/Geometry").default>>} */
    this._removedFeatures = new Set();
    /** @type {Set<import("ol").Feature<import("ol/geom/Geometry").default>>} */
    this._convertedFeatures = new Set();
    /** @type {FeatureStoreChangesValues} */
    this.values = {
      changed: false,
    };
  }

  /**
   * Whether changes are being tracked or not
   * @readonly
   * @returns {boolean}
   * @api
   */
  get active() { return Object.values(this._changesListeners).some(c => c !== null); }

  /**
   * starts tracking changes on the layer
   * starts tracking changes on the feature store layer
   * @api
   */
  track() {
    if (this._changesListeners.addfeature === null) {
      this._changesListeners.addfeature = this.layer.source.on('addfeature', this._featureAdded.bind(this));
    }

    if (this._changesListeners.changefeature === null) {
      this._changesListeners.changefeature = this.layer.source.on('changefeature', this._featureChanged.bind(this));
    }

    if (this._changesListeners.removefeature === null) {
      this._changesListeners.removefeature = this.layer.source.on('removefeature', this._featureRemoved.bind(this));
    }
  }

  /**
   * @returns {FeatureStoreTrackResults}
   */
  getChanges() {
    return {
      add: [...this._addedFeatures],
      edit: [...this._editedFeatures],
      remove: [...this._removedFeatures],
    };
  }

  /**
   * commits the changes to the provided url. url should contain accessTokens and point to a featureStore layers bulk operation endpoint
   * @param {string} url
   * @returns {Promise<void>}
   * @api
   */
  async commitChanges(url) {
    const actions = createCommitActions(this._addedFeatures, this._editedFeatures, this._removedFeatures);
    if (actions.length > 0) {
      const data = await requestJson(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(actions.map(a => ({ action: a.action, feature: a.feature }))),
      });

      const failures = data.failedActions.map(({ index, error }) => {
        const action = actions[index];
        this.getLogger().log(`failed action ${action.action}: ${error}`);
        actions[index] = null;
        return this._resetFeature(action.original);
      });

      actions
        .filter(a => a)
        .forEach(({ action, success }) => {
          if (action === 'add') {
            success(data.insertedIds.shift()._id); // XXX should this be shift or should we find the index?
          } else {
            success();
          }
        });
      await Promise.all(failures);
    } else {
      try {
        await Promise.all([...this._convertedFeatures].map(async (f) => { await this._resetFeature(f); }));
      } catch (err) {
        this.getLogger().error(err.message);
      }
      this._resetValues();
    }
  }

  /**
   * resets all changes since the last commit or the beginning of tracking
   * @returns {Promise<void>}
   * @api
   */
  async reset() {
    const promises = [];
    this._addedFeatures.forEach((f) => { promises.push(this._resetFeature(f)); });
    this._editedFeatures.forEach((f) => { promises.push(this._resetFeature(f)); });
    this._removedFeatures.forEach((f) => { promises.push(this._resetFeature(f)); });
    this._convertedFeatures.forEach((f) => { promises.push(this._resetFeature(f)); });
    return Promise.all(promises)
      .then(() => {
        this._resetValues();
      })
      .catch((err) => {
        this.getLogger().error(err);
        this._resetValues();
      });
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {Promise<void>}
   * @private
   */
  _resetFeature(feature) {
    const featureId = feature.getId();
    const idArray = [featureId];
    if (!feature[featureStoreStateSymbol]) {
      this.layer.removeFeaturesById(idArray);
      return Promise.resolve();
    }

    if (feature[featureStoreStateSymbol] === FeatureStoreLayerState.STATIC) {
      this.layer.resetStaticFeature(featureId);
      return Promise.resolve();
    }

    return this.layer.injectedFetchDynamicFeatureFunc(featureId)
      .then((data) => {
        const { features } = parseGeoJSON(data);
        this.layer.removeFeaturesById(idArray);
        this.layer.addFeatures(features);
      })
      .catch((err) => {
        this.getLogger().error('failed to reset feature, giving up', err.message);
      });
  }

  _resetValues() {
    this._addedFeatures.clear();
    this._editedFeatures.clear();
    this._removedFeatures.clear();
    this._convertedFeatures.clear();
    this.values.changed = false;
  }

  /**
   * stops tracking changes on the feature store layer
   * @api
   */
  unTrack() {
    unByKey(Object.values(this._changesListeners));
    this._changesListeners.addfeature = null;
    this._changesListeners.changefeature = null;
    this._changesListeners.removefeature = null;
    this._resetValues();
  }

  /**
   * pauses the tracking of the given event, but does not reset features
   * @param {string} event - one of: addfeature, changefeature or removefeature
   * @api
   */
  pauseTracking(event) {
    if (this._changesListeners[event]) {
      unByKey(this._changesListeners[event]);
      this._changesListeners[event] = null;
    }
  }

  /**
   * @param {{feature: import("ol").Feature<import("ol/geom/Geometry").default>}} event
   * @private
   */
  _featureAdded(event) {
    const { feature } = event;
    if (!feature[featureStoreStateSymbol]) {
      this._addedFeatures.add(feature);
      this.values.changed = true;
    } else if (feature[featureStoreStateSymbol] === FeatureStoreLayerState.STATIC) {
      this._convertedFeatures.add(feature);
      this.values.changed = true;
    }
  }

  /**
   * @param {{feature: import("ol").Feature<import("ol/geom/Geometry").default>}} event
   * @private
   */
  _featureChanged(event) {
    const { feature } = event;
    if (feature[featureStoreStateSymbol]) {
      this._convertedFeatures.delete(feature);
      this._editedFeatures.add(feature);
      this.values.changed = true;
    }
  }

  /**
   * @param {{feature: import("ol").Feature<import("ol/geom/Geometry").default>}} event
   * @private
   */
  _featureRemoved(event) {
    const { feature } = event;
    if (feature[featureStoreStateSymbol]) {
      this._removedFeatures.add(feature);
      this._editedFeatures.delete(feature);
      this._convertedFeatures.delete(feature);
      this.values.changed = true;
    } else {
      this._addedFeatures.delete(feature);
    }
  }

  /**
   * tracks the change of removing a static feature
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @api
   */
  removeFeature(feature) {
    check(feature, Feature);

    this._featureRemoved({ feature });
  }

  /**
   * adds an addition to the tracker. prefer use of .track
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @api
   */
  addFeature(feature) {
    check(feature, Feature);

    this._featureAdded({ feature });
  }

  /**
   * adds an edit to the tracker. prefer use of .track
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @api
   */
  editFeature(feature) {
    check(feature, Feature);

    this._featureChanged({ feature });
  }

  /**
   * destroys the Changetracker
   */
  destroy() {
    this.unTrack();
    this.layer = null;
    super.destroy();
  }
}

export default FeatureStoreLayerChanges;
