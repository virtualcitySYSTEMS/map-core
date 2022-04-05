import { check } from '@vcsuite/check';
import { clearClippingPlanes, setClippingPlanes } from './clippingPlaneHelper.js';
import ClippingObject from './clippingObject.js';
import CesiumMap from '../../map/cesiumMap.js';

/**
 * ClippingObjectManager, a singleton Class for managing [ClippingObjects]{@link ClippingObject}. The manager takes care to only apply a
 * single [ClippingObject]{@link ClippingObject} to a target, such as a Cesium3DTileset or Entity.
 * The manager ensures, [ClippingObjects]{@link ClippingObject} which
 * can be manipulated by the user take precedence over other [ClippingObjects]{@link ClippingObject}.
 * [ClippingObjects]{@link ClippingObject} with the same target get
 * overwritten in the order they where added to the manager. Exclusive [ClippingObjects]{@link ClippingObject} are always applied last, even
 * if a default [ClippingObject]{@link ClippingObject} is added after.
 * @class
 * @export
 * @api stable
 */
class ClippingObjectManager {
  static get className() {
    return 'ClippingObjectManager';
  }

  constructor(layerCollection) {
    /**
     * @type {Set<ClippingObject>}
     * @private
     */
    this._defaultClippingObjects = new Set();
    /**
     * @type {Array<ClippingObject>}
     * @private
     */
    this._exclusiveClippingObjects = null;
    /**
     * @type {Map<(import("@vcmap/cesium").Globe|import("@vcmap/cesium").Entity|import("@vcmap/cesium").Cesium3DTileset), ClippingObject>}
     * @private
     */
    this._targetsMap = new Map();
    /**
     * @type {Map<ClippingObject, Array<Function>>}
     * @private
     */
    this._listenersMap = new Map();
    /**
     * @type {null|Function}
     * @private
     */
    this._exclusiveRemovedCb = null;
    /** @type {boolean} */
    this.initialized = false;
    /**
     * @type {boolean}
     * @private
     */
    this._updateSuspended = false;
    /**
     * @type {boolean}
     * @private
     */
    this._dirty = false;
    this._layerCollection = layerCollection;
    /**
     * @type {import("@vcmap/core").VcsMap|null}
     * @private
     */
    this._activeMap = null;
    /**
     * @type {Function}
     * @private
     */
    this._layerChangedListener = this._layerCollection.stateChanged.addEventListener((layer) => {
      this._layerChanged(layer);
    });
  }

  /**
   * Suspend updates, changes to managed [ClippingObjects]{@link ClippingObject} will not trigger a reset of targets or plane definitions
   * @type {boolean}
   * @api
   */
  get suspendUpdate() {
    return this._updateSuspended;
  }

  /**
   * @param {boolean} suspend
   */
  set suspendUpdate(suspend) {
    check(suspend, Boolean);

    this._updateSuspended = suspend;
    if (!this._updateSuspended && this._dirty) {
      this._dirty = false;
      this._update();
    }
  }

  /**
   * @param {import("@vcmap/core").Layer} layer
   * @private
   */
  _layerChanged(layer) {
    this.suspendUpdate = true;
    this._defaultClippingObjects.forEach((co) => { co.handleLayerChanged(layer); });
    if (this._exclusiveClippingObjects) {
      this._exclusiveClippingObjects.forEach((co) => { co.handleLayerChanged(layer); });
    }
    this.suspendUpdate = false;
  }

  /**
   * @param {import("@vcmap/core").VcsMap} map
   */
  mapActivated(map) {
    this.suspendUpdate = true;
    this._defaultClippingObjects.forEach((co) => { co.handleMapChanged(map); });
    if (this._exclusiveClippingObjects) {
      this._exclusiveClippingObjects.forEach((co) => { co.handleMapChanged(map); });
    }
    this.suspendUpdate = false;
    this._activeMap = map;
  }

  /**
   * Add a default [ClippingObject]{@link ClippingObject} to the manager. The order in which objects are added, determines their priority.
   * In case two objects have the same target, the one added last is applied. Should the last added object be removed,
   * the first one is re-applied. An object may not be added if is already part of the manager, use [hasClippingObject]{@link ClippingObjectManager#hasClippingObject}
   * to test.
   * @api
   * @param {ClippingObject} clippingObject
   * @throws ClippingObject is already managed
   */
  addClippingObject(clippingObject) {
    check(clippingObject, ClippingObject);

    if (this.hasClippingObject(clippingObject)) {
      throw new Error('ClippingObject already managed, remove it first');
    }
    clippingObject.setLayerCollection(this._layerCollection);

    this._defaultClippingObjects.add(clippingObject);
    if (this._activeMap instanceof CesiumMap) {
      clippingObject.handleMapChanged(this._activeMap);
    }

    this._listenersMap.set(clippingObject, [
      clippingObject.targetsUpdated.addEventListener(this._update.bind(this)),
      clippingObject.clippingPlaneUpdated.addEventListener(this._clippingPlaneUpdated.bind(this, clippingObject)),
    ]);
    this._update();
  }

