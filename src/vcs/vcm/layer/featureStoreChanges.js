import axios from 'axios';
import { unByKey } from 'ol/Observable.js';
import Feature from 'ol/Feature.js';
import { check } from '@vcsuite/check';
import { featureStoreState, featureStoreStateSymbol } from './featureStoreState.js';
import { parseGeoJSON, writeGeoJSONFeature } from './geojsonHelpers.js';
import VcsObject from '../object.js';

/**
 * @typedef {Object} vcs.vcm.layer.FeatureStore.TrackResults
 * @property {Array<ol/Feature>} add
 * @property {Array<ol/Feature>} edit
 * @property {Array<ol/Feature>} remove
 * @api
 */

/**
 * @typedef {Object} vcs.vcm.layer.FeatureStore.FeatureStoreChanges.Listeners
 * @property {ol/events/EventsKey|Array<ol/events/EventsKey>|null} addfeature
 * @property {ol/events/EventsKey|Array<ol/events/EventsKey>|null} changefeature
 * @property {ol/events/EventsKey|Array<ol/events/EventsKey>|null} removefeature
 */

/**
 * @typedef {Object} vcs.vcm.layer.FeatureStore.FeatureStoreChanges.Values
 * @property {boolean} changed
 */

/**
 * do not construct directly, use the layers .changeTracker instead
 * @class
 * @extends {vcs.vcm.VcsObject}
 * @memberOf vcs.vcm.layer.FeatureStore
 * @api
 */
class FeatureStoreChanges extends VcsObject {
  static get className() { return 'vcs.vcm.layer.FeatureStoreChanges'; }

  /**
   * @param {vcs.vcm.layer.FeatureStore} layer
   */
  constructor(layer) {
    super({});

    /** @type {vcs.vcm.layer.FeatureStore} */
    this.layer = layer;
    /** @type {vcs.vcm.layer.FeatureStore.FeatureStoreChanges.Listeners} */
    this._changesListeners = {
      addfeature: null,
      changefeature: null,
      removefeature: null,
    };
    /** @type {Set<ol/Feature>} */
    this._addedFeatures = new Set();
    /** @type {Set<ol/Feature>} */
    this._editedFeatures = new Set();
    /** @type {Set<ol/Feature>} */
    this._removedFeatures = new Set();
    /** @type {Set<ol/Feature>} */
    this._convertedFeatures = new Set();
    /** @type {vcs.vcm.layer.FeatureStore.FeatureStoreChanges.Values} */
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
   * @returns {vcs.vcm.layer.FeatureStore.TrackResults}
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
   * @returns {Promise}
   * @api
   */
  commitChanges(url) {
    const actions = [];
    this._addedFeatures.forEach((f) => {
      const feature = writeGeoJSONFeature(f, { writeStyle: true });
      actions.push({
        action: 'add',
        feature,
        original: f,
        success(data) {
          f.setId(data);
          f[featureStoreStateSymbol] = featureStoreState.DYNAMIC;
        },
      });
    });

    this._editedFeatures.forEach((f) => {
      const feature = writeGeoJSONFeature(f, { writeStyle: true });
      feature._id = f.getId();
      feature.geomety = 'test';
      actions.push({
        action: 'edit',
        original: f,
        feature,
        success() {
          if (f[featureStoreStateSymbol] === featureStoreState.STATIC) {
            f[featureStoreStateSymbol] = featureStoreState.EDITED;
          }
        },
      });
    });

    this._removedFeatures.forEach((f) => {
      const _id = f.getId();
      actions.push({
        original: f,
        action: 'remove',
        feature: { _id },
        success() {},
      });
    });
    /** @type {Promise} */
    let promise = Promise.resolve();
    if (actions.length) {
      promise = axios.post(url.toString(), actions.map(a => ({ action: a.action, feature: a.feature })))
        .then(({ data }) => {
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
          return Promise.all(failures);
        });
    }

    return promise
      .then(() => {
        const promises = [];
        this._convertedFeatures.forEach((f) => { promises.push(this._resetFeature(f)); });
        Promise.all(promises);
      })
      .then(() => {
        this._resetValues();
      })
      .catch((err) => {
        this._resetValues();
        this.getLogger().error(err.message);
      });
  }

  /**
   * resets all changes since the last commit or the beginning of tracking
   * @returns {Promise}
   * @api
   */
  reset() {
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
   * @param {ol/Feature} feature
   * @returns {Promise}
   * @private
   */
  _resetFeature(feature) {
    const featureId = feature.getId();
    const idArray = [featureId];
    if (!feature[featureStoreStateSymbol]) {
      this.layer.removeFeaturesById(idArray);
      return Promise.resolve();
    }

    if (feature[featureStoreStateSymbol] === featureStoreState.STATIC) {
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
   * @param {{feature: ol/Feature}} event
   * @private
   */
  _featureAdded(event) {
    const { feature } = event;
    if (!feature[featureStoreStateSymbol]) {
      this._addedFeatures.add(feature);
      this.values.changed = true;
    } else if (feature[featureStoreStateSymbol] === featureStoreState.STATIC) {
      this._convertedFeatures.add(feature);
      this.values.changed = true;
    }
  }

  /**
   * @param {{feature: ol/Feature}} event
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
   * @param {{feature: ol/Feature}} event
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
   * @param {ol/Feature} feature
   * @api
   */
  removeFeature(feature) {
    check(feature, Feature);

    this._featureRemoved({ feature });
  }

  /**
   * adds an addition to the tracker. prefer use of .track
   * @param {ol/Feature} feature
   * @api
   */
  addFeature(feature) {
    check(feature, Feature);

    this._featureAdded({ feature });
  }

  /**
   * adds an edit to the tracker. prefer use of .track
   * @param {ol/Feature} feature
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

export default FeatureStoreChanges;
