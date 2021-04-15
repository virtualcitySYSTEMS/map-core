import { v4 as uuidv4 } from 'uuid';
import { check, checkMaybe } from '@vcs/check';
import VcsObject from '../object.js';
import LayerCollection from '../util/layerCollection.js';
import MapState from './mapState.js';
import { vcsLayerName } from '../layer/layerSymbols.js';
import VcsEvent from '../event/vcsEvent.js';

/**
 * @namespace vcs.vcm.maps
 * @api stable
 */

/**
 * @typedef {vcs.vcm.VcsObject.Options} vcs.vcm.maps.VcsMap.Options
 * @property {string|undefined} fallbackMap - the name of the fallback map to use, e.g. in case there is no oblique image at the activation viewpoint
 * @property {vcs.vcm.util.LayerCollection|undefined} layerCollection - layerCollection to use, if not provided an empty Collection will be created.
 * @property {string|HTMLElement|undefined} target - the HTMLElement to render the map into
 * @api
 */

/**
 * @typedef {Object} vcs.vcm.maps.ClickPosition
 * @property {number} latitude
 * @property {number} longitude
 * @property {number|undefined} height
 * @property {number|undefined} groundLevel
 * @property {vcs.vcm.maps.Oblique.ClickParameters|undefined} obliqueParameters
 * @property {boolean|undefined} exactPosition
 * @api stable
 */

/**
 * @type {Object}
 */
const specificLayerImpl = {};

/**
 * Map Base Class, each different map is derived from this abstract base class.
 * @abstract
 * @class
 * @extends {vcs.vcm.VcsObject}
 * @api stable
 * @memberOf vcs.vcm.maps
 */
class VcsMap extends VcsObject {
  static get className() { return 'vcs.vcm.maps.VcsMap'; }

  static get specificLayerImpl() { return specificLayerImpl; }

  /**
   * @returns {vcs.vcm.maps.VcsMap.Options}
   */
  static getDefaultOptions() {
    return {
      fallbackMap: undefined,
    };
  }

  /**
   * @param {vcs.vcm.maps.VcsMap.Options} options
   */
  constructor(options) {
    super(options);

    /**
     * @type {HTMLElement}
     * @api
     */
    this.mapElement = document.createElement('div');
    this.mapElement.setAttribute('id', uuidv4());
    this.mapElement.classList.add('mapElement');
    this.mapElement.style.display = 'none';

    /**
     * @type {HTMLElement}
     * @private
     */
    this._target = null;
    if (options.target) {
      this.setTarget(options.target);
    }

    /**
     * The layer collection of this map. LayerCollections can be shared among maps.
     * When adding the map to a {@link vcs.vcm.util.MapCollection}, the layer collection of the {@link vcs.vcm.util.MapCollection} will be set.
     * @type {vcs.vcm.util.LayerCollection}
     * @private
     */
    this._layerCollection = options.layerCollection || new LayerCollection();

    /**
     * Whether to destroy the layerCollection when destroying the map. Defaults to
     * false if passing in a LayerCollection and true if a LayerCollection is created.
     * Is set to false, when setting a different LayerCollection.
     * @type {boolean}
     */
    this.destroyLayerCollection = !options.layerCollection;

    /**
     * @type {Array<Function>}
     * @private
     */
    this._collectionListeners = [
      this.layerCollection.moved.addEventListener((layer) => {
        this.indexChanged(layer);
      }),
      this.layerCollection.added.addEventListener((layer) => {
        this._layerAdded(layer);
      }),
      this.layerCollection.removed.addEventListener((layer) => {
        this._layerRemoved(layer);
      }),
    ];

    /** @type {boolean} */
    this.initialized = false;

    /**
     * if true, no movements should occur
     * @type {boolean}
     * @api
     */
    this.movementDisabled = false;

    /**
     * The name of a map to fall back on, if this map cant show a viewpoint
     * @type {string|null}
     * @api
     */
    this.fallbackMap = options.fallbackMap || null;

    /**
     * @type {Map<string, Set<Cesium/CustomDataSource|Cesium/CzmlDataSource|Cesium/PrimitiveCollection|Cesium/Cesium3DTileset|Cesium/ImageryLayer|ol/layer/Layer>>}
     * @private
     */
    this._visualizations = new Map();

    /**
     * @type {vcs.vcm.maps.MapState}
     * @private
     */
    this._state = MapState.INACTIVE;

    /**
     * Event raised when the maps state changes. Is passed the {@link vcs.vcm.maps.MapState} as its only argument.
     * @type {vcs.vcm.event.VcsEvent<vcs.vcm.maps.MapState>}
     * @api
     */
    this.stateChanged = new VcsEvent();
    /**
     * Event raised then the map has a pointer interaction. Raises {@link vcs.vcm.interaction.MapEvent}.
     * @type {vcs.vcm.event.VcsEvent<vcs.vcm.interaction.MapEvent>}
     * @api
     */
    this.pointerInteractionEvent = new VcsEvent();
    /**
     * If present, the split screen to use on this map. Is set by the mapCollection
     * @type {vcs.vcm.util.SplitScreen|null}
     * @api
     */
    this.splitScreen = null;
  }

