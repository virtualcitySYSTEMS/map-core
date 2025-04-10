import { check } from '@vcsuite/check';
import {
  clearClippingPlanes,
  setClippingPlanes,
} from './clippingPlaneHelper.js';
import ClippingObject, { type ClippingTarget } from './clippingObject.js';
import CesiumMap from '../../map/cesiumMap.js';
import type LayerCollection from '../layerCollection.js';
import type VcsMap from '../../map/vcsMap.js';
import type Layer from '../../layer/layer.js';

/**
 * ClippingObjectManager, a singleton Class for managing [ClippingObjects]{@link ClippingObject}. The manager takes care to only apply a
 * single [ClippingObject]{@link ClippingObject} to a target, such as a Cesium3DTileset or Entity.
 * The manager ensures, [ClippingObjects]{@link ClippingObject} which
 * can be manipulated by the user take precedence over other [ClippingObjects]{@link ClippingObject}.
 * [ClippingObjects]{@link ClippingObject} with the same target get
 * overwritten in the order they where added to the manager. Exclusive [ClippingObjects]{@link ClippingObject} are always applied last, even
 * if a default [ClippingObject]{@link ClippingObject} is added after.
 */
class ClippingObjectManager {
  static get className(): string {
    return 'ClippingObjectManager';
  }

  private _defaultClippingObjects = new Set<ClippingObject>();

  private _exclusiveClippingObjects: ClippingObject[] | null = null;

  private _targetsMap = new Map<ClippingTarget, ClippingObject>();

  private _listenersMap = new Map<ClippingObject, (() => void)[]>();

  private _exclusiveRemovedCb: (() => void) | null = null;

  initialized = false;

  private _updateSuspended = false;

  private _dirty = false;

  private _layerCollection: LayerCollection;

  private _activeMap: VcsMap | null = null;

  private _layerChangedListener: () => void;

  constructor(layerCollection: LayerCollection) {
    this._layerCollection = layerCollection;
    this._layerChangedListener =
      this._layerCollection.stateChanged.addEventListener((layer) => {
        this._layerChanged(layer);
      });
  }

  /**
   * Suspend updates, changes to managed [ClippingObjects] will not trigger a reset of targets or plane definitions
   */
  get suspendUpdate(): boolean {
    return this._updateSuspended;
  }

  set suspendUpdate(suspend: boolean) {
    check(suspend, Boolean);

    this._updateSuspended = suspend;
    if (!this._updateSuspended && this._dirty) {
      this._dirty = false;
      this._update();
    }
  }

  private _layerChanged(layer: Layer): void {
    this.suspendUpdate = true;
    this._defaultClippingObjects.forEach((co) => {
      co.handleLayerChanged(layer);
    });
    if (this._exclusiveClippingObjects) {
      this._exclusiveClippingObjects.forEach((co) => {
        co.handleLayerChanged(layer);
      });
    }
    this.suspendUpdate = false;
  }

  mapActivated(map: VcsMap): void {
    this.suspendUpdate = true;
    this._defaultClippingObjects.forEach((co) => {
      co.handleMapChanged(map);
    });
    if (this._exclusiveClippingObjects) {
      this._exclusiveClippingObjects.forEach((co) => {
        co.handleMapChanged(map);
      });
    }
    this.suspendUpdate = false;
    this._activeMap = map;
  }

  /**
   * Add a default [ClippingObject] to the manager. The order in which objects are added, determines their priority.
   * In case two objects have the same target, the one added last is applied. Should the last added object be removed,
   * the first one is re-applied. An object may not be added if is already part of the manager, use [hasClippingObject]
   * to test.
   */
  addClippingObject(clippingObject: ClippingObject): void {
    check(clippingObject, ClippingObject);

    if (this.hasClippingObject(clippingObject)) {
      throw new Error('ClippingObject already managed, remove it first');
    }
    if (this._activeMap instanceof CesiumMap) {
      clippingObject.handleMapChanged(this._activeMap);
    }

    clippingObject.setLayerCollection(this._layerCollection);

    this._defaultClippingObjects.add(clippingObject);

    this._listenersMap.set(clippingObject, [
      clippingObject.targetsUpdated.addEventListener(this._update.bind(this)),
      clippingObject.clippingPlaneUpdated.addEventListener(
        this._clippingPlaneUpdated.bind(this, clippingObject),
      ),
    ]);
    this._update();
  }

