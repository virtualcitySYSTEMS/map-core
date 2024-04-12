import { getLogger as getLoggerByName, Logger } from '@vcsuite/logger';
import { v4 as uuidv4 } from 'uuid';
import type { MapEvent as OLMapEvent } from 'ol';
import type { Layer as OLLayer } from 'ol/layer.js';
import type { Coordinate } from 'ol/coordinate.js';

import { check, is, maybe, oneOf } from '@vcsuite/check';
import VcsObject, { VcsObjectOptions } from '../vcsObject.js';
import LayerCollection from '../util/layerCollection.js';
import MapState from './mapState.js';
import { vcsLayerName } from '../layer/layerSymbols.js';
import VcsEvent from '../vcsEvent.js';
import { mapClassRegistry } from '../classRegistry.js';
import type { CesiumMapEvent } from './cesiumMap.js';
import { CesiumVisualisationType } from './cesiumMap.js';
import type Viewpoint from '../util/viewpoint.js';
import type Layer from '../layer/layer.js';
import type { MapEvent } from '../interaction/abstractInteraction.js';
import type { DisableMapControlOptions } from '../util/mapCollection.js';

function getLogger(): Logger {
  return getLoggerByName('vcMap');
}

export type VcsMapOptions = VcsObjectOptions & {
  /**
   * the name of the fallback map to use, e.g. in case there is no oblique image at the activation viewpoint
   */
  fallbackMap?: string;
  /**
   * layerCollection to use, if not provided an empty Collection will be created.
   */
  layerCollection?: LayerCollection;
  /**
   * the HTMLElement to render the map into
   */
  target?: string | HTMLElement;
};

export type VisualisationType = CesiumVisualisationType | OLLayer;

export type VcsMapRenderEvent<V extends VisualisationType> = {
  map: VcsMap;
  originalEvent: V extends OLLayer ? OLMapEvent : CesiumMapEvent;
};

/**
 * Map Base Class, each different map is derived from this abstract base class.
 * @group Map
 */
class VcsMap<
  V extends VisualisationType = VisualisationType,
