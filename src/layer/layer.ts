import { check, checkMaybe } from '@vcsuite/check';
import { parseBoolean, parseInteger } from '@vcsuite/parsers';
import VcsObject, { VcsObjectOptions } from '../vcsObject.js';
import Extent, { type ExtentOptions } from '../util/extent.js';
import { vcsLayerName } from './layerSymbols.js';
import LayerState from './layerState.js';
import VcsEvent from '../vcsEvent.js';
import { layerClassRegistry } from '../classRegistry.js';
import GlobalHider from './globalHider.js';
import VcsMap from '../map/vcsMap.js';
import LayerImplementation from './layerImplementation.js';
import AbstractFeatureProvider from '../featureProvider/abstractFeatureProvider.js';

export type CopyrightOptions = {
  provider?: string;
  url?: string;
  year?: string;
};

export type LayerOptions = VcsObjectOptions & {
  /**
   * if true the layer will be activated on initialization
   */
  activeOnStartup?: boolean;
  /**
   * whether to allow picking on this layer
   */
  allowPicking?: boolean;
  /**
   * zIndex of this layer
   */
  zIndex?: number;
  /**
   * metadata on the data extent of the layer.
   */
  extent?: ExtentOptions;
  exclusiveGroups?: (string | symbol)[];
  /**
   * the map names on which this layer is shown, all if empty or undefined
   */
  mapNames?: string[];
  url?: string | Record<string, string>;
  /**
   * an array of building ids which should be hidden if this layer is active
   */
  hiddenObjectIds?: string[];
  copyright?: CopyrightOptions;
};

export type LayerImplementationOptions = {
  name: string;
  url: string;
};

/**
 * Abstract base class for Layers.
 * To create a layer Implementation the function `createImplementationsForMap` has to be implemented.
 * To receive implementation options, implement `geImplementationOptions`
 * @group Layer
 */
class Layer<
  I extends LayerImplementation<VcsMap> = LayerImplementation<VcsMap>,
