import { check } from '@vcsuite/check';
import { parseBoolean, parseInteger } from '@vcsuite/parsers';
import VcsObject from '../vcsObject.js';
import Extent from '../util/extent.js';
import { getGlobalHider } from './globalHider.js';
import { vcsLayerName } from './layerSymbols.js';
import LayerState from './layerState.js';
import VcsEvent from '../vcsEvent.js';
import { getCurrentLocale, getLocaleChangedEvent } from '../util/locale.js';
import { layerClassRegistry } from '../classRegistry.js';

/**
 * @typedef {Object} GenericFeature
 * @property {number} longitude
 * @property {number} latitude
 * @property {number} height
 * @property {string} layerName
 * @property {string} layerClass
 * @property {any} attributes
 * @property {boolean} relativeToGround
 */

/**
 * @typedef {import("@vcmap/core").Layer} SplitLayer
 * @property {import("@vcmap/cesium").SplitDirection} splitDirection
 * @property {VcsEvent<import("@vcmap/cesium").SplitDirection>} splitDirectionChanged
 */

/**
 * @typedef {Object} CopyrightOptions
 * @property {string|undefined} provider
 * @property {string|undefined} url
 * @property {string|undefined} year
 * @api
 */

// TODO add flight options if flight is moved to core
/**
 * @typedef {VectorPropertiesOptions} VcsMeta
 * @property {string|undefined} version - the version of the vcsMeta schema
 * @property {VectorStyleItemOptions|DeclarativeStyleItemOptions|undefined} style
 * @property {Array<string>|undefined} embeddedIcons
 * @property {number|undefined} screenSpaceError
 * @property {*|undefined} flightOptions
 * @property {string|undefined} baseUrl
 * @api
 */

/**
 * @typedef {VcsObjectOptions} LayerOptions
 * @property {string|undefined} name - the name of the layer, used to retrieve the layer from the framework. if not specified, a uuid is generated
 * @property {boolean} [activeOnStartup=false] -  if true the layer will be activated on initialization
 * @property {boolean} [allowPicking=true] - whether to allow picking on this layer
 * @property {number|undefined} zIndex - zIndex of this layer
 * @property {ExtentOptions|undefined} extent - metadata on the data extent of the layer.
 * @property {Array<string|symbol>|undefined} [exclusiveGroups=[]] -
 * @property {Array<string>|undefined} mapNames - the map names on which this layer is shown, all if empty
 * @property {string|Object|undefined} url - for most layers, a resource url will be needed
 * @property {Array<string>|undefined} hiddenObjectIds - an array of building ids which should be hidden if this layer is active
 * @property {CopyrightOptions|undefined} copyright
 * @api
 */

/**
 * The options passed to a layer implementation.
 * @typedef {Object} LayerImplementationOptions
 * @property {string} name
 * @property {string} url
 * @api
 */

/**
 * Layer implementations for the {@link CesiumMap} map
 * @namespace cesium
 * @api stable
 */

/**
 * Layer implementations for the {@link Oblique} map
 * @namespace oblique
 * @api stable
 */

/**
 * Layer implementations for the {@link Openlayers} map
 * @namespace openlayers
 * @api stable
 */

/**
 * The version of vcsMeta schema being written by this helper
 * @type {string}
 * @const
 */
export const vcsMetaVersion = '2.0';

/**
 * Abstract base class for Layers.
 * To create a layer Implementation the function `createImplementationsForMap` has to be implemented.
 * To receive implementation options, implement `geImplementationOptions`
 * @abstract
 * @class
 * @export
 * @extends {VcsObject}
 * @api stable
 */
class Layer extends VcsObject {
  /** @type {string} */
  static get className() { return 'Layer'; }

  /**
   * Symbol to declare a layers name on its visualizations, e.g. ol.layer.Layer, Cesium.Cesium3DTileset
   * @type {symbol}
   * @api
   */
  static get vcsLayerNameSymbol() { return vcsLayerName; }

