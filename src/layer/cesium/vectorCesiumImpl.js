import { unByKey } from 'ol/Observable.js';
import { PrimitiveCollection } from '@vcmap/cesium';

import convert from '../../util/featureconverter/convert.js';
import VectorContext from './vectorContext.js';
import { vcsLayerName } from '../layerSymbols.js';
import LayerImplementation from '../layerImplementation.js';
import { getGlobalHider } from '../globalHider.js';
import { synchronizeFeatureVisibilityWithSource } from '../vectorHelpers.js';

/**
 * represents a specific vector layer for cesium.
 * @class
 * @export
 * @extends {LayerImplementation<import("@vcmap/core").CesiumMap>}}
 * @implements {FeatureLayerImplementation}
 */
class VectorCesiumImpl extends LayerImplementation {
  static get className() { return 'VectorCesiumImpl'; }

  /**
   * @param {import("@vcmap/core").CesiumMap} map
   * @param {VectorImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);

    /** @type {import("@vcmap/core").VectorProperties} */
    this.vectorProperties = options.vectorProperties;
    /** @type {import("ol/source").Vector<import("ol/geom/Geometry").default>} */
    this.source = options.source;
    /** @type {import("@vcmap/core").StyleItem} */
    this.style = options.style;
    /** @type {import("@vcmap/core").FeatureVisibility} */
    this.featureVisibility = options.featureVisibility;
    /**
     * @type {Array<Function>}
     * @private
     */
    this._featureVisibilityListeners = [];
    /**
     * @type {Function}
     * @private
     */
    this._removeVectorPropertiesChangeHandler = () => {};

    /**
     * @type {import("@vcmap/cesium").PrimitiveCollection|import("@vcmap/cesium").CustomDataSource}
     * @protected
     */
    this._rootCollection = new PrimitiveCollection();
    this._rootCollection[vcsLayerName] = options.name;

    /**
     * @type {Array<import("ol/events").EventsKey|Array<import("ol/events").EventsKey>>}
     * @private
     */
    this._olListeners = [];
    /**
     * A set of ol.Features to add once the map is back to cesium
     * @type {Set<import("ol").Feature<import("ol/geom/Geometry").default>>}
     * @private
     */
    this._featureToAdd = new Set();
    /**
     * @type {import("@vcmap/core").VectorContext|import("@vcmap/core").ClusterContext|null}
     * @protected
     */
    this._context = null;
    /**
     * @type {import("@vcmap/cesium").Scene|null}
     * @private
     */
    this._scene = null;
    this.globalHider = getGlobalHider();
  }

  /**
   * @private
   */
  _addListeners() {
    this._olListeners.push(this.source
      .on('addfeature', (event) => {
        this._addFeature(/** @type {import("ol/source/Vector").VectorSourceEvent} */(event).feature);
      }));

    this._olListeners.push(this.source
      .on('removefeature', (event) => {
        this._removeFeature(/** @type {import("ol/source/Vector").VectorSourceEvent} */(event).feature);
      }));

    this._olListeners.push(this.source
      .on('changefeature', (event) => {
        this._featureChanged(/** @type {import("ol/source/Vector").VectorSourceEvent} */(event).feature);
      }));

    this._removeVectorPropertiesChangeHandler =
      this.vectorProperties.propertyChanged.addEventListener(this.refresh.bind(this));
  }

  /**
   * @param {import("@vcmap/core").CesiumMap} cesiumMap
   * @returns {Promise<void>}
   * @protected
   */
  async _setupContext(cesiumMap) {
    const rootCollection = /** @type {import("@vcmap/cesium").PrimitiveCollection} */ (this._rootCollection);
    this._context = new VectorContext(this._scene, rootCollection);
    cesiumMap.addPrimitiveCollection(rootCollection);
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.initialized) {
      this._scene = this.map.getScene();
      await this._setupContext(this.map);
      this._addListeners();
      this._addFeatures(this.source.getFeatures());
    }
    await super.initialize();
  }

  /**
   * @param {Array<import("ol").Feature<import("ol/geom/Geometry").default>>} features
   * @private
   */
  _addFeatures(features) {
    // TODO we should make this non-blocking to better handle larger data sets check in RIWA Impl
    features.forEach((f) => { this._addFeature(f); });
  }

  /**
   * converts a feature and adds the associated primitives to the collection of primitives
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @private
   */
  _addFeature(feature) {
    if (this.active) { // XXX cluster check here? or on init?
      convert(feature, this.style.style, this.vectorProperties, this._context, this._scene);
    } else {
      this._featureToAdd.add(feature);
    }
  }

  /**
   * Forces a complete re-render of all features.
   * @api
   */
  refresh() {
    this._context.clear();
    this._addFeatures(this.source.getFeatures());
  }

  /**
   * removes the primitive of the specified feature
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @private
   */
  _removeFeature(feature) {
    this._context.removeFeature(feature);
    this._featureToAdd.delete(feature);
  }

  /**
   * called when a features property have changed
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @private
   */
  _featureChanged(feature) {
    const cache = this._context.createFeatureCache(feature);
    this._featureToAdd.delete(feature);
    this._addFeature(feature);
    this._context.clearFeatureCache(cache);
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  async activate() {
    if (!this.active) {
      await super.activate();
      if (this.active) {
        this._addFeatures([...this._featureToAdd]);
        this._featureToAdd.clear();
        this._rootCollection.show = true;
        if (this._featureVisibilityListeners.length === 0) {
          this._featureVisibilityListeners =
            synchronizeFeatureVisibilityWithSource(this.featureVisibility, this.source, this.globalHider);
        }
      }
    }
  }

  /**
   * @inheritDoc
   */
  deactivate() {
    super.deactivate();
    this._rootCollection.show = false;
    this._featureVisibilityListeners.forEach((cb) => { cb(); });
    this._featureVisibilityListeners = [];
  }

  /**
   * @param {import("@vcmap/core").StyleItem} style
   * @param {boolean=} silent
   */
  updateStyle(style, silent) {
    this.style = style;
    if (this.initialized && !silent) {
      const features = this.source.getFeatures().filter(f => !f.getStyle());
      features.forEach((f) => {
        this._featureChanged(f);
      });
    }
  }

  /**
   * @protected
   */
  _destroyCollection() {
    this.map.removePrimitiveCollection(/** @type {undefined} */ (this._rootCollection)); // cast to undefined do to missing inheritance
  }

  /**
   * @inheritDoc
   */
  destroy() {
    if (this.initialized) {
      this._context.clear();
      this._destroyCollection();
    }
    this._context = null;
    this._scene = null;
    this._removeVectorPropertiesChangeHandler();
    this._olListeners.forEach((listener) => { unByKey(listener); });
    this._olListeners = [];
    this._featureToAdd.clear();
    this._featureVisibilityListeners.forEach((cb) => { cb(); });
    this._featureVisibilityListeners = [];
    this.source = null;
    this.vectorProperties = null;
    this.featureVisibility = null;
    this.style = null;
    this.globalHider = null;
    this._rootCollection = null;
    super.destroy();
  }
}

export default VectorCesiumImpl;
