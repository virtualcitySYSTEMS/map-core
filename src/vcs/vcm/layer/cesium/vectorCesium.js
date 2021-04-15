import { unByKey } from 'ol/Observable.js';
import PrimitiveCollection from 'cesium/Source/Scene/PrimitiveCollection.js';

import convert from '../../util/featureconverter/convert.js';
import VectorContext from './vectorContext.js';
import { vcsLayerName } from '../layerSymbols.js';
import LayerImplementation from '../layerImplementation.js';
import { getInstance as getGlobalHider } from '../globalHider.js';
import { synchronizeFeatureVisibility } from '../vectorHelpers.js';

/**
 * represents a specific vector layer for cesium.
 * @class
 * @export
 * @extends {vcs.vcm.layer.LayerImplementation<vcs.vcm.maps.CesiumMap>}
 * @implements {vcs.vcm.layer.FeatureLayerImplementation}
 * @memberOf vcs.vcm.layer.cesium
 */
class VectorCesium extends LayerImplementation {
  static get className() { return 'vcs.vcm.layer.cesium.VectorCesium'; }

  /**
   * @param {vcs.vcm.maps.CesiumMap} map
   * @param {vcs.vcm.layer.Vector.ImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);

    /** @type {vcs.vcm.layer.VectorProperties} */
    this.vectorProperties = options.vectorProperties;
    /** @type {ol/source/Vector} */
    this.source = options.source;
    /** @type {vcs.vcm.util.style.StyleItem} */
    this.style = options.style;
    /** @type {vcs.vcm.layer.FeatureVisibility} */
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
     * @type {Cesium/PrimitiveCollection|Cesium/CustomDataSource}
     * @protected
     */
    this._rootCollection = new PrimitiveCollection();
    this._rootCollection[vcsLayerName] = options.name;

    /**
     * @type {Array<ol/events/EventsKey|Array<ol/events/EventsKey>>}
     * @private
     */
    this._olListeners = [];
    /**
     * A set of ol.Features to add once the map is back to cesium
     * @type {Set<ol/Feature>}
     * @private
     */
    this._featureToAdd = new Set();
    /**
     * @type {vcs.vcm.layer.cesium.VectorContext|vcs.vcm.layer.cesium.ClusterContext|null}
     * @protected
     */
    this._context = null;
    /**
     * @type {Cesium/Scene|null}
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
        this._addFeature(/** @type {ol/source/VectorSourceEvent} */(event).feature);
      }));

    this._olListeners.push(this.source
      .on('removefeature', (event) => {
        this._removeFeature(/** @type {ol/source/VectorSourceEvent} */(event).feature);
      }));

    this._olListeners.push(this.source
      .on('changefeature', (event) => {
        this._featureChanged(/** @type {ol/source/VectorSourceEvent} */(event).feature);
      }));

    this._removeVectorPropertiesChangeHandler =
      this.vectorProperties.propertyChanged.addEventListener(this.refresh.bind(this));
  }

  /**
   * @param {vcs.vcm.maps.CesiumMap} cesiumMap
   * @returns {Promise<void>}
   * @protected
   */
  async _setupContext(cesiumMap) {
    const rootCollection = /** @type {Cesium/PrimitiveCollection} */ (this._rootCollection);
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
   * @param {Array<ol/Feature>} features
   * @private
   */
  _addFeatures(features) {
    // TODO we should make this non-blocking to better handle larger data sets check in RIWA Impl
    features.forEach((f) => { this._addFeature(f); });
  }

  /**
   * converts a feature and adds the associated primitives to the collection of primitives
   * @param {ol/Feature} feature
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
   * @param {ol/Feature} feature
   * @private
   */
  _removeFeature(feature) {
    this._context.removeFeature(feature);
    this._featureToAdd.delete(feature);
  }

  /**
   * called when a features property have changed
   * @param {ol/Feature} feature
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
            synchronizeFeatureVisibility(this.featureVisibility, this.source, this.globalHider);
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
   * @param {vcs.vcm.util.style.StyleItem} style
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
    this.map.removePrimitiveCollection(this._rootCollection);
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

export default VectorCesium;