> extends VcsObject {
  static get className(): string {
    return 'VcsMap';
  }

  static getDefaultOptions(): VcsMapOptions {
    return {
      fallbackMap: undefined,
    };
  }

  mapElement: HTMLElement;

  private _target: HTMLElement | null;

  /**
   * The layer collection of this map. LayerCollections can be shared among maps.
   * When adding the map to a {@link MapCollection}, the layer collection of the {@link MapCollection} will be set.
   */
  private _layerCollection: LayerCollection;

  /**
   * Whether to destroy the layerCollection when destroying the map. Defaults to
   * false if passing in a LayerCollection and true if a LayerCollection is created.
   * Is set to false, when setting a different LayerCollection.
   */
  destroyLayerCollection: boolean;

  private _collectionListeners: (() => void)[];

  initialized: boolean;

  private _movementApiCallsDisabled = false;

  private _movementKeyEventsDisabled = false;

  private _movementPointerEventsDisabled = false;

  /**
   * The name of a map to fall back on, if this map cant show a viewpoint
   */

  fallbackMap: string | null;

  private _visualizations: Map<string, Set<V>>;

  private _state: MapState;

  /**
   * Event raised when the maps state changes. Is passed the {@link MapState} as its only argument.
   */
  stateChanged: VcsEvent<MapState>;

  /**
   * Event raised then the map has a pointer interaction. Raises {@link MapEvent}.
   */
  pointerInteractionEvent: VcsEvent<MapEvent>;

  /**
   * The split position to use on this map. Is set by the mapCollection
   */
  private _splitPosition: number;

  private _postRender: VcsEvent<VcsMapRenderEvent<V>>;

  /**
   * @param  options
   */
  constructor(options: VcsMapOptions) {
    super(options);

    this.mapElement = document.createElement('div');
    this.mapElement.setAttribute('id', uuidv4());
    this.mapElement.classList.add('mapElement');
    this.mapElement.style.display = 'none';

    this._target = null;
    if (options.target) {
      this.setTarget(options.target);
    }

    this._layerCollection = options.layerCollection || new LayerCollection();

    this.destroyLayerCollection = !options.layerCollection;

    this._collectionListeners = [];

    this._setLayerCollectionListeners();

    this.initialized = false;

    this.fallbackMap = options.fallbackMap || null;

    this._visualizations = new Map();

    this._state = MapState.INACTIVE;

    this.stateChanged = new VcsEvent();

    this.pointerInteractionEvent = new VcsEvent();

    this._splitPosition = 0.5;

    this._postRender = new VcsEvent();
  }

  /**
   * Whether the map is active or not
   */
  get active(): boolean {
    return this._state === MapState.ACTIVE;
  }

  /**
   * Whether the map is loading or not
   */
  get loading(): boolean {
    return this._state === MapState.LOADING;
  }

  /**
   * The currently set HTML element in which to render the map
   */
  get target(): HTMLElement | null {
    return this._target;
  }

  set movementDisabled(prevent: boolean) {
    this._movementApiCallsDisabled = prevent;
    this._movementKeyEventsDisabled = prevent;
    this._movementPointerEventsDisabled = prevent;

    getLogger().deprecate('movementDisabled', 'disableMovement');
  }

  /**
   * @deprecated use disableMovement() for setting and movementApiCallsDisabled, movementKeyEventsDisabled and movementPointerEventsDisabled getter
   */
  get movementDisabled(): boolean {
    getLogger().deprecate(
      'movementDisabled',
      'use the following getters: "movementApiCallsDisabled", "movementKeyEventsDisabled", "movementPointerEventsDisabled"',
    );
    return (
      this._movementApiCallsDisabled &&
      this._movementKeyEventsDisabled &&
      this._movementPointerEventsDisabled
    );
  }

  /** Whether api calls like gotoViewpoint & setting of oblique images are disabled */
  get movementApiCallsDisabled(): boolean {
    return this._movementApiCallsDisabled;
  }

  /** Whether movement related key events like the arrow keys for navigating in map are disabled. */
  get movementKeyEventsDisabled(): boolean {
    return this._movementKeyEventsDisabled;
  }

  /** Whether movement related pointer events for navigating in map are disabled. */
  get movementPointerEventsDisabled(): boolean {
    return this._movementPointerEventsDisabled;
  }

  /**
   * The layer collection of this map. LayerCollections can be shared among maps.
   * When adding the map to a , the layer collection of the  will be set.
   * When setting the layer collection, the destroyLayerCollection flag is automatically set to false.
   */
  get layerCollection(): LayerCollection {
    return this._layerCollection;
  }

  /**
   * @param  layerCollection
   */
  set layerCollection(layerCollection: LayerCollection) {
    check(layerCollection, LayerCollection);

    this.destroyLayerCollection = false;
    [...this._layerCollection].forEach((l) => {
      l.removedFromMap(this);
    });
    this._layerCollection = layerCollection;

    if (this.active) {
      [...this._layerCollection].forEach((l) => {
        // eslint-disable-next-line no-void
        void l.mapActivated(this);
      });
    }

    this._setLayerCollectionListeners();
  }

  get splitPosition(): number {
    return this._splitPosition;
  }

  /**
   * The splitPosition should always be aligned with the mapCollection's splitPosition.
   * Use mapCollection to change splitPosition.
   */
  set splitPosition(position: number) {
    check(position, Number);
    if (position < 0 || position > 1) {
      throw new Error('Position must be between 0 and 1');
    }
    this._splitPosition = position;
  }

  /**
   * An event raised on the maps post render
   */
  get postRender(): VcsEvent<VcsMapRenderEvent<V>> {
    return this._postRender;
  }

  private _setLayerCollectionListeners(): void {
    this._collectionListeners.forEach((cb) => {
      cb();
    });

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
  }

  /**
   * Determines whether this map can show this viewpoint. Returns true in any other map then {@link ObliqueMap}
   */
  // eslint-disable-next-line class-methods-use-this
  canShowViewpoint(_viewpoint: Viewpoint): Promise<boolean> {
    return Promise.resolve(true);
  }

  /**
   * Sets the map target.
   */
  setTarget(target: string | HTMLElement | null): void {
    check(target, maybe(oneOf(String, HTMLElement)));

    if (this._target) {
      this._target.removeChild(this.mapElement);
    }

    this._target =
      typeof target === 'string' ? document.getElementById(target) : target;
    if (this._target) {
      this._target.appendChild(this.mapElement);
    }
  }

  // eslint-disable-next-line class-methods-use-this,no-empty-function
  async initialize(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * is called if a layer changes its position in the layerCollection.
   */
  // eslint-disable-next-line no-unused-vars,class-methods-use-this
  indexChanged(_layer: Layer): void {}

  /**
   * is called if a layer is added to the layerCollection.
   */
  private _layerAdded(layer: Layer): void {
    if (this.active) {
      // eslint-disable-next-line no-void
      void layer.mapActivated(this);
    }
  }

  /**
   * is called if a layer is added to the layerCollection.
   */
  private _layerRemoved(layer: Layer): void {
    layer.removedFromMap(this);
  }

  /**
   * Validates a visualization. A visualization must have the vcsLayeName symbol set and a layer with said name must be
   * part of the maps layerCollection.
   */
  validateVisualization(item: V): item is V & { [vcsLayerName]: string } {
    const layerName = item[vcsLayerName];
    if (layerName == null) {
      this.getLogger().warning('item is missing vcsLayerName symbol');
      return false;
    }

    return this.layerCollection.hasKey(layerName) as boolean;
  }

  /**
   * Adds a visualization to the visualizations map for its layer. The visualization must be valid, use validateVisualization first
   */
  addVisualization(item: V): void {
    if (!this.validateVisualization(item)) {
      throw new Error(
        'Visualization item is not valid, validate before adding',
      );
    }
    const layerName = item[vcsLayerName];
    if (!this._visualizations.has(layerName)) {
      this._visualizations.set(layerName, new Set());
    }
    (this._visualizations.get(layerName) as Set<V>).add(item);
  }

  /**
   * Removes a visualization
   */
  removeVisualization(item: V): void {
    const layerName = item[vcsLayerName];
    const viz = layerName ? this._visualizations.get(layerName) : undefined;
    if (viz && layerName) {
      viz.delete(item);
      if (viz.size === 0) {
        this._visualizations.delete(layerName);
      }
    }
  }

  /**
   * Gets the visualizations for a specific layer.
   */
  getVisualizationsForLayer(layer: Layer): Set<V> | undefined {
    return this._visualizations.get(layer.name);
  }

  /**
   * Get all visualizations added to this map.
   */
  getVisualizations(): V[] {
    return [...this._visualizations.values()]
      .map((layerVisualizations) => [...layerVisualizations])
      .flat();
  }

  /**
   * activates the map, if necessary initializes the map.
   * Once the promise resolves, the map can still be inactive, if deactivate was called while the map was activating.
   */
  async activate(): Promise<void> {
    if (this._state === MapState.INACTIVE) {
      this._state = MapState.LOADING;
      this.stateChanged.raiseEvent(MapState.LOADING);
      this.mapElement.style.display = '';
      await this.initialize();
      if (this._state !== MapState.LOADING) {
        return;
      }
      this._state = MapState.ACTIVE;
      await Promise.all(
        [...this.layerCollection].map((layer) => layer.mapActivated(this)),
      );
      if (this._state !== MapState.ACTIVE) {
        return;
      }
      this.stateChanged.raiseEvent(this._state);
    }
  }

  /**
   * deactivates the map
   */
  deactivate(): void {
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
   * prevent all movement, including api calls (gotoViewpoint, setting oblique images), key and pointer events.
   */
  disableMovement(prevent: boolean | DisableMapControlOptions): void {
    const disable: DisableMapControlOptions = is(prevent, Boolean)
      ? {
          apiCalls: prevent,
          pointerEvents: prevent,
          keyEvents: prevent,
        }
      : prevent;

    this._movementApiCallsDisabled = disable.apiCalls;
    this._movementKeyEventsDisabled = disable.keyEvents;
    this._movementPointerEventsDisabled = disable.pointerEvents;
  }

  /**
   * sets the view to the given viewpoint
   * @param _viewpoint
   * @param _optMaximumHeight during animation (can be used to get rid of the bunny hop)
   * gotoViewpoint
   */
  // eslint-disable-next-line no-unused-vars,class-methods-use-this
  gotoViewpoint(
    _viewpoint: Viewpoint,
    _optMaximumHeight?: number,
  ): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Returns the most precise viewpoint possible in ObliqueMap.
   */
  // eslint-disable-next-line class-methods-use-this
  getViewpoint(): Promise<Viewpoint | null> {
    return Promise.resolve(null);
  }

  /**
   * Returns an approximate viewpoint in ObliqueMap, not requesting terrain.
   */
  // eslint-disable-next-line class-methods-use-this
  getViewpointSync(): Viewpoint | null {
    return null;
  }

  /**
   * Resolution in meters per pixe
   * @param _coordinate - coordinate in mercator for which to determine resolution. only required in 3D
   */
  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  getCurrentResolution(_coordinate: Coordinate): number {
    return 1;
  }

  // eslint-disable-next-line no-unused-vars,class-methods-use-this
  pointIsVisible(_coords: Coordinate): boolean {
    return false;
  }

  /**
   * Requests this map to render when possible
   */
  // eslint-disable-next-line class-methods-use-this
  requestRender(): void {}

  toJSON(): VcsMapOptions {
    const config: VcsMapOptions = super.toJSON();
    if (this.fallbackMap) {
      config.fallbackMap = this.fallbackMap;
    }
    return config;
  }

  /**
   * disposes the map
   */
  destroy(): void {
    super.destroy();
    if (this.mapElement) {
      if (this.mapElement.parentElement) {
        this.mapElement.parentElement.removeChild(this.mapElement);
      }
      this.mapElement = document.createElement('div');
    }
    this._target = null;

    this._collectionListeners.forEach((cb) => {
      cb();
    });
    this._collectionListeners = [];

    if (this.layerCollection) {
      [...this.layerCollection].forEach((l) => {
        l.removedFromMap(this);
      });
    }
    if (this.stateChanged) {
      this.stateChanged.destroy();
    }

    if (this.destroyLayerCollection && this.layerCollection) {
      this.layerCollection.destroy();
    }

    if (this.pointerInteractionEvent) {
      this.pointerInteractionEvent.destroy();
    }
    this._layerCollection = new LayerCollection();
    this._layerCollection.destroy();
    this._postRender.destroy();
  }
}

mapClassRegistry.registerClass(VcsMap.className, VcsMap);
export default VcsMap;
