import { checkMaybe } from '@vcsuite/check';
import { getLogger } from '@vcsuite/logger';
import VcsEvent from '../event/vcsEvent.js';
import Collection from './collection.js';
import EventHandler from '../interaction/eventHandler.js';
import LayerCollection from './layerCollection.js';
import ClippingObjectManager from './clipping/clippingObjectManager.js';
import SplitScreen from './splitScreen.js';

/**
 * @typedef {Object} vcs.vcm.util.MapCollection.InitializationError
 * @property {Error} error
 * @property {vcs.vcm.maps.VcsMap} map
 */

/**
 * @param {vcs.vcm.maps.CesiumMap} cesiumMap
 * @param {vcs.vcm.maps.Openlayers} olMap
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
 * @memberOf vcs.vcm.util
 * @extends {vcs.vcm.util.Collection<vcs.vcm.maps.VcsMap>}
 */
// ignored do to static issues, see https://github.com/microsoft/TypeScript/issues/4628
// @ts-ignore
class MapCollection extends Collection {
  /**
   * Creates a LayerCollection from an iterable of layers, such as an Array.
   * @param {Iterable<vcs.vcm.maps.VcsMap>} iterable
   * @returns {vcs.vcm.util.MapCollection}
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
     * @type {vcs.vcm.maps.VcsMap}
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
     * @type {vcs.vcm.interaction.EventHandler}
     * @api
     */
    this.eventHandler = new EventHandler();

    /**
     * Collection of layers shared amongst the maps within this collection,
     * layers will be rendered if supported on the currently active map.
     * @type {vcs.vcm.util.LayerCollection}
     * @api
     */
    this.layerCollection = new LayerCollection();

    /**
     * Called, if a map fails to initialize. The map causing the error will be removed from the collection.
     * @type {vcs.vcm.event.VcsEvent<vcs.vcm.util.MapCollection.InitializationError>}
     * @api
     */
    this.initializeError = new VcsEvent();

    /**
     * Called, when a map (typically an oblique map) cannot show the current viewpoint. Is passed
     * the map which cannot show the current viewpoint.
     * @type {vcs.vcm.event.VcsEvent<vcs.vcm.maps.VcsMap>}
     * @api
     */
    this.fallbackMapActivated = new VcsEvent();

    /**
     * Called, when a map is activated. Is passed the activated map.
     * @type {vcs.vcm.event.VcsEvent<vcs.vcm.maps.VcsMap>}
     * @api
     */
    this.mapActivated = new VcsEvent();

    /**
     * Manages the clipping object for the maps in this collection.
     * @type {vcs.vcm.util.clipping.ClippingObjectManager}
     * @api
     */
    this.clippingObjectManager = new ClippingObjectManager(this.layerCollection);

    /**
     * @type {vcs.vcm.util.SplitScreen}
     */
    this.splitScreen = new SplitScreen(this.clippingObjectManager);

    /**
     * @type {Array<Function>}
     * @private
     */
    this._mapPointerListeners = [];
  }

  /**
   * The currently active map
   * @type {vcs.vcm.maps.VcsMap}
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
   * Adds a map to the collection. This will set the collections target, {@link vcs.vcm.util.SplitScreen}
   * and the collections {@link vcs.vcm.util.LayerCollection} on the map.
   * It will add map event listeners and pass them to the event handler of this collection.
   * @param {vcs.vcm.maps.VcsMap} map
   * @returns {number|null}
   */
  add(map) {
    const added = super.add(map);
    if (added !== null) {
      this._mapPointerListeners
        .push(map.pointerInteractionEvent.addEventListener(this.eventHandler.handleMapEvent.bind(this.eventHandler)));
      map.layerCollection = this.layerCollection;
      map.splitScreen = this.splitScreen;
      map.setTarget(this._target);
    }
    return added;
  }

  /**
   * Removes the map from the collection. Will also set splitScreen & target to null and an empty layerCollection on the map,
   * if the map is currently part of the collection.
   * @param {vcs.vcm.maps.VcsMap} map
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
   * @param {vcs.vcm.maps.VcsMap} map
   * @returns {null|vcs.vcm.maps.VcsMap}
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
   * @param {vcs.vcm.maps.VcsMap} map
   * @returns {null|vcs.vcm.maps.VcsMap}
   * @private
   */
  _getFallbackMapOrDefault(map) {
    const fallbackMap = this._getFallbackMap(map);
    return fallbackMap ||
      this.getByType('vcs.vcm.maps.Openlayers')[0] ||
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
      getLogger('vcs.vcm.util.MapCollection').warning(`could not find map with name ${mapName}`);
      return Promise.resolve();
    }

    if (
      this._activeMap &&
      this._activeMap.className === 'vcs.vcm.maps.Cesium' &&
      map.className === 'vcs.vcm.maps.Openlayers'
    ) {
      await setCesiumToOLViewpoint(
        /** @type {vcs.vcm.maps.CesiumMap} */ (this._activeMap),
        /** @type {vcs.vcm.maps.Openlayers} */ (map),
      );
    }

    try {
      await map.initialize();
    } catch (error) { // typically unsupported webGL and cesium map
      getLogger('vcs.vcm.util.MapCollection').error(error);
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
    this.splitScreen.mapActivated(map);
    this.mapActivated.raiseEvent(map);
    return Promise.resolve();
  }

  /**
   * Returns all maps of a specified type
   * @param {string} type
   * @returns {Array<vcs.vcm.maps.VcsMap>}
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
    [...this.layerCollection].forEach((l) => { l.destroy(); });
    this.layerCollection.destroy();
    this.eventHandler.destroy();
    this.mapActivated.destroy();
    this.clippingObjectManager.destroy();
    this.clippingObjectManager = null;
    this.splitScreen.destroy();
    this.splitScreen = null;
    this.fallbackMapActivated.destroy();
    this.initializeError.destroy();

    this._mapPointerListeners.forEach((cb) => { cb(); });
    this._mapPointerListeners = [];

    this._target = null;
  }
}

export default MapCollection;
