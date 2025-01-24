import { getLogger as getLoggerByName, Logger } from '@vcsuite/logger';
import { v4 as uuidv4 } from 'uuid';
import { check } from '@vcsuite/check';
import VcsModule, { VcsModuleConfig } from './vcsModule.js';
import {
  destroyCollection,
  deserializeViewpoint,
  deserializeMap,
  getLayerIndex,
  serializeLayer,
  deserializeLayer,
} from './vcsModuleHelpers.js';
import makeOverrideCollection, {
  OverrideCollection,
} from './util/overrideCollection.js';
import CategoryCollection from './category/categoryCollection.js';
import MapCollection from './util/mapCollection.js';
import VcsMap from './map/vcsMap.js';
import Layer from './layer/layer.js';
import Collection from './util/collection.js';
import ObliqueCollection from './oblique/obliqueCollection.js';
import Viewpoint from './util/viewpoint.js';
import StyleItem, { StyleItemOptions } from './style/styleItem.js';
import IndexedCollection from './util/indexedCollection.js';
import VcsEvent from './vcsEvent.js';
import { setDefaultProjectionOptions } from './util/projection.js';
import ObliqueMap from './map/obliqueMap.js';
import OverrideClassRegistry from './overrideClassRegistry.js';
import ClassRegistry, {
  AbstractCtor,
  categoryClassRegistry,
  Ctor,
  featureProviderClassRegistry,
  getObjectFromClassRegistry,
  layerClassRegistry,
  mapClassRegistry,
  styleClassRegistry,
  tileProviderClassRegistry,
} from './classRegistry.js';
import { detectBrowserLocale } from './util/locale.js';
import { moduleIdSymbol } from './moduleIdSymbol.js';
import type LayerCollection from './util/layerCollection.js';
import type Category from './category/category.js';
import type TileProvider from './layer/tileProvider/tileProvider.js';
import type AbstractFeatureProvider from './featureProvider/abstractFeatureProvider.js';
import {
  createHiddenObjectsCollection,
  HiddenObject,
} from './util/hiddenObjects.js';
import FlightInstance, {
  FlightInstanceOptions,
} from './util/flight/flightInstance.js';
import FlightCollection from './util/flight/flightCollection.js';
import DisplayQuality from './util/displayQuality/displayQuality.js';
import VectorClusterGroup from './vectorCluster/vectorClusterGroup.js';
import VectorClusterGroupCollection from './vectorCluster/vectorClusterGroupCollection.js';
import ClippingPolygonObject, {
  ClippingPolygonObjectOptions,
} from './util/clipping/clippingPolygonObject.js';
import ClippingPolygonObjectCollection from './util/clipping/clippingPolygonObjectCollection.js';

function getLogger(): Logger {
  return getLoggerByName('init');
}

export type VcsAppOptions = {
  _id?: string | undefined;
  name?: string | undefined;
  description?: string | undefined;
  properties?: Record<string, unknown>;
};

const vcsApps: Map<string, VcsApp> = new Map();

export const defaultDynamicModuleId = '_defaultDynamicModule';

/**
 * @group Application
 */
class VcsApp {
  private _id: string;

  name: string | undefined;

  description: string | undefined;

  properties: Record<string, unknown> | undefined;

  private _defaultDynamicModule: VcsModule;

  private _dynamicModule: VcsModule;

  private _dynamicModuleIdChanged: VcsEvent<string>;

  /**
   * represents the current Locale.
   */
  private _locale: string;

  /**
   * fires if the current Locale changes.
   */
  private _localeChanged: VcsEvent<string>;

  private _mapClassRegistry: OverrideClassRegistry<typeof VcsMap>;

  private _maps: OverrideCollection<VcsMap, MapCollection>;

  private _layerClassRegistry: OverrideClassRegistry<typeof Layer>;

  private _layers: OverrideCollection<Layer, LayerCollection>;

  private _vectorClusterGroups: OverrideCollection<
    VectorClusterGroup,
    VectorClusterGroupCollection
  >;

  private _obliqueCollections: OverrideCollection<ObliqueCollection>;

  private _viewpoints: OverrideCollection<Viewpoint>;

  private _styleClassRegistry: OverrideClassRegistry<typeof StyleItem>;