  /**
   * Whether the map is active or not
   * @type {boolean}
   * @api
   * @readonly
   */
  get active() {
    return this._state === MapState.ACTIVE;
  }

  /**
   * Whether the map is loading or not
   * @type {boolean}
   * @api
   * @readonly
   */
  get loading() {
    return this._state === MapState.LOADING;
  }

  /**
   * The currently set HTML element in which to render the map
   * @type {HTMLElement|null}
   * @api
   * @readonly
   */
  get target() {
    return this._target;
  }

  /**
   * The layer collection of this map. LayerCollections can be shared among maps.
   * When adding the map to a {@link vcs.vcm.util.MapCollection}, the layer collection of the {@link vcs.vcm.util.MapCollection} will be set.
   * When setting the layer colleciton, the destroyLayerCollection flag is automatically set to false.
   * @type {vcs.vcm.util.LayerCollection}
   * @api
   */
  get layerCollection() {
    return this._layerCollection;
  }

  /**
   * @param {vcs.vcm.util.LayerCollection} layerCollection
   */
  set layerCollection(layerCollection) {
    check(layerCollection, LayerCollection);

    this.destroyLayerCollection = false;

    [...this._layerCollection].forEach((l) => {
      l.removedFromMap(this);
    });
    this._layerCollection = layerCollection;

    if (this.active) {
      [...this._layerCollection].forEach((l) => {
        l.mapActivated(this);
      });
    }
  }

  /**
   * Determines whether this map can show this viewpoint. Returns true in any other map then {@link vcs.vcm.maps.Oblique}
   * @param {vcs.vcm.util.ViewPoint} viewpoint
   * @returns {Promise<boolean>}
   * @api
   */
  // eslint-disable-next-line no-unused-vars,class-methods-use-this
  canShowViewpoint(viewpoint) {
    return Promise.resolve(true);
  }

  /**
   * Sets the map target.
   * @param {string|HTMLElement|null} target
   * @api
   */
  setTarget(target) {
    checkMaybe(target, [String, HTMLElement]);

    if (this._target) {
      this._target.removeChild(this.mapElement);
    }

    this._target = typeof target === 'string' ? document.getElementById(target) : target;
    if (this._target) {
      this._target.appendChild(this.mapElement);
    }
  }

  /**
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line class-methods-use-this,no-empty-function
  async initialize() {}

  /**
   * is called if a layer changes its position in the layerCollection.
   * @param {vcs.vcm.layer.Layer} layer
   */
  // eslint-disable-next-line no-unused-vars,class-methods-use-this
  indexChanged(layer) {}

  /**
   * is called if a layer is added to the layerCollection.
   * @param {vcs.vcm.layer.Layer} layer
   * @private
   */
  _layerAdded(layer) {
    if (this.active) {
      layer.mapActivated(this);
    }
  }

  /**
   * is called if a layer is added to the layerCollection.
   * @param {vcs.vcm.layer.Layer} layer
   * @private
   */
  _layerRemoved(layer) {
    layer.removedFromMap(this);
  }

  /**
   * Validates a visualization. A visualization must have the vcsLayeName symbol set and a layer with said name must be
   * part of the maps layerCollection.
   * @param {Cesium/CustomDataSource|Cesium/PrimitiveCollection|Cesium/Cesium3DTileset|Cesium/ImageryLayer|ol/layer/Layer} item
   * @returns {boolean}
   */
  validateVisualization(item) {
    const layerName = item[vcsLayerName];
    if (layerName == null) {
      this.getLogger().warning('item is missing vcsLayerName symbol');
      return false;
    }

    return this.layerCollection.hasKey(layerName);
  }

  /**
   * Adds a visualization to the visualizations map for its layer. The visualization must be valid, use validateVisualization first
   * @param {Cesium/CustomDataSource|Cesium/PrimitiveCollection|Cesium/Cesium3DTileset|Cesium/ImageryLayer|ol/layer/Layer} item
   */
  addVisualization(item) {
    if (!this.validateVisualization(item)) {
      throw new Error('Visualization item is not valid, validate before adding');
    }
    const layerName = item[vcsLayerName];
    if (!this._visualizations.has(layerName)) {
      this._visualizations.set(layerName, new Set());
    }
    this._visualizations.get(layerName).add(item);
  }

  /**
   * Removes a visualization
   * @param {Cesium/PrimitiveCollection|Cesium/Cesium3DTileset|Cesium/ImageryLayer|ol/layer/Layer|Cesium/CustomDataSource} item
   */
  removeVisualization(item) {
    const layerName = item[vcsLayerName];
    const viz = this._visualizations.get(layerName);
    if (viz) {
      viz.delete(item);
      if (viz.size === 0) {
        this._visualizations.delete(layerName);
      }
    }
  }