  /**
   * Remove a default [ClippingObject] instance from the manager.
   */
  removeClippingObject(clippingObject: ClippingObject): void {
    check(clippingObject, ClippingObject);

    if (this._defaultClippingObjects.has(clippingObject)) {
      this._defaultClippingObjects.delete(clippingObject);
      this._listenersMap.get(clippingObject)!.forEach((cb) => {
        cb();
      });
      this._listenersMap.delete(clippingObject);
      this._update();
    }
  }

  /**
   * Test if a  is part of managers context
   */
  hasClippingObject(clippingObject: ClippingObject): boolean {
    check(clippingObject, ClippingObject);

    return (
      this._defaultClippingObjects.has(clippingObject) ||
      !!(
        this._exclusiveClippingObjects &&
        this._exclusiveClippingObjects.includes(clippingObject)
      )
    );
  }

  /**
   * Sets an Array of [ClippingObjects] to be added to the managers context. Exclusive objects
   * are intended for [ClippingObjects] which can be directly manipulated by the user. They
   * are always applied last and will overwrite any managed default [ClippingObject] with the same targets.
   * The manager will only allow a single context (eg. one widget/plugin) for exclusive objects. Should the current context be switched or cleared, the provided
   * callback is called to inform the setting context of its removal.
   * @throws ClippingObjects is already managed
   */
  setExclusiveClippingObjects(
    clippingObjects: ClippingObject[],
    removedCb: () => void,
  ): void {
    check(clippingObjects, [ClippingObject]);
    check(removedCb, Function);

    if (clippingObjects.find((co) => this._defaultClippingObjects.has(co))) {
      throw new Error(
        'Some ClippingObjects are already managed, remove them first',
      );
    }

    this._clearExclusiveClippingObjects();
    this._exclusiveRemovedCb = removedCb;
    this._exclusiveClippingObjects = clippingObjects;
    this._exclusiveClippingObjects.forEach((clippingObject) => {
      if (this._activeMap instanceof CesiumMap) {
        clippingObject.handleMapChanged(this._activeMap);
      }

      clippingObject.setLayerCollection(this._layerCollection);

      this._listenersMap.set(clippingObject, [
        clippingObject.targetsUpdated.addEventListener(this._update.bind(this)),
        clippingObject.clippingPlaneUpdated.addEventListener(
          this._clippingPlaneUpdated.bind(this, clippingObject),
        ),
      ]);
    });
    this._update();
  }

  private _clearExclusiveClippingObjects(silent?: boolean): void {
    if (this._exclusiveClippingObjects) {
      this._exclusiveClippingObjects.forEach((cp) => {
        this._listenersMap.get(cp)!.forEach((cb) => {
          cb();
        });
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
   * Clears the exclusive set of [ClippingObject]. If called with the silent flag, the
   * removed callback is not called (eg. when removing exclusive clipping objects from the same context).
   * @param  silent
   */
  clearExclusiveClippingObjects(silent?: boolean): void {
    this._clearExclusiveClippingObjects(silent);
    this._update();
  }

  private _update(): void {
    if (this._updateSuspended) {
      this._dirty = true;
      return;
    }
    const currentTargets = new Set(this._targetsMap.keys());

    const setTargets = (clippingObject: ClippingObject): void => {
      clippingObject.targets.forEach((target) => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        if (target.isDestroyed && target.isDestroyed()) {
          return;
        }
        this._targetsMap.set(target, clippingObject);
        currentTargets.delete(target);
      });
    };

    this._targetsMap.clear();
    this._defaultClippingObjects.forEach(setTargets);
    if (this._exclusiveClippingObjects) {
      this._exclusiveClippingObjects.forEach(setTargets);
    }

    currentTargets.forEach((t) => {
      clearClippingPlanes(t);
    });
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

  private _clippingPlaneUpdated(clippingObject: ClippingObject): void {
    this._targetsMap.forEach((setClippingObject, target) => {
      if (
        setClippingObject === clippingObject &&
        clippingObject.clippingPlaneCollection
      ) {
        setClippingPlanes(target, clippingObject.clippingPlaneCollection);
      }
    });
  }

  destroy(): void {
    this._listenersMap.forEach((listeners) => {
      listeners.forEach((cb) => {
        cb();
      });
    });
    this._layerChangedListener();
    this._listenersMap.clear();
    this._targetsMap.clear();
    this._defaultClippingObjects.clear();
    this._exclusiveClippingObjects = null;
  }
}

export default ClippingObjectManager;