  /**
   * Remove a default [ClippingObject]{@link ClippingObject} instance from the manager.
   * @api
   * @param {ClippingObject} clippingObject
   */
  removeClippingObject(clippingObject) {
    check(clippingObject, ClippingObject);

    if (this._defaultClippingObjects.has(clippingObject)) {
      this._defaultClippingObjects.delete(clippingObject);
      this._listenersMap.get(clippingObject).forEach((cb) => { cb(); });
      this._listenersMap.delete(clippingObject);
      this._update();
    }
  }

  /**
   * Test if a {@link ClippingObject} is part of managers context
   * @param {ClippingObject} clippingObject
   * @returns {boolean}
   * @api
   */
  hasClippingObject(clippingObject) {
    check(clippingObject, ClippingObject);

    return this._defaultClippingObjects.has(clippingObject) ||
      !!(this._exclusiveClippingObjects && this._exclusiveClippingObjects.includes(clippingObject));
  }

  /**
   * Sets an Array of [ClippingObjects]{@link ClippingObject} to be added to the managers context. Exclusive objects
   * are intended for [ClippingObjects]{@link ClippingObject} which can be directly manipulated by the user. They
   * are always applied last and will overwrite any managed default [ClippingObject]{@link ClippingObject} with the same targets.
   * The manager will only allow a single context (eg. one widget/plugin) for exclusive objects. Should the current context be switched or cleared, the provided
   * callback is called to inform the setting context of its removal.
   * @param {Array<ClippingObject>} clippingObjects
   * @param {Function} removedCb
   * @throws ClippingObjects is already managed
   * @api
   */
  setExclusiveClippingObjects(clippingObjects, removedCb) {
    check(clippingObjects, [ClippingObject]);
    check(removedCb, Function);

    if (clippingObjects.find(co => this._defaultClippingObjects.has(co))) {
      throw new Error('Some ClippingObjects are already managed, remove them first');
    }

    this._clearExclusiveClippingObjects();
    this._exclusiveRemovedCb = removedCb;
    this._exclusiveClippingObjects = clippingObjects;
    this._exclusiveClippingObjects.forEach((clippingObject) => {
      clippingObject.setLayerCollection(this._layerCollection);

      if (this._activeMap instanceof CesiumMap) {
        clippingObject.handleMapChanged(this._activeMap);
      }
      this._listenersMap.set(clippingObject, [
        clippingObject.targetsUpdated.addEventListener(this._update.bind(this)),
        clippingObject.clippingPlaneUpdated.addEventListener(this._clippingPlaneUpdated.bind(this, clippingObject)),
      ]);
    });
    this._update();
  }

  /**
   * @param {boolean=} silent
   * @private
   */
  _clearExclusiveClippingObjects(silent) {
    if (this._exclusiveClippingObjects) {
      this._exclusiveClippingObjects.forEach((cp) => {
        this._listenersMap.get(cp).forEach((cb) => { cb(); });
        this._listenersMap.delete(cp);
      });
      this._exclusiveClippingObjects = null;
    }
    if (!silent && this._exclusiveRemovedCb) {
      this._exclusiveRemovedCb();
    }
    this._exclusiveRemovedCb = null;
  }

  /**
   * Clears the exclusive set of [ClippingObject]{@link ClippingObject}. If called with the silent flag, the
   * removed callback is not called (eg. when removing exclusive clipping objects from the same context).
   * @param {boolean=} silent
   * @api
   */
  clearExclusiveClippingObjects(silent) {
    this._clearExclusiveClippingObjects(silent);
    this._update();
  }

  /**
   * @private
   */
  _update() {
    if (this._updateSuspended) {
      this._dirty = true;
      return;
    }
    const currentTargets = new Set(this._targetsMap.keys());

    /**
     * @param {ClippingObject} clippingObject
     */
    const setTargets = (clippingObject) => {
      clippingObject.targets.forEach((target) => {
        this._targetsMap.set(target, clippingObject);
        currentTargets.delete(target);
      });
    };

    this._targetsMap.clear();
    this._defaultClippingObjects.forEach(setTargets);
    if (this._exclusiveClippingObjects) {
      this._exclusiveClippingObjects.forEach(setTargets);
    }

    currentTargets.forEach((t) => { clearClippingPlanes(t); });
    this._targetsMap.forEach((clippingObject, target) => {
      if (clippingObject.clippingPlaneCollection) {
        setClippingPlanes(
          target,
          clippingObject.clippingPlaneCollection,
          clippingObject.local,
        );
      }
    });
  }

  /**
   * @param {ClippingObject} clippingObject
   * @private
   */
  _clippingPlaneUpdated(clippingObject) {
    this._targetsMap.forEach((setClippingObject, target) => {
      if (setClippingObject === clippingObject && clippingObject.clippingPlaneCollection) {
        setClippingPlanes(target, clippingObject.clippingPlaneCollection);
      }
    });
  }

  /**
   * Destroys this clippingObject Manager
   */
  destroy() {
    this._listenersMap.forEach((listeners) => {
      listeners.forEach((cb) => { cb(); });
    });
    this._layerChangedListener();
    this._listenersMap.clear();
    this._targetsMap.clear();
    this._defaultClippingObjects.clear();
    this._exclusiveClippingObjects = null;
  }
}

export default ClippingObjectManager;