  /** @returns {LayerOptions} */
  static getDefaultOptions() {
    return {
      name: undefined,
      extent: undefined,
      activeOnStartup: false,
      allowPicking: true,
      exclusiveGroups: [],
      mapNames: [],
      url: undefined,
      hiddenObjectIds: [],
      copyright: undefined,
    };
  }

  /**
   * @param {LayerOptions} options
   */
  constructor(options) {
    super(options);
    const defaultOptions = Layer.getDefaultOptions();

    /**
     * Metadata on the extent of the data in this layer. Depending on the implementation, data is only requested
     * for this extent (e.g. {@see RasterLayer})
     * @type {Extent|null}
     * @api
     */
    this.extent = options.extent ? new Extent(options.extent) : null;
    /**
     * Whether this layer should be active on startup or not. Relevant for creating links.
     * @type {boolean}
     * @api
     */
    this.activeOnStartup = parseBoolean(options.activeOnStartup, defaultOptions.activeOnStartup);
    /**
     * @type {boolean}
     * @private
     */
    this._allowPicking = parseBoolean(options.allowPicking, defaultOptions.allowPicking);
    /**
     * @type {LayerState}
     * @private
     */
    this._state = LayerState.INACTIVE;
    /**
     * @type {Promise<void>|null}
     * @private
     */
    this._loadingPromise = null;

    /**
     * @type {boolean}
     * @private
     */
    this._initialized = false;

    /**
     * the names of the maps this layer is shown, all if empty
     * @type {Array.<string>}
     */
    this.mapNames = options.mapNames || defaultOptions.mapNames;

    /**
     * The class names of the supported maps.
     * @type {Array<string>}
     * @protected
     * @api
     */
    this._supportedMaps = [];

    /**
     * @type {string|Object}
     * @private
     */
    this._url = options.url;

    /**
     * @type {Function}
     * @private
     */
    this._localeChangedListener = null;

    /**
     * @type {number}
     * @private
     */
    this._zIndex = parseInteger(options.zIndex, 0);

    /**
     * Called when the zIndex of this layer is changed. Is passed the new zIndex as its only argument.
     * @type {VcsEvent<number>}
     * @api
     */
    this.zIndexChanged = new VcsEvent();

    /**
     * array of object Ids which should be hidden within the context of the layers layerCollection, if this layer is active
     * @type {Array.<string>}
     * @api
     */
    this.hiddenObjectIds = Array.isArray(options.hiddenObjectIds) ?
      options.hiddenObjectIds :
      defaultOptions.hiddenObjectIds;

    /**
     * @type {Array<string|symbol>}
     * @private
     */
    this._exclusiveGroups = Array.isArray(options.exclusiveGroups) ?
      options.exclusiveGroups.slice() :
      defaultOptions.exclusiveGroups;

    /**
     * event raised if the exclusives group of the layer changes. is passed the array of exclusive groups as its only argument
     * @type {VcsEvent<Array<string|symbol>>}
     * @api
     */
    this.exclusiveGroupsChanged = new VcsEvent();

    /** @type {import("@vcmap/core").GlobalHider} */
    this.globalHider = getGlobalHider();

    /**
     * @type {CopyrightOptions|undefined}
     */
    this.copyright = options.copyright || defaultOptions.copyright;

    /**
     * @type {Map<import("@vcmap/core").VcsMap, Array<import("@vcmap/core").LayerImplementation>>}
     * @private
     */
    this._implementations = new Map();

    /**
     * @type {Set<import("@vcmap/core").VcsMap>}
     * @private
     */
    this._activeMaps = new Set();

    /**
     * Event raised, if the layers state changes. Is passed the LayerState as its only parameter
     * @type {VcsEvent<LayerState>}
     * @api
     */
    this.stateChanged = new VcsEvent();

    /**
     * An optional feature provider to provider features based on click events.
     * @type {import("@vcmap/core").AbstractFeatureProvider}
     * @api
     */
    this.featureProvider = undefined;
  }

  /**
   * True if this layer has been initialized, typically after its first activation.
   * @type {boolean}
   * @readonly
   * @api
   */
  get initialized() {
    return this._initialized;
  }

