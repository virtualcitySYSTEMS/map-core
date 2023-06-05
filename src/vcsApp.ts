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

function getLogger(): Logger {
  return getLoggerByName('init');
}

const vcsApps: Map<string, VcsApp> = new Map();

export const defaultDynamicModuleId = '_defaultDynamicModule';

class VcsApp {
  private _id: string;

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

  private _obliqueCollections: OverrideCollection<ObliqueCollection>;

  private _viewpoints: OverrideCollection<Viewpoint>;

  private _styleClassRegistry: OverrideClassRegistry<typeof StyleItem>;

  private _styles: OverrideCollection<StyleItem>;

  private _modules: IndexedCollection<VcsModule>;

  private _categoryClassRegisty: OverrideClassRegistry<typeof Category>;

  private _categories: CategoryCollection;

  private _destroyed: VcsEvent<void>;

  private _moduleMutationPromise: Promise<void>;

  private _categoryItemClassRegistry: OverrideClassRegistry<Ctor<any>>;

  private _tileProviderClassRegsitry: OverrideClassRegistry<
    typeof TileProvider
  >;

  private _featureProviderClassRegsitry: OverrideClassRegistry<
    typeof AbstractFeatureProvider
  >;

  constructor() {
    this._id = uuidv4();
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
      (options: StyleItemOptions) =>
        getObjectFromClassRegistry(this._styleClassRegistry, options),
      StyleItem,
    );

    this._modules = new IndexedCollection('_id');
    this._modules.add(this._dynamicModule);

    this._categoryClassRegisty = new OverrideClassRegistry(
      categoryClassRegistry,
    );
    this._categories = new CategoryCollection(this);
    this._destroyed = new VcsEvent();
    this._moduleMutationPromise = Promise.resolve();
    this._categoryItemClassRegistry = new OverrideClassRegistry(
      new ClassRegistry(),
    );
    this._tileProviderClassRegsitry = new OverrideClassRegistry(
      tileProviderClassRegistry,
    );
    this._featureProviderClassRegsitry = new OverrideClassRegistry(
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

  get categoryClassRegistry(): OverrideClassRegistry<typeof Category> {
    return this._categoryClassRegisty;
  }

  get categoryItemClassRegistry(): OverrideClassRegistry<Ctor<any>> {
    return this._categoryItemClassRegistry;
  }

  get tileProviderClassRegistry(): OverrideClassRegistry<typeof TileProvider> {
    return this._tileProviderClassRegsitry;
  }

  get featureProviderClassRegistry(): OverrideClassRegistry<
    typeof AbstractFeatureProvider
  > {
    return this._featureProviderClassRegsitry;
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
    // TODO add flights & ade here

    await this._obliqueCollections.parseItems(
      config.obliqueCollections,
      module._id,
    );
    await this._viewpoints.parseItems(config.viewpoints, module._id);
    await this._maps.parseItems(config.maps, module._id);

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
            this._layers.remove(l);
            l.destroy();
          });
        }
      });

    const activeObliqueCollection = [...this._obliqueCollections].find(
      (c) => c[moduleIdSymbol] === module._id && c.activeOnStartup,
    );

    if (activeObliqueCollection) {
      [...this._maps]
        .filter((m) => m instanceof ObliqueMap)
        .forEach((m) => {
          // eslint-disable-next-line no-void
          void (m as ObliqueMap).setCollection(activeObliqueCollection);
        });
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

  addModule(module: VcsModule): Promise<void> {
    check(module, VcsModule);

    this._moduleMutationPromise = this._moduleMutationPromise.then(async () => {
      if (this._modules.has(module)) {
        getLogger().info(`module with id ${module._id} already loaded`);
        return;
      }

      await this._parseModule(module);
      await this._setModuleState(module);
      this._modules.add(module);
    });
    return this._moduleMutationPromise;
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
    config.obliqueCollections =
      this._obliqueCollections.serializeModule(moduleId);
    config.viewpoints = this._viewpoints.serializeModule(moduleId);
    config.styles = this._styles.serializeModule(moduleId);
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
    ]);
  }

  removeModule(moduleId: string): Promise<void> {
    this._moduleMutationPromise = this._moduleMutationPromise.then(async () => {
      const module = this._modules.getByKey(moduleId);
      if (!module) {
        getLogger().info(`module with id ${moduleId} has already been removed`);
        return;
      }
      await this._removeModule(moduleId);
      this._modules.remove(module);
    });

    return this._moduleMutationPromise;
  }

  /**
   * Destroys the app and all its collections, their content and ui managers.
   */
  destroy(): void {
    Object.defineProperty(this, '_moduleMutationPromise', {
      get() {
        throw new Error('VcsApp was destroyed');
      },
    });
    vcsApps.delete(this._id);
    destroyCollection(this._maps);
    destroyCollection(this._layers);
    destroyCollection(this._obliqueCollections);
    destroyCollection(this._viewpoints);
    destroyCollection(this._styles);
    destroyCollection(this._categories);
    this._mapClassRegistry.destroy();
    this._layerClassRegistry.destroy();
    this._styleClassRegistry.destroy();
    this._categoryClassRegisty.destroy();
    this._categoryItemClassRegistry.destroy();
    this._tileProviderClassRegsitry.destroy();
    this._featureProviderClassRegsitry.destroy();
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

export default VcsApp;