  private _styles: OverrideCollection<StyleItem>;

  private _modules: IndexedCollection<VcsModule>;

  private _hiddenObjects: OverrideCollection<HiddenObject>;

  private _clippingPolygons: OverrideCollection<ClippingPolygonObject>;

  private _flights: OverrideCollection<FlightInstance, FlightCollection>;

  private _categoryClassRegistry: OverrideClassRegistry<
    typeof Category<any, any>
  >;

  private _categories: CategoryCollection;

  private _displayQuality: DisplayQuality;

  private _destroyed: VcsEvent<void>;

  private _moduleMutationChain: {
    running: boolean;
    items: Array<{
      moduleId: string;
      mutation: () => Promise<void>;
      resolve: () => void;
      reject: (reason?: any) => void;
    }>;
  };

  private _categoryItemClassRegistry: OverrideClassRegistry<Ctor<any>>;

  private _tileProviderClassRegistry: OverrideClassRegistry<
    typeof TileProvider
  >;

  private _featureProviderClassRegistry: OverrideClassRegistry<
    typeof AbstractFeatureProvider
  >;

  /**
   * @param  options
   */
  constructor(options: VcsAppOptions = {}) {
    this._id = options?._id || uuidv4();
    this.name = options.name ?? this._id;
    this.description = options.description;
    this.properties = options.properties;
    this._defaultDynamicModule = new VcsModule({ _id: defaultDynamicModuleId });
    this._dynamicModule = this._defaultDynamicModule;

    const getDynamicModuleId = (): string => this._dynamicModule._id;
    this._dynamicModuleIdChanged = new VcsEvent();
    this._locale = detectBrowserLocale();
    this._localeChanged = new VcsEvent();

    this._mapClassRegistry = new OverrideClassRegistry(mapClassRegistry);
    this._maps = makeOverrideCollection<VcsMap, MapCollection>(
      new MapCollection(),
      getDynamicModuleId,
      undefined,
      deserializeMap.bind(null, this),
      VcsMap,
    );
    this._layerClassRegistry = new OverrideClassRegistry(layerClassRegistry);
    this._layers = makeOverrideCollection<Layer, LayerCollection>(
      this._maps.layerCollection,
      getDynamicModuleId,
      serializeLayer.bind(null, this),
      deserializeLayer.bind(null, this),
      Layer,
      getLayerIndex,
    );
    this._layers.locale = this.locale;

    this._vectorClusterGroups = makeOverrideCollection(
      this._layers.vectorClusterGroups,
      getDynamicModuleId,
      undefined,
      (config) => new VectorClusterGroup(config),
      VectorClusterGroup,
    );

    this._obliqueCollections = makeOverrideCollection(
      new Collection(),
      getDynamicModuleId,
      undefined,
      (config) => new ObliqueCollection(config),
      ObliqueCollection,
    );
    this._viewpoints = makeOverrideCollection(
      new Collection(),
      getDynamicModuleId,
      undefined,
      deserializeViewpoint,
      Viewpoint,
    );

    this._styleClassRegistry = new OverrideClassRegistry(styleClassRegistry);

    this._styles = makeOverrideCollection(
      new Collection(),
      getDynamicModuleId,
      undefined,
      (styleOptions: StyleItemOptions) =>
        getObjectFromClassRegistry(this._styleClassRegistry, styleOptions),
      StyleItem,
    );

    this._modules = new IndexedCollection('_id');
    this._modules.add(this._dynamicModule);

    this._hiddenObjects = createHiddenObjectsCollection(
      getDynamicModuleId,
      this._layers.globalHider,
    );

    this._clippingPolygons = makeOverrideCollection(
      new ClippingPolygonObjectCollection(this),
      getDynamicModuleId,
      undefined,
      (clippingPolygonOptions: ClippingPolygonObjectOptions) =>
        new ClippingPolygonObject(clippingPolygonOptions),
    );

    this._flights = makeOverrideCollection(
      new FlightCollection(this),
      getDynamicModuleId,
      undefined,
      (flightOptions: FlightInstanceOptions) =>
        new FlightInstance(flightOptions),
    );

    this._categoryClassRegistry = new OverrideClassRegistry(
      categoryClassRegistry,
    );
    this._categories = new CategoryCollection(this);
    this._displayQuality = new DisplayQuality(this);
    this._destroyed = new VcsEvent();
    this._moduleMutationChain = { running: false, items: [] };
    this._categoryItemClassRegistry = new OverrideClassRegistry(
      new ClassRegistry(),
    );
    this._tileProviderClassRegistry = new OverrideClassRegistry(
      tileProviderClassRegistry,
    );
    this._featureProviderClassRegistry = new OverrideClassRegistry(
      featureProviderClassRegistry,
    );

    vcsApps.set(this._id, this);
  }