  /**
   * @api
   * @type {boolean}
   * @readonly
   */
  get active() {
    return this._state === LayerState.ACTIVE;
  }

  /**
   * @api
   * @type {boolean}
   * @readonly
   */
  get loading() {
    return !!(this._state & LayerState.LOADING);
  }

  /**
   * @api
   * @type {LayerState}
   * @readonly
   */
  get state() {
    return this._state;
  }

  /**
   * @api
   * @type {boolean}
   */
  get allowPicking() {
    return this._allowPicking;
  }

  /**
   * @param {boolean} allowPicking
   */
  set allowPicking(allowPicking) {
    this._allowPicking = allowPicking;
  }

  /**
   * A layers url, should on be configured, else an empty string
   * @type {string}
   * @api
   */
  get url() {
    if (this._url) {
      if (typeof this._url === 'string') {
        return this._url;
      }
      const locale = getCurrentLocale();
      if (this._url[locale]) {
        return this._url[locale];
      }
      return Object.values(this._url)[0];
    }
    return '';
  }

  /**
   * @param {string|Object} url
   */
  set url(url) {
    check(url, [String, Object]);

    if (this._url !== url) {
      this._url = url;
      this.reload();
    }
  }

  /**
   * Indicates, that this layer is part of an exclusiveGroup
   * @api
   * @type {boolean}
   * @readonly
   */
  get exclusive() {
    return this._exclusiveGroups.length > 0;
  }

  /**
   * An array of arbitrary exclusive groups
   * @returns {Array<string|symbol>}
   * @readonly
   * @api
   */
  get exclusiveGroups() {
    return this._exclusiveGroups.slice();
  }

  /**
   * @param {Array<string|symbol>} groups
   */
  set exclusiveGroups(groups) {
    check(groups, [[String, Symbol]]);

    if (
      groups.length !== this._exclusiveGroups.length ||
      !groups.every(g => this._exclusiveGroups.includes(g))
    ) {
      this._exclusiveGroups = groups.slice();
      this.exclusiveGroupsChanged.raiseEvent(groups);
    }
  }

  /**
   * @type {number}
   * @api
   */
  get zIndex() { return this._zIndex; }

  /**
   * @param {number} index
   */
  set zIndex(index) {
    check(index, Number);

    if (this._zIndex !== index) {
      this._zIndex = index;
      this.zIndexChanged.raiseEvent(index);
    }
  }

  /**
   * creates an array of layer implementations for the given map.
   * @param {import("@vcmap/core").VcsMap} map Map
   * @returns {Array<import("@vcmap/core").LayerImplementation<import("@vcmap/core").VcsMap>>} return the specific implementation
   */
  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  createImplementationsForMap(map) {
    return [];
  }

  /**
   * creates or returns a cached array of layer implementations for the given map.
   * @param {import("@vcmap/core").VcsMap} map initialized Map
   * @returns {Array<import("@vcmap/core").LayerImplementation<import("@vcmap/core").VcsMap>>} return the specific implementation
   * @api
   */
  getImplementationsForMap(map) {
    if (!this._implementations.has(map)) {
      if (this.isSupported(map)) {
        this._implementations.set(map, this.createImplementationsForMap(map));
      } else {
        this._implementations.set(map, []);
      }
    }
    return this._implementations.get(map);
  }

  /**
   * Returns all implementation of this layer for all maps
   * @returns {Array<import("@vcmap/core").LayerImplementation<import("@vcmap/core").VcsMap>>}
   * @api
   */
  getImplementations() {
    return [...this._implementations.values()].flat();
  }

  /**
   * @returns {LayerImplementationOptions}
   */
  getImplementationOptions() {
    return {
      name: this.name,
      url: this.url,
    };
  }

  /**
   * Reloads all the data loaded and forces a redraw
   * @returns {Promise<void>}
   * @api
   */
  reload() {
    return this.forceRedraw();
  }