  /**
   * Gets the visualizations for a specific layer.
   * @param {vcs.vcm.layer.Layer} layer
   * @returns {Set<Cesium/PrimitiveCollection|Cesium/Cesium3DTileset|Cesium/ImageryLayer|ol/layer/Layer|Cesium/CustomDataSource>}
   * @api
   */
  getVisualizationsForLayer(layer) {
    return this._visualizations.get(layer.name);
  }

  /**
   * Get all visualizations added to this map.
   * @returns {Array<Cesium/PrimitiveCollection|Cesium/Cesium3DTileset|Cesium/ImageryLayer|ol/layer/Layer|Cesium/CustomDataSource>}
   * @api
   */
  getVisualizations() {
    return [...this._visualizations.values()]
      .map(layerVisualizations => [...layerVisualizations])
      .flat();
  }

  /**
   * activates the map, if necessary initializes the map.
   * Once the promise resolves, the map can still be inactive, if deactivate was called while the map was activating.
   * @returns {Promise<void>}
   * @api stable
   */
  async activate() {
    if (this._state === MapState.INACTIVE) {
      this._state = MapState.LOADING;
      this.stateChanged.raiseEvent(MapState.LOADING);
      this.mapElement.style.display = '';
      await this.initialize();
      if (this._state !== MapState.LOADING) {
        return;
      }
      this._state = MapState.ACTIVE;
      await Promise.all([...this.layerCollection].map(layer => layer.mapActivated(this)));
      if (this._state !== MapState.ACTIVE) {
        return;
      }
      this.stateChanged.raiseEvent(this._state);
    }
  }

  /**
   * deactivates the map
   * @api stable
   */
  deactivate() {
    if (this._state !== MapState.INACTIVE) {
      this.mapElement.style.display = 'none';
      this._state = MapState.INACTIVE;
      [...this.layerCollection].forEach((layer) => {
        layer.mapDeactivated(this);
      });
      this.stateChanged.raiseEvent(this._state);
    }
  }

  /**
   * prevent all movement, including navigation controls, gotoViewPoint & setting of oblique images
   * @param {boolean} prevent
   * @api
   */
  disableMovement(prevent) {
    this.movementDisabled = prevent;
  }

  /**
   * sets the view to the given viewpoint
   * @param {vcs.vcm.util.ViewPoint} viewpoint
   * @param {number=} optMaximumHeight during animation (can be used to get rid of the bunny hop)
   * gotoViewPoint
   * @returns {Promise<void>}
   * @api stable
   */
  // eslint-disable-next-line no-unused-vars,class-methods-use-this
  gotoViewPoint(viewpoint, optMaximumHeight) {
    return Promise.resolve();
  }

  // eslint-disable-next-line jsdoc/require-returns-check
  /**
   * Returns the most precise viewpoint possible in Oblique.
   * @api
   * @returns {Promise<vcs.vcm.util.ViewPoint|null>}
   */
  // eslint-disable-next-line class-methods-use-this
  async getViewPoint() {
    return null;
  }

  /**
   * Returns an approximate viewpoint in Oblique, not requesting terrain.
   * @api
   * @returns {vcs.vcm.util.ViewPoint|null}
   */
  // eslint-disable-next-line class-methods-use-this
  getViewPointSync() {
    return null;
  }

  /**
   * Resolution in meters per pixe
   * @param {ol/Coordinate} coordinate - coordinate in mercator for which to determine resolution. only required in 3D
   * @returns {number}
   * @api
   */
  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  getCurrentResolution(coordinate) {
    return 1;
  }

  /**
   * @param {ol/Coordinate} coords in WGS84 degrees
   * @returns {boolean}
   * @api
   */
  // eslint-disable-next-line no-unused-vars,class-methods-use-this
  pointIsVisible(coords) { return false; }

  /**
   * Requests this map to render when possible
   * @api
   */
  // eslint-disable-next-line class-methods-use-this
  requestRender() {}

  /**
   * @returns {vcs.vcm.maps.VcsMap.Options}
   * @api
   */
  getConfigObject() {
    const config = /** @type {vcs.vcm.maps.VcsMap.Options} */ (super.getConfigObject());
    if (this.fallbackMap) {
      config.fallbackMap = this.fallbackMap;
    }
    return config;
  }

  /**
   * disposes the map
   * @api stable
   */
  destroy() {
    super.destroy();
    if (this.mapElement) {
      if (this.mapElement.parentElement) {
        this.mapElement.parentElement.removeChild(this.mapElement);
      }
      this.mapElement = null;
    }
    this._target = null;

    this._collectionListeners.forEach((cb) => { cb(); });
    this._collectionListeners = [];

    [...this.layerCollection].forEach((l) => { l.removedFromMap(this); });
    if (this.stateChanged) {
      this.stateChanged.destroy();
      this.stateChanged = null;
    }

    if (this.destroyLayerCollection) {
      this.layerCollection.destroy();
    }

    if (this.pointerInteractionEvent) {
      this.pointerInteractionEvent.destroy();
      this.pointerInteractionEvent = null;
    }
    this._layerCollection = null;
  }
}

export default VcsMap;