  get id(): string {
    return this._id;
  }

  get locale(): string {
    return this._locale;
  }

  /**
   * sets the locale of the vcsApp and the linked layerCollection.
   * This will trigger the localeChanged Event.
   * @param  value new locale with 2 letters
   */
  set locale(value: string) {
    check(value, String);

    if (value.length !== 2) {
      getLogger().warning(
        'Provide a valid locale, for example "en", "de" with max. 2 letters',
      );
      return;
    }
    if (this._locale !== value) {
      this._locale = value;
      this.layers.locale = value;
      this._localeChanged.raiseEvent(value);
    }
  }

  get localeChanged(): VcsEvent<string> {
    return this._localeChanged;
  }

  get maps(): OverrideCollection<VcsMap, MapCollection> {
    return this._maps;
  }

  get layers(): OverrideCollection<Layer, LayerCollection> {
    return this._layers;
  }

  get vectorClusterGroups(): OverrideCollection<
    VectorClusterGroup,
    VectorClusterGroupCollection
  > {
    return this._vectorClusterGroups;
  }

  get obliqueCollections(): OverrideCollection<ObliqueCollection> {
    return this._obliqueCollections;
  }

  get viewpoints(): OverrideCollection<Viewpoint> {
    return this._viewpoints;
  }

  get styles(): OverrideCollection<StyleItem> {
    return this._styles;
  }

  get categories(): CategoryCollection {
    return this._categories;
  }

  get hiddenObject(): OverrideCollection<HiddenObject> {
    return this._hiddenObjects;
  }

  get clippingPolygons(): OverrideCollection<ClippingPolygonObject> {
    return this._clippingPolygons;
  }

  get flights(): OverrideCollection<FlightInstance, FlightCollection> {
    return this._flights;
  }

  get displayQuality(): DisplayQuality {
    return this._displayQuality;
  }

  get destroyed(): VcsEvent<void> {
    return this._destroyed;
  }

  get modules(): VcsModule[] {
    return [...this._modules];
  }

  get moduleAdded(): VcsEvent<VcsModule> {
    return this._modules.added;
  }

  get moduleRemoved(): VcsEvent<VcsModule> {
    return this._modules.removed;
  }

  get dynamicModuleId(): string {
    return this._dynamicModule._id;
  }

  get dynamicModuleIdChanged(): VcsEvent<string> {
    return this._dynamicModuleIdChanged;
  }

  get mapClassRegistry(): OverrideClassRegistry<typeof VcsMap> {
    return this._mapClassRegistry;
  }

  get layerClassRegistry(): OverrideClassRegistry<typeof Layer> {
    return this._layerClassRegistry;
  }

  get styleClassRegistry(): OverrideClassRegistry<typeof StyleItem> {
    return this._styleClassRegistry;
  }

  get categoryClassRegistry(): OverrideClassRegistry<
    typeof Category<any, any>
  > {
    return this._categoryClassRegistry;
  }

  get categoryItemClassRegistry(): OverrideClassRegistry<AbstractCtor> {
    return this._categoryItemClassRegistry;
  }

  get tileProviderClassRegistry(): OverrideClassRegistry<typeof TileProvider> {
    return this._tileProviderClassRegistry;
  }

  get featureProviderClassRegistry(): OverrideClassRegistry<
    typeof AbstractFeatureProvider
  > {
    return this._featureProviderClassRegistry;
  }

  getModuleById(id: string): VcsModule | undefined {
    return this._modules.getByKey(id);
  }