  /**
   * destroys all current implementations and recreates the ones which have an active map.
   * called for instance when the URL for a layer changes
   * @returns {Promise<void>}
   * @api
   */
  async forceRedraw() {
    const maps = [...this._implementations.keys()];

    const promises = maps.map((map) => {
      this.removedFromMap(map);
      if (map.active) {
        return this.mapActivated(map);
      }
      return Promise.resolve();
    });
    await Promise.all(promises);
  }

  /**
   * returns the Extent of this layer
   * @returns {Extent}
   * @api stable
   */
  getExtent() {
    return this.extent;
  }

  /**
   * returns the Extent of this layer or null, if the layers extent was not defined or cannot be established
   * @returns {Extent|null}
   * @api stable
   */
  getZoomToExtent() {
    if (this.extent && this.extent.isValid()) {
      return this.extent;
    }
    return null;
  }

  /**
   * recreates the implementations on locale change, if the url of this layer is an Object
   * @param {string} locale
   * @private
   */
  _handleLocaleChange(locale) {
    if (this._url && typeof this._url === 'object' && this._url[locale]) {
      this.reload();
    }
  }

  /**
   * initializes the layer, can be used to defer loading
   * @returns {Promise<void>}
   */
  initialize() {
    if (!this.initialized) {
      this._localeChangedListener = getLocaleChangedEvent().addEventListener(this._handleLocaleChange.bind(this));
    }
    this._initialized = true;
    return Promise.resolve();
  }

  /**
   * is called from the map when the map is activated, and this layer is in the layerCollection of the map.
   * Will create an implementation if it does not exits and will forward the activation call to the implementation.
   * @param {import("@vcmap/core").VcsMap} map
   * @returns {Promise<void>}
   */
  async mapActivated(map) {
    this.getLogger().debug(`Layer: ${this.name} mapActivated is called from Map: ${map.name}`);
    this._activeMaps.add(map);
    if (this.active || (this.loading && this.initialized)) {
      await this._activateImplsForMap(map);
    }
  }

  /**
   * is called from the map when the map is deactivated, and this layer is in the layerCollection of the map.
   * will forward deactivation call to the map specific implementation
   * @param {import("@vcmap/core").VcsMap} map
   */
  mapDeactivated(map) {
    this.getLogger().debug(`Layer: ${this.name} mapDeactivated is called from Map: ${map.name}`);
    this._activeMaps.delete(map);
    if (this.active || this.loading) {
      this.getImplementationsForMap(map)
        .forEach((impl) => {
          impl.deactivate();
        });
    }
  }

  /**
   * is called when a layer is removed from the layer collection of a map or said map is destroyed.
   * destroys the associated implementation.
   * @param {import("@vcmap/core").VcsMap} map
   */
  removedFromMap(map) {
    this._activeMaps.delete(map);
    this.getImplementationsForMap(map)
      .forEach((impl) => {
        impl.destroy();
      });
    this._implementations.delete(map);
  }

  /**
   * checks if the currently active map supports this layer
   * @param {import("@vcmap/core").VcsMap} map
   * @returns {boolean}
   * @api stable
   */
  isSupported(map) {
    return map &&
      this._supportedMaps.includes(map.className) &&
      (this.mapNames.length === 0 || this.mapNames.indexOf(map.name) >= 0);
  }

  /**
   * @param {import("@vcmap/core").VcsMap} map
   * @returns {Promise<void>}
   * @private
   */
  async _activateImplsForMap(map) {
    const impls = this.getImplementationsForMap(map);
    try {
      await Promise.all(impls.map(i => i.activate()));
    } catch (err) {
      this.getLogger().error(`Layer ${this.name} could not activate impl for map ${map.name}`);
      this.getLogger().error(err);
      this._implementations.set(map, []);
      impls.forEach((i) => { i.destroy(); });
    }
  }