> extends VcsObject {
  static get className(): string {
    return 'Layer';
  }

  /**
   * Symbol to declare a layers name on its visualizations, e.g. ol.layer.Layer, Cesium.Cesium3DTileset
   * @deprecated
   */
  static get vcsLayerNameSymbol(): symbol {
    return vcsLayerName;
  }

  static getDefaultOptions(): LayerOptions {
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

  extent: Extent | null;

  activeOnStartup: boolean;

  private _allowPicking: boolean;

  private _state: LayerState;

  private _loadingPromise: Promise<void> | null;

  private _initialized: boolean;

  mapNames: string[];

  /**
   * The class names of the supported maps.
   */
  protected _supportedMaps: string[];

  protected _url: string | Record<string, string> | undefined;

  private _zIndex: number;

  /**
   * Called when the zIndex of this layer is changed. Is passed the new zIndex as its only argument.
   */
  zIndexChanged: VcsEvent<number>;

  /**
   * array of object Ids which should be hidden within the context of the layers layerCollection, if this layer is active
   */
  private _hiddenObjectIds: string[];

  private _globalHider: GlobalHider | undefined;

  private _exclusiveGroups: (string | symbol)[];

  /**
   * event raised if the exclusives group of the layer changes. is passed the array of exclusive groups as its only argument
   */
  exclusiveGroupsChanged: VcsEvent<(string | symbol)[]>;

  copyright: CopyrightOptions | undefined;

  private _implementations: Map<VcsMap, I[]>;

  private _activeMaps: Set<VcsMap>;

  /**
   * Event raised, if the layers state changes. Is passed the LayerState as its only parameter
   */
  stateChanged: VcsEvent<LayerState>;

  /**
   * An optional feature provider to provider features based on click events.
   */
  featureProvider: AbstractFeatureProvider | undefined;

  private _locale: string;

  constructor(options: LayerOptions) {
    super(options);
    const defaultOptions = Layer.getDefaultOptions();

    this.extent = options.extent ? new Extent(options.extent) : null;

    this.activeOnStartup = parseBoolean(
      options.activeOnStartup,
      defaultOptions.activeOnStartup,
    );

    this._allowPicking = parseBoolean(
      options.allowPicking,
      defaultOptions.allowPicking,
    );

    this._state = LayerState.INACTIVE;

    this._loadingPromise = null;

    this._initialized = false;

    this.mapNames = options.mapNames ?? (defaultOptions.mapNames as string[]);

    this._supportedMaps = [];

    this._url = options.url;

    this._zIndex = parseInteger(options.zIndex, 0);

    this.zIndexChanged = new VcsEvent();

    this._hiddenObjectIds = Array.isArray(options.hiddenObjectIds)
      ? options.hiddenObjectIds
      : (defaultOptions.hiddenObjectIds as string[]);

    this._globalHider = undefined;

    this._exclusiveGroups = Array.isArray(options.exclusiveGroups)
      ? options.exclusiveGroups.slice()
      : (defaultOptions.exclusiveGroups as (string | symbol)[]);

    this.exclusiveGroupsChanged = new VcsEvent();

    this.copyright = options.copyright || defaultOptions.copyright;

    this._implementations = new Map();

    this._activeMaps = new Set();

    this.stateChanged = new VcsEvent();

    this.featureProvider = undefined;

    this._locale = 'en';
  }

  /**
   * True if this layer has been initialized, typically after its first activation.
   */
  get initialized(): boolean {
    return this._initialized;
  }

  get active(): boolean {
    return this._state === LayerState.ACTIVE;
  }

  get loading(): boolean {
    return !!(this._state & LayerState.LOADING);
  }

  get state(): LayerState {
    return this._state;
  }

  get allowPicking(): boolean {
    return this._allowPicking;
  }

  set allowPicking(allowPicking: boolean) {
    this._allowPicking = allowPicking;
  }

  /**
   * A layers url, should on be configured, else an empty string
   */
  get url(): string {
    if (this._url) {
      if (typeof this._url === 'string') {
        return this._url;
      }
      if (this._url[this._locale]) {
        return this._url[this._locale];
      }
      return Object.values(this._url)[0];
    }
    return '';
  }

  set url(url: string | Record<string, string>) {
    check(url, [String, Object]);

    if (this._url !== url) {
      const currentValue = this._url;
      this._url = url;
      this.reload().catch((err) => {
        this.getLogger().error('failed to reload after URL setting');
        this.getLogger().error(String(err));
        this._url = currentValue;
      });
    }
  }

  get hiddenObjectIds(): string[] {
    return this._hiddenObjectIds;
  }

  set hiddenObjectIds(hiddenObjectIds: string[]) {
    check(hiddenObjectIds, [String]);

    if (this._globalHider && this.active) {
      this._globalHider.hideObjects(hiddenObjectIds);
    }
    this._hiddenObjectIds = hiddenObjectIds;
  }

  get globalHider(): GlobalHider | undefined {
    return this._globalHider;
  }

  setGlobalHider(globalHider?: GlobalHider): void {
    checkMaybe(globalHider, GlobalHider);

    if (globalHider && this.active) {
      globalHider.hideObjects(this.hiddenObjectIds);
    }
    this._globalHider = globalHider;
  }

  /**
   * Indicates, that this layer is part of an exclusiveGroup
   */
  get exclusive(): boolean {
    return this._exclusiveGroups.length > 0;
  }

  /**
   * An array of arbitrary exclusive groups
   */
  get exclusiveGroups(): (string | symbol)[] {
    return this._exclusiveGroups.slice();
  }

  set exclusiveGroups(groups: (string | symbol)[]) {
    check(groups, [[String, Symbol]]);

    if (
      groups.length !== this._exclusiveGroups.length ||
      !groups.every((g) => this._exclusiveGroups.includes(g))
    ) {
      this._exclusiveGroups = groups.slice();
      this.exclusiveGroupsChanged.raiseEvent(groups);
    }
  }

  get zIndex(): number {
    return this._zIndex;
  }

  set zIndex(index: number) {
    check(index, Number);

    if (this._zIndex !== index) {
      this._zIndex = index;
      this.zIndexChanged.raiseEvent(index);
    }
  }

  /**
   * returns the currently set locale. Can be used to provide locale specific URLs.
   */
  get locale(): string {
    return this._locale;
  }

  /**
   * sets the locale and reloads the layer the if the URL is a locale aware Object.
   */
  set locale(value: string) {
    check(value, String);

    if (this._locale !== value) {
      this._locale = value;
      if (
        this._url &&
        typeof this._url === 'object' &&
        this._url[this._locale]
      ) {
        this.reload().catch((err) => {
          this.getLogger().error('failed to reload after setting locale');
          this.getLogger().error(String(err));
        });
      }
    }
  }

  /**
   * creates an array of layer implementations for the given map.
   * @param  _map Map
   * @returns return the specific implementation
   */
  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  createImplementationsForMap(_map: VcsMap): I[] {
    return [];
  }

  /**
   * creates or returns a cached array of layer implementations for the given map.
   * @param  map initialized Map
   * @returns  return the specific implementation
   */
  getImplementationsForMap<T extends VcsMap>(map: T): I[] {
    if (!this._implementations.has(map)) {
      if (this.isSupported(map)) {
        this._implementations.set(map, this.createImplementationsForMap(map));
      } else {
        this._implementations.set(map, []);
      }
    }
    return this._implementations.get(map)!;
  }

  /**
   * Returns all implementation of this layer for all maps
   */
  getImplementations(): I[] {
    return [...this._implementations.values()].flat();
  }

  getImplementationOptions(): LayerImplementationOptions {
    return {
      name: this.name,
      url: this.url,
    };
  }

  /**
   * Reloads all the data loaded and forces a redraw
   */
  reload(): Promise<void> {
    return this.forceRedraw();
  }

  /**
   * destroys all current implementations and recreates the ones which have an active map.
   * called for instance when the URL for a layer changes
   */
  async forceRedraw(): Promise<void> {
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
   */
  getExtent(): Extent | null {
    return this.extent;
  }

  /**
   * returns the Extent of this layer or null, if the layers extent was not defined or cannot be established
   */
  getZoomToExtent(): Extent | null {
    if (this.extent && this.extent.isValid()) {
      return this.extent;
    }
    return null;
  }

  /**
   * initializes the layer, can be used to defer loading
   */
  initialize(): Promise<void> {
    this._initialized = true;
    return Promise.resolve();
  }

  /**
   * is called from the map when the map is activated, and this layer is in the layerCollection of the map.
   * Will create an implementation if it does not exits and will forward the activation call to the implementation.
   * @param  map
@link   */
  async mapActivated(map: VcsMap): Promise<void> {
    this.getLogger().debug(
      `Layer: ${this.name} mapActivated is called from Map: ${map.name}`,
    );
    this._activeMaps.add(map);
    if (this.active || (this.loading && this.initialized)) {
      await this._activateImplsForMap(map);
    }
  }

  /**
   * is called from the map when the map is deactivated, and this layer is in the layerCollection of the map.
   * will forward deactivation call to the map specific implementation
   * @param  map
   */
  mapDeactivated(map: VcsMap): void {
    this.getLogger().debug(
      `Layer: ${this.name} mapDeactivated is called from Map: ${map.name}`,
    );
    this._activeMaps.delete(map);
    if (this.active || this.loading) {
      this.getImplementationsForMap(map).forEach((impl) => {
        impl.deactivate();
      });
    }
  }

  /**
   * is called when a layer is removed from the layer collection of a map or said map is destroyed.
   * destroys the associated implementation.
   * @param  map
   */
  removedFromMap(map: VcsMap): void {
    this._activeMaps.delete(map);
    this.getImplementationsForMap(map).forEach((impl) => {
      impl.destroy();
    });
    this._implementations.delete(map);
  }

  /**
   * checks if the currently active map supports this layer
   * @param  map
   */
  isSupported(map: VcsMap): boolean {
    return (
      map &&
      this._supportedMaps.includes(map.className) &&
      (this.mapNames.length === 0 || this.mapNames.indexOf(map.name) >= 0)
    );
  }

  private async _activateImplsForMap(map: VcsMap): Promise<void> {
    const impls = this.getImplementationsForMap(map);
    try {
      await Promise.all(impls.map((i) => i.activate()));
    } catch (err) {
      this.getLogger().error(
        `Layer ${this.name} could not activate impl for map ${map.name}`,
      );
      this.getLogger().error(String(err));
      this._implementations.set(map, []);
      impls.forEach((i) => {
        i.destroy();
      });
    }
  }

  private async _activate(): Promise<void> {
    this._state = LayerState.LOADING;
    try {
      this.stateChanged.raiseEvent(LayerState.LOADING);
    } catch (e) {
      this.getLogger().debug(
        `Error on raising LayerState.LOADING event for layer ${this.name} : ${
          (e as Error).message
        }`,
      );
    }
    await this.initialize();
    if (this._state !== LayerState.LOADING) {
      return;
    }

    await Promise.all(
      [...this._activeMaps].map((m) => this._activateImplsForMap(m)),
    );
    if (this._state !== LayerState.LOADING) {
      return;
    }
    if (this._globalHider) {
      this._globalHider.hideObjects(this.hiddenObjectIds);
    }
    this._state = LayerState.ACTIVE;
    try {
      this.stateChanged.raiseEvent(LayerState.ACTIVE);
    } catch (e) {
      this.getLogger().debug(
        `Error on raising LayerState.ACTIVE event for layer ${this.name} : ${
          (e as Error).message
        }`,
      );
    }
    this._loadingPromise = null;
  }

  /**
   * Activates this layer object, i.e. changes its internal view state
   * and updates the map. The returned promise resolves, once the layer & any _implementations are initialized
   * and all data is loaded.
   * Once the promise resolves, the layer can still be inactive, if deactivate was called while initializing the layer.
   */
  activate(): Promise<void> {
    if (this._loadingPromise) {
      return this._loadingPromise;
    }

    if (this._state === LayerState.INACTIVE) {
      this._loadingPromise = this._activate().catch((err) => {
        this._state = LayerState.INACTIVE;
        return Promise.reject(err);
      });
      return this._loadingPromise;
    }

    return Promise.resolve();
  }

  /**
   * Deactivates a layer, changing the internal view state
   */
  deactivate(): void {
    if (this._loadingPromise) {
      this._loadingPromise = null;
    }

    if (this._state !== LayerState.INACTIVE) {
      this.getImplementations().forEach((impl) => {
        if (impl.loading || impl.active) {
          impl.deactivate();
        }
      });
      if (this._globalHider) {
        this._globalHider.showObjects(this.hiddenObjectIds);
      }
      this._state = LayerState.INACTIVE;
      try {
        this.stateChanged.raiseEvent(LayerState.INACTIVE);
      } catch (e) {
        this.getLogger().debug(
          `Error on raising LayerState.INACTIVE event for layer ${
            this.name
          } : ${(e as Error).message}`,
        );
      }
    }
  }

  toJSON(): LayerOptions {
    const config: LayerOptions = super.toJSON();
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
   */
  destroy(): void {
    super.destroy();
    if (this.featureProvider) {
      this.featureProvider.destroy();
    }

    this._activeMaps.clear();
    this.getImplementations().forEach((impl) => {
      impl.destroy();
    });

    this._initialized = false;
    this._implementations.clear();
    this.stateChanged.destroy();
    this.zIndexChanged.destroy();
    this.exclusiveGroupsChanged.destroy();
  }
}

export interface SplitLayer {
  splitDirection: import('@vcmap-cesium/engine').SplitDirection;
  splitDirectionChanged: VcsEvent<
    import('@vcmap-cesium/engine').SplitDirection
  >;
}

layerClassRegistry.registerClass(Layer.className, Layer);
export default Layer;
