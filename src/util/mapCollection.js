import { check, checkMaybe } from '@vcsuite/check';
import { getLogger } from '@vcsuite/logger';
import VcsEvent from '../vcsEvent.js';
import Collection from './collection.js';
import EventHandler from '../interaction/eventHandler.js';
import LayerCollection from './layerCollection.js';
import ClippingObjectManager from './clipping/clippingObjectManager.js';

/**
 * @typedef {Object} MapCollectionInitializationError
 * @property {Error} error
 * @property {import("@vcmap/core").VcsMap} map
 */

/**
 * @param {import("@vcmap/core").CesiumMap} cesiumMap
 * @param {import("@vcmap/core").OpenlayersMap} olMap
 * @returns {Promise<void>}
 */
async function setCesiumToOLViewpoint(cesiumMap, olMap) {
  const viewpoint = cesiumMap.getViewpointSync();
  const northDownVp = viewpoint.clone();
  northDownVp.heading = 0;
  northDownVp.pitch = -90;
  if (viewpoint && !viewpoint.equals(northDownVp)) {
    if (olMap.fixedNorthOrientation) {
      viewpoint.heading = 0;
    }

    viewpoint.pitch = -90;
    viewpoint.animate = true;
    viewpoint.duration = 1;

    if (viewpoint.groundPosition) {
      viewpoint.cameraPosition = null;
    }

    await cesiumMap.gotoViewpoint(viewpoint);
  }
}

/**
 * @class
 * @extends {Collection<import("@vcmap/core").VcsMap>}}
 */
// ignored do to static issues, see https://github.com/microsoft/TypeScript/issues/4628
// @ts-ignore
class MapCollection extends Collection {
  /**
   * Creates a LayerCollection from an iterable of layers, such as an Array.
   * @param {Iterable<import("@vcmap/core").VcsMap>} iterable
   * @returns {MapCollection}
   * @override
   * @api
   */
  static from(iterable) {
    const collection = new MapCollection();

    if (iterable) {
      // eslint-disable-next-line no-restricted-syntax
      for (const map of iterable) {
        collection.add(map);
      }
    }
    return collection;
  }

  constructor() {
    super();

    /**
     * @type {import("@vcmap/core").VcsMap}
     * @private
     */
    this._activeMap = null;

    /**
     *
     * @type {HTMLElement}
     * @private
     */
    this._target = null;

    /**
     * if the active map is removed the last viewpoint is cached for the next mapActivation.
     * @type {import("@vcmap/core").Viewpoint}
     * @private
     */
    this._cachedViewpoint = null;

    /**
     * The map pointer event handler. The EventHandler is shared amongst all maps within the collection.
     * @type {EventHandler}
     * @api
     */
    this.eventHandler = new EventHandler();

    /**
     * Collection of layers shared amongst the maps within this collection,
     * layers will be rendered if supported on the currently active map.
     * @type {LayerCollection}
     */
    this._layerCollection = new LayerCollection();

    /**
     * Called, if a map fails to initialize. The map causing the error will be removed from the collection.
     * @type {VcsEvent<MapCollectionInitializationError>}
     * @api
     */
    this.initializeError = new VcsEvent();

    /**
     * Called, when a map (typically an oblique map) cannot show the current viewpoint. Is passed
     * the map which cannot show the current viewpoint.
     * @type {VcsEvent<import("@vcmap/core").VcsMap>}
     * @api
     */
    this.fallbackMapActivated = new VcsEvent();

    /**
     * Called, when a map is activated. Is passed the activated map.
     * @type {VcsEvent<import("@vcmap/core").VcsMap>}
     * @api
     */
    this.mapActivated = new VcsEvent();

    /**
     * Manages the clipping object for the maps in this collection.
     * @type {ClippingObjectManager}
     * @api
     */
    this.clippingObjectManager = new ClippingObjectManager(this._layerCollection);

    /**
     * @type {Array<Function>}
     * @private
     */
    this._mapPointerListeners = [];
    /**
     * @type {number}
     * @private
     */
    this._splitPosition = 0.5;
    /**
     * Event raised when the maps split position changes. It passed the position as its only argument.
     * @type {VcsEvent<number>}
     * @api
     */
    this.splitPositionChanged = new VcsEvent();
    /**
     * @type {VcsEvent<VcsMapRenderEvent>}
     * @private
     */
    this._postRender = new VcsEvent();
    /**
     * @type {function():void}
     * @private
     */
    this._postRenderListener = () => {};
  }