  /**
   * @returns {Promise<void>}
   * @private
   */
  async _activate() {
    this._state = LayerState.LOADING;
    try {
      this.stateChanged.raiseEvent(LayerState.LOADING);
    } catch (e) {
      this.getLogger().debug(`Error on raising LayerState.LOADING event for layer ${this.name} : ${e.message}`);
    }
    await this.initialize();
    if (this._state !== LayerState.LOADING) {
      return;
    }

    await Promise.all([...this._activeMaps].map(m => this._activateImplsForMap(m)));
    if (this._state !== LayerState.LOADING) {
      return;
    }
    this.globalHider.hideObjects(this.hiddenObjectIds);
    this._state = LayerState.ACTIVE;
    try {
      this.stateChanged.raiseEvent(LayerState.ACTIVE);
    } catch (e) {
      this.getLogger().debug(`Error on raising LayerState.ACTIVE event for layer ${this.name} : ${e.message}`);
    }
    this._loadingPromise = null;
  }

  /**
   * Activates this layer object, i.e. changes its internal view state
   * and updates the map. The returned promise resolves, once the layer & any _implementations are initialized
   * and all data is loaded.
   * Once the promise resolves, the layer can still be inactive, if deactivate was called while initializing the layer.
   * @returns {Promise<void>}
   * @api stable
   */
  activate() {
    if (this._loadingPromise) {
      return this._loadingPromise;
    }

    if (this._state === LayerState.INACTIVE) {
      this._loadingPromise = this._activate()
        .catch((err) => {
          this._state = LayerState.INACTIVE;
          return Promise.reject(err);
        });
      return this._loadingPromise;
    }

    return Promise.resolve();
  }

  /**
   * Deactivates a layer, changing the internal view state
   * @api
   */
  deactivate() {
    if (this._loadingPromise) {
      this._loadingPromise = null;
    }

    if (this._state !== LayerState.INACTIVE) {
      this.getImplementations().forEach((impl) => {
        if (impl.loading || impl.active) {
          impl.deactivate();
        }
      });
      this.globalHider.showObjects(this.hiddenObjectIds);
      this._state = LayerState.INACTIVE;
      try {
        this.stateChanged.raiseEvent(LayerState.INACTIVE);
      } catch (e) {
        this.getLogger().debug(`Error on raising LayerState.INACTIVE event for layer ${this.name} : ${e.message}`);
      }
    }
  }

  /**
   * @returns {LayerOptions}
   */
  toJSON() {
    /** @type {LayerOptions} */
    const config = super.toJSON();
    const defaultOptions = Layer.getDefaultOptions();

    if (this.activeOnStartup !== defaultOptions.activeOnStartup) {
      config.activeOnStartup = this.activeOnStartup;
    }

    if (this.allowPicking !== defaultOptions.allowPicking) {
      config.allowPicking = this.allowPicking;
    }

    if (this.mapNames.length > 0) {
      config.mapNames = this.mapNames.slice();
    }

    if (this.hiddenObjectIds.length > 0) {
      config.hiddenObjectIds = this.hiddenObjectIds.slice();
    }

    if (this._url) {
      config.url = this._url;
    }

    if (this.extent && this.extent.isValid()) {
      config.extent = this.extent.toJSON();
    }

    if (this._exclusiveGroups.length > 0) {
      config.exclusiveGroups = this._exclusiveGroups.slice();
    }

    if (this.copyright !== defaultOptions.copyright) {
      config.copyright = { ...this.copyright };
    }

    return config;
  }

  /**
   * disposes of this layer, removes instances from the current maps and the framework
   * @api stable
   */
  destroy() {
    super.destroy();
    if (this.featureProvider) {
      this.featureProvider.destroy();
    }

    this._activeMaps.clear();
    this.getImplementations()
      .forEach((impl) => {
        impl.destroy();
      });

    if (this._localeChangedListener) {
      this._localeChangedListener();
      this._localeChangedListener = null;
    }
    this._initialized = false;
    this._implementations.clear();
    this.stateChanged.destroy();
    this.zIndexChanged.destroy();
    this.exclusiveGroupsChanged.destroy();
  }
}

layerClassRegistry.registerClass(Layer.className, Layer);
export default Layer;
