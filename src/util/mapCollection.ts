import { check, maybe, oneOf } from '@vcsuite/check';
import { getLogger } from '@vcsuite/logger';
import VcsEvent from '../vcsEvent.js';
import Collection from './collection.js';
import EventHandler from '../interaction/eventHandler.js';
import LayerCollection from './layerCollection.js';
import ClippingObjectManager from './clipping/clippingObjectManager.js';
import type OpenlayersMap from '../map/openlayersMap.js';
import type CesiumMap from '../map/cesiumMap.js';
// eslint-disable-next-line import/no-named-default
import type { default as VcsMap, VcsMapRenderEvent } from '../map/vcsMap.js';
import type Viewpoint from './viewpoint.js';
import { VisualisationType } from '../map/vcsMap.js';

export type MapCollectionInitializationError = {
  error: Error;
  map: VcsMap;
};

export type DisableMapControlOptions = {
  apiCalls: boolean;
  pointerEvents: boolean;
  keyEvents: boolean;
};

async function setCesiumToOLViewpoint(
  cesiumMap: CesiumMap,
  olMap: OpenlayersMap,
): Promise<void> {
  const viewpoint = cesiumMap.getViewpointSync();
  if (!viewpoint) {
    return;
  }
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

// ignored do to static issues, see https://github.com/microsoft/TypeScript/issues/4628
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
class MapCollection extends Collection<VcsMap> {
  /**
   * Creates a MapCollection from an iterable of maps, such as an Array.
   */
  static from(iterable: Iterable<VcsMap>): MapCollection {
    const collection = new MapCollection();

    if (iterable) {
      // eslint-disable-next-line no-restricted-syntax
      for (const map of iterable) {
        collection.add(map);
      }
    }
    return collection;
  }

  private _activeMap: VcsMap | null = null;

  private _target: HTMLElement | null = null;

  /**
   * if the active map is removed the last viewpoint is cached for the next mapActivation.
   */
  private _cachedViewpoint: Viewpoint | null = null;

  /**
   * The map pointer event handler. The EventHandler is shared amongst all maps within the collection.
   */
  eventHandler = new EventHandler();

  /**
   * Collection of layers shared amongst the maps within this collection,
   * layers will be rendered if supported on the currently active map.
   */
  private _layerCollection = new LayerCollection();

  /**
   * Called, if a map fails to initialize. The map causing the error will be removed from the collection.
   */
  initializeError: VcsEvent<MapCollectionInitializationError> = new VcsEvent();

  /**
   * Called, when a map (typically an oblique map) cannot show the current viewpoint. Is passed
   * the map which cannot show the current viewpoint.
   */
  fallbackMapActivated: VcsEvent<VcsMap> = new VcsEvent();

  /**
   * Called, when a map is activated. Is passed the activated map.
   */
  mapActivated: VcsEvent<VcsMap> = new VcsEvent();

  /**
   * Manages the clipping object for the maps in this collection.
   */
  clippingObjectManager: ClippingObjectManager;

  private _mapPointerListeners: (() => void)[] = [];

  private _splitPosition = 0.5;

  /**
   * Event raised when the maps split position changes. It passed the position as its only argument.
   */
  splitPositionChanged: VcsEvent<number> = new VcsEvent();

  private _postRender = new VcsEvent<VcsMapRenderEvent<VisualisationType>>();

  // eslint-disable-next-line class-methods-use-this
  private _postRenderListener: () => void = () => {};

  /** Callback function that is passed when calling requestExclusiveMapControls and called when exclusive map controls are forcefully removed. */
  // eslint-disable-next-line class-methods-use-this
  private _exclusiveMapControlsRemoved: () => void = () => {};

  constructor() {
    super();

    this.clippingObjectManager = new ClippingObjectManager(
      this._layerCollection,
    );
  }

  /**
   * The currently active map
   */
  get activeMap(): VcsMap | null {
    return this._activeMap;
  }

  /**
   * The currently set HTML element in which to render the maps
   */
  get target(): HTMLElement | null {
    return this._target;
  }

  /**
   * The current layer collection
   */
  get layerCollection(): LayerCollection {
    return this._layerCollection;
  }

  /**
   * Set the layer collection for these maps.
   */
  set layerCollection(layerCollection: LayerCollection) {
    check(layerCollection, LayerCollection);

    this._layerCollection = layerCollection;
    this._array.forEach((map) => {
      map.layerCollection = this._layerCollection;
    });
  }

  /**
   * The current splitPosition
   */
  get splitPosition(): number {
    return this._splitPosition;
  }

  /**
   * Set the splitPosition for these maps.
   */
  set splitPosition(position: number) {
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
   */
  get postRender(): VcsEvent<VcsMapRenderEvent<VisualisationType>> {
    return this._postRender;
  }

  /**
   * Adds a map to the collection. This will set the collections target
   * and the collections  on the map.
   * It will add map event listeners and pass them to the event handler of this collection.
   */
  add(map: VcsMap): number | null {
    const added = super.add(map);
    if (added !== null) {
      this._mapPointerListeners.push(
        map.pointerInteractionEvent.addEventListener(
          this.eventHandler.handleMapEvent.bind(this.eventHandler),
        ),
      );
      map.layerCollection = this._layerCollection;
      map.setTarget(this._target);
    }
    return added;
  }

  protected _remove(map: VcsMap): number {
    if (this._activeMap === map) {
      this._postRenderListener();
      this._postRenderListener = (): void => {};
      this._cachedViewpoint = map.getViewpointSync();
      if (this._target) {
        const mapClassName = this._activeMap.className;
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

  private _setActiveMapCSSClass(): void {
    if (this._target && this._activeMap) {
      const mapClassName = this._activeMap.className;
      this._target.classList.add(mapClassName);
    }
  }

  /**
   * Set the target for these maps.
   */
  setTarget(target: string | HTMLElement): void {
    check(target, maybe(oneOf(String, HTMLElement)));

    this._target =
      typeof target === 'string' ? document.getElementById(target) : target;
    this._array.forEach((map) => {
      map.setTarget(this._target);
    });

    this._setActiveMapCSSClass();
  }

  private _getFallbackMap(map: VcsMap): null | VcsMap {
    const { fallbackMap } = map;
    if (fallbackMap) {
      const fMap = this.getByKey(fallbackMap);
      if (fMap && fMap !== map) {
        return fMap;
      } else {
        getLogger().warning(
          `the fallback map with the name: ${fallbackMap} is missconfigured`,
        );
      }
    }
    return null;
  }

  private _getFallbackMapOrDefault(map: VcsMap): null | VcsMap {
    const fallbackMap = this._getFallbackMap(map);
    return fallbackMap || this.getByType('OpenlayersMap')[0] || this._array[0];
  }

  /**
   * Sets the active map. This will 1. get the current viewpoint of an acitve map (if one is set) 2.
   * determine that the map to be activated can show this viewpoint or has no fallback map set and 3.
   * activates the map 4. calls gotoViewpoint with the previous maps viewpoint
   */
  async setActiveMap(mapName: string): Promise<void> {
    const map = this.getByKey(mapName);
    if (!map) {
      getLogger('MapCollection').warning(
        `could not find map with name ${mapName}`,
      );
      return Promise.resolve();
    }

    if (
      this._activeMap &&
      this._activeMap.className === 'CesiumMap' &&
      map.className === 'OpenlayersMap'
    ) {
      await setCesiumToOLViewpoint(
        this._activeMap as CesiumMap,
        map as OpenlayersMap,
      );
    }

    try {
      await map.initialize();
    } catch (error) {
      // typically unsupported webGL and cesium map
      getLogger('MapCollection').error(String(error));
      this.remove(map);
      const fallbackMap = this._getFallbackMapOrDefault(map);
      this.initializeError.raiseEvent({
        map,
        error: error as Error,
      });
      if (!map.fallbackMap && map.fallbackToCurrentMap && this._activeMap) {
        this.fallbackMapActivated.raiseEvent(map);
        return Promise.resolve();
      }
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

      viewpoint = this._activeMap
        ? await this._activeMap.getViewpoint()
        : this._cachedViewpoint;

      const canShow = await map.canShowViewpoint(viewpoint as Viewpoint);
      if (!canShow) {
        const fallbackMap = this._getFallbackMap(map);
        if (fallbackMap) {
          this.fallbackMapActivated.raiseEvent(map);
          return this.setActiveMap(fallbackMap.name);
        }
        if (map.fallbackToCurrentMap && this._activeMap) {
          this.fallbackMapActivated.raiseEvent(map);
          return Promise.resolve();
        }
      }
      this._cachedViewpoint = null;
      if (this._activeMap) {
        this._activeMap.deactivate();
        if (this._target) {
          const mapClassName = this._activeMap.className;
          this._target.classList.remove(mapClassName);
        }
      }
    }

    const previousMap = this._activeMap;
    this._activeMap = map;
    await this._activeMap.activate();
    this._setActiveMapCSSClass();

    if (viewpoint) {
      await this._activeMap.gotoViewpoint(viewpoint);
    }

    const disableMapControlOptions: DisableMapControlOptions = {
      apiCalls: !!previousMap?.movementApiCallsDisabled,
      keyEvents: !!previousMap?.movementKeyEventsDisabled,
      pointerEvents: !!previousMap?.movementPointerEventsDisabled,
    };
    map.disableMovement(disableMapControlOptions);
    previousMap?.disableMovement(false);

    this.clippingObjectManager.mapActivated(map);
    this._postRenderListener();
    this._postRenderListener = this._activeMap.postRender.addEventListener(
      (event) => {
        this.postRender.raiseEvent(event);
      },
    );
    this.mapActivated.raiseEvent(map);
    return Promise.resolve();
  }

  /**
   * Returns all maps of a specified type
   */
  getByType(type: string): VcsMap[] {
    return this._array.filter((m) => m.className === type);
  }

  /**
   * Manages the disabling of map navigation controls. By calling this function the map navigation controls passed in the options are disabled. The remove function passed by the previous caller is executed.
   * @param options - which of the movement controls should be disabled.
   * @param removed - the callback for when the interaction is forcefully removed.
   * @returns function to reset map controls.
   */
  requestExclusiveMapControls(
    options: DisableMapControlOptions,
    removed: () => void,
  ): () => void {
    this._exclusiveMapControlsRemoved();
    if (this._activeMap) {
      this._activeMap.disableMovement(options);
    }

    this._exclusiveMapControlsRemoved = removed;

    return () => {
      // only reset if this function is called by the current exclusiveMapControls owner.
      if (removed === this._exclusiveMapControlsRemoved) {
        this._exclusiveMapControlsRemoved = (): void => {};
        if (this._activeMap) {
          this._activeMap.disableMovement(false);
        }
      }
    };
  }

  destroy(): void {
    super.destroy();
    [...this._layerCollection].forEach((l) => {
      l.destroy();
    });
    this._layerCollection.destroy();
    this.eventHandler.destroy();
    this.mapActivated.destroy();
    this.clippingObjectManager.destroy();
    this.splitPositionChanged.destroy();
    this.fallbackMapActivated.destroy();
    this.initializeError.destroy();

    this._mapPointerListeners.forEach((cb) => {
      cb();
    });
    this._mapPointerListeners = [];

    this._target = null;
  }
}

export default MapCollection;
