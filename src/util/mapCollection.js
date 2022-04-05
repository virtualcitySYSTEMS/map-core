import { check, checkMaybe } from '@vcsuite/check';
import { getLogger } from '@vcsuite/logger';
import VcsEvent from '../vcsEvent.js';
import Collection from './collection.js';
import EventHandler from '../interaction/eventHandler.js';
import LayerCollection from './layerCollection.js';
import ClippingObjectManager from './clipping/clippingObjectManager.js';
import SplitScreen from './splitScreen.js';

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
  const viewPoint = cesiumMap.getViewPointSync();
  const northDownVp = viewPoint.clone();
  northDownVp.heading = 0;
  northDownVp.pitch = -90;
  if (viewPoint && !viewPoint.equals(northDownVp)) {
    if (olMap.fixedNorthOrientation) {
      viewPoint.heading = 0;
    }

    viewPoint.pitch = -90;
    viewPoint.animate = true;
    viewPoint.duration = 1;

    if (viewPoint.groundPosition) {
      viewPoint.cameraPosition = null;
    }

    await cesiumMap.gotoViewPoint(viewPoint);
  }
}

/**
 * @class
 * @export
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
     * @type {SplitScreen}
     * @private
     */
    this._splitScreen = new SplitScreen(this.clippingObjectManager);

    /**
     * @type {Array<Function>}
     * @private
     */
    this._mapPointerListeners = [];
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
   * The current split screen
   * @type {SplitScreen}
   */
  get splitScreen() {
    return this._splitScreen;
  }

  /**
   * Set split screen for these maps.
   * @param {SplitScreen} splitScreen
   */
  set splitScreen(splitScreen) {
    check(splitScreen, SplitScreen);

    this._splitScreen = splitScreen;
    this._array.forEach((map) => {
      map.splitScreen = this._splitScreen;
    });
  }

  /**
   * Adds a map to the collection. This will set the collections target, {@link SplitScreen}
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
      map.splitScreen = this._splitScreen;
      map.setTarget(this._target);
    }
    return added;
  }

  /**
   * Removes the map from the collection. Will also set _splitScreen & target to null and an empty _layerCollection on the map,
   * if the map is currently part of the collection.
   * @param {import("@vcmap/core").VcsMap} map
   */
  remove(map) {
    if (this.has(map)) {
      map.setTarget(null);
      map.splitScreen = null;
      map.layerCollection = new LayerCollection();
    }
    super.remove(map);
    if (this._activeMap === map) {
      this._activeMap = null;
    }
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
    if (this._activeMap) {
      if (this._activeMap === map) {
        return map.activate();
      }

      viewpoint = await this._activeMap.getViewPoint();
      const canShow = await map.canShowViewpoint(viewpoint);
      if (!canShow) {
        const fallbackMap = this._getFallbackMap(map);
        if (fallbackMap) {
          this.fallbackMapActivated.raiseEvent(map);
          return this.setActiveMap(fallbackMap.name);
        }
      }
      this._activeMap.deactivate();
      if (this._target) {
        const mapClassName = this._activeMap.className.split('.').pop();
        this._target.classList.remove(mapClassName);
      }
    }

    this._activeMap = map;
    await this._activeMap.activate();
    this._setActiveMapCSSClass();

    if (viewpoint) {
      await this._activeMap.gotoViewPoint(viewpoint);
    }

    this.clippingObjectManager.mapActivated(map);
    this._splitScreen.mapActivated(map);
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
    this._splitScreen.destroy();
    this._splitScreen = null;
    this.fallbackMapActivated.destroy();
    this.initializeError.destroy();

    this._mapPointerListeners.forEach((cb) => { cb(); });
    this._mapPointerListeners = [];

    this._target = null;
  }
}

export default MapCollection;