  protected async _parseModule(module: VcsModule): Promise<void> {
    const { config } = module;
    if (config.projection) {
      // XXX this needs fixing. this should be _projections_ and there should be a `defaultProjection`
      setDefaultProjectionOptions(config.projection);
    }

    await this._styles.parseItems(config.styles, module._id);
    await this._layers.parseItems(config.layers, module._id);
    await this._vectorClusterGroups.parseItems(
      config.vectorClusterGroups,
      module._id,
    );
    // TODO add ade here

    await this._obliqueCollections.parseItems(
      config.obliqueCollections,
      module._id,
    );
    await this._viewpoints.parseItems(config.viewpoints, module._id);
    await this._maps.parseItems(config.maps, module._id);
    await this._hiddenObjects.parseItems(config.hiddenObjects, module._id);
    await this._clippingPolygons.parseItems(
      config.clippingPolygons,
      module._id,
    );
    await this._flights.parseItems(config.flights, module._id);

    if (Array.isArray(config.categories)) {
      await Promise.all(
        config.categories.map(async ({ name, items }) => {
          await this._categories.parseCategoryItems(name, items, module._id);
        }),
      );
    }
  }

  protected async _setModuleState(module: VcsModule): Promise<void> {
    const { config } = module;
    [...this._layers]
      .filter((l) => l[moduleIdSymbol] === module._id)
      .forEach((l) => {
        if (l.activeOnStartup) {
          l.activate().catch((err) => {
            getLogger().error(
              `Failed to activate active on startup layer ${l.name}`,
            );
            getLogger().error(String(err));
          });
        }
      });

    [...this._clippingPolygons]
      .filter((c) => c[moduleIdSymbol] === module._id)
      .forEach((c) => {
        if (c.activeOnStartup) {
          c.activate();
        }
      });

    if (config.startingObliqueCollectionName) {
      const startingObliqueCollection = this._obliqueCollections.getByKey(
        config.startingObliqueCollectionName,
      );
      if (startingObliqueCollection) {
        await Promise.all(
          [...this._maps]
            .filter((m) => m instanceof ObliqueMap)
            .map((m) => {
              return m.setCollection(startingObliqueCollection);
            }),
        );
      }
    }

    if (config.startingMapName) {
      await this._maps.setActiveMap(config.startingMapName);
    } else if (!this._maps.activeMap && this._maps.size > 0) {
      await this._maps.setActiveMap([...this._maps][0].name);
    }

    if (config.startingViewpointName && this._maps.activeMap) {
      const startViewpoint = this._viewpoints.getByKey(
        config.startingViewpointName,
      );
      if (startViewpoint) {
        await this._maps.activeMap.gotoViewpoint(startViewpoint);
      }
    }
  }

  /**
   * When adding multiple modules, adding of previous modules are awaited.
   * If an invalid module is added an error is thrown and already added items of invalid module are removed.
   * @param module
   */
  async addModule(module: VcsModule): Promise<void> {
    check(module, VcsModule);

    const mutation = async (): Promise<void> => {
      try {
        if (this._modules.hasKey(module._id)) {
          getLogger().info(`module with id ${module._id} already loaded`);
          return;
        }

        await this._parseModule(module);
        await this._setModuleState(module);
        this._modules.add(module);
      } catch (err) {
        await this._removeModule(module._id);
        throw err;
      }
    };
    return new Promise((resolve, reject) => {
      this._moduleMutationChain.items.push({
        moduleId: module._id,
        mutation,
        resolve,
        reject,
      });
      this._startModuleMutationChain();
    });
  }

  _startModuleMutationChain(): void {
    if (!this._moduleMutationChain.running) {
      const item = this._moduleMutationChain.items.shift();
      if (item) {
        try {
          this._moduleMutationChain.running = true;
          item
            .mutation()
            .then(() => item.resolve())
            .catch((err) => item.reject(err))
            .finally(() => {
              this._moduleMutationChain.running = false;
              this._startModuleMutationChain();
            });
        } catch (err) {
          item.reject(err);
          this._moduleMutationChain.running = false;
          this._startModuleMutationChain();
        }
      }
    }
  }