  /**
   * The currently active map
   * @type {import("@vcmap/core").VcsMap}
   * @api
   * @readonly
   */
  get activeMap() { return this._activeMap; }

  /**
   * The currently set HTML element in which to render the maps
   * @type {HTMLElement|null}
   * @api
   * @readonly
   */
  get target() {
    return this._target;
  }

  /**
   * The current layer collection
   * @type {LayerCollection}
   */
  get layerCollection() {
    return this._layerCollection;
  }

  /**
   * Set the layer collection for these maps.
   * @param {LayerCollection} layerCollection
   */
  set layerCollection(layerCollection) {
    check(layerCollection, LayerCollection);

    this._layerCollection = layerCollection;
    this._array.forEach((map) => {
      map.layerCollection = this._layerCollection;
    });
  }

  /**
   * The current splitPosition
   * @type {number}
   */
  get splitPosition() {
    return this._splitPosition;
  }

  /**
   * Set the splitPosition for these maps.
   * @param {number} position
   */
  set splitPosition(position) {
    check(position, Number);
    if (position < 0 || position > 1) {
      throw new Error('Position must be between 0 and 1');
    }

    if (Math.abs(this._splitPosition - position) > 0.0001) {
      this._splitPosition = position;
      this._array.forEach((map) => {
        map.splitPosition = this._splitPosition;
      });
      this.splitPositionChanged.raiseEvent(position);
    }
  }

  /**
   * Raised on the active maps post render event
   * @type {VcsEvent<VcsMapRenderEvent>}
   * @readonly
   */
  get postRender() {
    return this._postRender;
  }

  /**
   * Adds a map to the collection. This will set the collections target
   * and the collections {@link LayerCollection} on the map.
   * It will add map event listeners and pass them to the event handler of this collection.
   * @param {import("@vcmap/core").VcsMap} map
   * @returns {number|null}
   */
  add(map) {
    const added = super.add(map);
    if (added !== null) {
      this._mapPointerListeners
        .push(map.pointerInteractionEvent.addEventListener(this.eventHandler.handleMapEvent.bind(this.eventHandler)));
      map.layerCollection = this._layerCollection;
      map.setTarget(this._target);
    }
    return added;
  }

  /**
   * @param {import("@vcmap/core").VcsMap} map
   * @returns {number}
   * @protected
   */
  _remove(map) {
    if (this._activeMap === map) {
      this._postRenderListener();
      this._postRenderListener = () => {};
      this._cachedViewpoint = map.getViewpointSync();
      if (this._target) {
        const mapClassName = this._activeMap.className.split('.').pop();
        this._target.classList.remove(mapClassName);
      }
      this._activeMap = null;
    }
    if (this.has(map)) {
      map.setTarget(null);
      map.layerCollection = new LayerCollection();
    }
    return super._remove(map);
  }

  /**
   * @private
   */
  _setActiveMapCSSClass() {
    if (this._target && this._activeMap) {
      const mapClassName = this._activeMap.className.split('.').pop();
      this._target.classList.add(mapClassName);
    }
  }

  /**
   * Set the target for these maps.
   * @param {(string|HTMLElement)} target
   * @api
   */
  setTarget(target) {
    checkMaybe(target, [String, HTMLElement]);

    this._target = typeof target === 'string' ? document.getElementById(target) : target;
    this._array.forEach((map) => {
      map.setTarget(this._target);
    });

    this._setActiveMapCSSClass();
  }

  /**
   * @param {import("@vcmap/core").VcsMap} map
   * @returns {null|import("@vcmap/core").VcsMap}
   * @private
   */
  _getFallbackMap(map) {
    const { fallbackMap } = map;
    if (fallbackMap) {
      const fMap = this.getByKey(fallbackMap);
      if (fMap && fMap !== map) {
        return fMap;
      } else {
        getLogger().warning(`the fallback map with the name: ${fallbackMap} is missconfigured`);
      }
    }
    return null;
  }