  serializeModule(moduleId: string): VcsModuleConfig {
    check(moduleId, String);
    if (!this._modules.hasKey(moduleId)) {
      throw new Error(
        'VcsModule is not managed by this app, call add(module) before',
      );
    }
    const config = this._modules.getByKey(moduleId)!.toJSON();
    config.maps = this._maps.serializeModule(moduleId);
    config.layers = this._layers.serializeModule(moduleId);
    config.vectorClusterGroups =
      this._vectorClusterGroups.serializeModule(moduleId);
    config.obliqueCollections =
      this._obliqueCollections.serializeModule(moduleId);
    config.viewpoints = this._viewpoints.serializeModule(moduleId);
    config.styles = this._styles.serializeModule(moduleId);
    config.hiddenObjects = this._hiddenObjects.serializeModule(
      moduleId,
    ) as HiddenObject[];
    config.clippingPolygons = this._clippingPolygons.serializeModule(
      moduleId,
    ) as ClippingPolygonObjectOptions[];
    config.flights = this._flights.serializeModule(moduleId);
    config.categories = [...this._categories]
      .map((c) => c.serializeModule(moduleId))
      .filter((c) => !!c) as { name: string; items: object[] }[];

    return config;
  }

  /**
   * sets the given module as the dynamic
   * @param  module
   */
  setDynamicModule(module: VcsModule): void {
    if (!this._modules.has(module)) {
      throw new Error(
        'VcsModule is not managed by this app, call add(module) before',
      );
    }
    if (this._dynamicModule !== module) {
      this._dynamicModule = module;
      this.dynamicModuleIdChanged.raiseEvent(this.dynamicModuleId);
    }
  }

  /**
   * resets the dynamic VcsModule to the "defaultDynamicModule"
   */
  resetDynamicModule(): void {
    this.setDynamicModule(this._defaultDynamicModule);
  }

  protected async _removeModule(moduleId: string): Promise<void> {
    await Promise.all([
      this._maps.removeModule(moduleId),
      this._layers.removeModule(moduleId),
      this._viewpoints.removeModule(moduleId),
      this._styles.removeModule(moduleId),
      this._obliqueCollections.removeModule(moduleId),
      this._hiddenObjects.removeModule(moduleId),
      this._clippingPolygons.removeModule(moduleId),
      this._flights.removeModule(moduleId),
      this._vectorClusterGroups.removeModule(moduleId),
    ]);
  }

  async removeModule(moduleId: string): Promise<void> {
    const mutation = async (): Promise<void> => {
      const module = this._modules.getByKey(moduleId);
      if (!module) {
        getLogger().info(`module with id ${moduleId} has already been removed`);
        return;
      }
      await this._removeModule(moduleId);
      this._modules.remove(module);
    };
    return new Promise((resolve, reject) => {
      this._moduleMutationChain.items.push({
        moduleId,
        mutation,
        resolve,
        reject,
      });
      this._startModuleMutationChain();
    });
  }

  /**
   * Destroys the app and all its collections, their content and ui managers.
   */
  destroy(): void {
    this._moduleMutationChain.running = false;
    this._moduleMutationChain.items.splice(0);
    Object.defineProperty(this, '_moduleMutationChain', {
      get() {
        throw new Error('VcsApp was destroyed');
      },
    });
    vcsApps.delete(this._id);
    destroyCollection(this._maps);
    destroyCollection(this._layers);
    destroyCollection(this._obliqueCollections);
    destroyCollection(this._viewpoints);
    destroyCollection(this._flights);
    destroyCollection(this._styles);
    destroyCollection(this._categories);
    destroyCollection(this._clippingPolygons);
    this._modules.destroy();
    this._hiddenObjects.destroy();
    this._mapClassRegistry.destroy();
    this._layerClassRegistry.destroy();
    this._styleClassRegistry.destroy();
    this._categoryClassRegistry.destroy();
    this._categoryItemClassRegistry.destroy();
    this._tileProviderClassRegistry.destroy();
    this._featureProviderClassRegistry.destroy();
    this._displayQuality.destroy();
    this.destroyed.raiseEvent();
    this.destroyed.destroy();
    this.localeChanged.destroy();
    this.dynamicModuleIdChanged.destroy();
  }
}

export function getVcsAppById(id: string): VcsApp | undefined {
  return vcsApps.get(id);
}

window.vcs = window.vcs || {};
window.vcs.apps = vcsApps;
window.vcs.createModuleFromConfig = (config: VcsModuleConfig): VcsModule =>
  new VcsModule(config);

export default VcsApp;