  /**
   * @param {import("@vcmap/core").VcsMap} map
   * @returns {null|import("@vcmap/core").VcsMap}
   * @private
   */
  _getFallbackMapOrDefault(map) {
    const fallbackMap = this._getFallbackMap(map);
    return fallbackMap ||
      this.getByType('OpenlayersMap')[0] ||
      this._array[0];
  }

  /**
   * Sets the active map. This will 1. get the current viewpoint of an acitve map (if one is set) 2.
   * determine that the map to be activated can show this viewpoint or has no fallback map set and 3.
   * activates the map 4. calls gotoViewpoint with the previous maps viewpoint
   * @param {string} mapName
   * @returns {Promise<void>}
   */
  async setActiveMap(mapName) {
    const map = this.getByKey(mapName);
    if (!map) {
      getLogger('MapCollection').warning(`could not find map with name ${mapName}`);
      return Promise.resolve();
    }

    if (
      this._activeMap &&
      this._activeMap.className === 'CesiumMap' &&
      map.className === 'OpenlayersMap'
    ) {
      await setCesiumToOLViewpoint(
        /** @type {import("@vcmap/core").CesiumMap} */ (this._activeMap),
        /** @type {import("@vcmap/core").OpenlayersMap} */ (map),
      );
    }

    try {
      await map.initialize();
    } catch (error) { // typically unsupported webGL and cesium map
      getLogger('MapCollection').error(error);
      this.remove(map);
      const fallbackMap = this._getFallbackMapOrDefault(map);
      this.initializeError.raiseEvent({
        map,
        error,
      });
      if (fallbackMap) {
        this.fallbackMapActivated.raiseEvent(map);
        return this.setActiveMap(fallbackMap.name);
      }
      throw new Error('cannot activate a single map');
    }

    let viewpoint;
    if (this._activeMap || this._cachedViewpoint) {
      if (this._activeMap === map) {
        return map.activate();
      }

      viewpoint = this._activeMap ? await this._activeMap.getViewpoint() : this._cachedViewpoint;

      const canShow = await map.canShowViewpoint(viewpoint);
      if (!canShow) {
        const fallbackMap = this._getFallbackMap(map);
        if (fallbackMap) {
          this.fallbackMapActivated.raiseEvent(map);
          return this.setActiveMap(fallbackMap.name);
        }
      }
      this._cachedViewpoint = null;
      if (this._activeMap) {
        this._activeMap.deactivate();
        if (this._target) {
          const mapClassName = this._activeMap.className.split('.').pop();
          this._target.classList.remove(mapClassName);
        }
      }
    }

    this._activeMap = map;
    await this._activeMap.activate();
    this._setActiveMapCSSClass();

    if (viewpoint) {
      await this._activeMap.gotoViewpoint(viewpoint);
    }

    this.clippingObjectManager.mapActivated(map);
    this._postRenderListener();
    this._postRenderListener = this._activeMap.postRender.addEventListener((event) => {
      this.postRender.raiseEvent(event);
    });
    this.mapActivated.raiseEvent(map);
    return Promise.resolve();
  }

  /**
   * Returns all maps of a specified type
   * @param {string} type
   * @returns {Array<import("@vcmap/core").VcsMap>}
   * @api
   */
  getByType(type) {
    return this._array.filter(m => m.className === type);
  }

  /**
   * @inheritDoc
   */
  destroy() {
    super.destroy();
    [...this._layerCollection].forEach((l) => { l.destroy(); });
    this._layerCollection.destroy();
    this.eventHandler.destroy();
    this.mapActivated.destroy();
    this.clippingObjectManager.destroy();
    this.clippingObjectManager = null;
    this.splitPositionChanged.destroy();
    this.fallbackMapActivated.destroy();
    this.initializeError.destroy();

    this._mapPointerListeners.forEach((cb) => { cb(); });
    this._mapPointerListeners = [];

    this._target = null;
  }
}

export default MapCollection;
