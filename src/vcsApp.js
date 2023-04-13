import { getLogger as getLoggerByName } from '@vcsuite/logger';
import { v4 as uuidv4 } from 'uuid';
import { check } from '@vcsuite/check';
import VcsModule from './vcsModule.js';
import {
  moduleIdSymbol,
  destroyCollection,
  deserializeViewpoint,
  deserializeMap,
  getLayerIndex,
  serializeLayer,
  deserializeLayer,
} from './vcsModuleHelpers.js';
import makeOverrideCollection from './util/overrideCollection.js';
import CategoryCollection from './category/categoryCollection.js';
import MapCollection from './util/mapCollection.js';
import VcsMap from './map/vcsMap.js';
import Layer from './layer/layer.js';
import Collection from './util/collection.js';
import ObliqueCollection from './oblique/obliqueCollection.js';
import Viewpoint from './util/viewpoint.js';
import StyleItem from './style/styleItem.js';
import IndexedCollection from './util/indexedCollection.js';
import VcsEvent from './vcsEvent.js';
import { setDefaultProjectionOptions } from './util/projection.js';
import ObliqueMap from './map/obliqueMap.js';
import OverrideClassRegistry from './overrideClassRegistry.js';
import ClassRegistry, {
  categoryClassRegistry,
  featureProviderClassRegistry, getObjectFromClassRegistry,
  layerClassRegistry,
  mapClassRegistry,
  styleClassRegistry,
  tileProviderClassRegistry,
} from './classRegistry.js';
import { detectBrowserLocale } from './util/locale.js';

/**
 * @returns {import("@vcsuite/logger").Logger}
 */
function getLogger() {
  return getLoggerByName('init');
}

/**
 * @type {Map<string, VcsApp>}
 */
const vcsApps = new Map();

/**
 * @type {string}
 */
export const defaultDynamicModuleId = '_defaultDynamicModule';

/**
 * @class
 */
class VcsApp {
  constructor() {
    /**
     * @type {string}
     * @private
     */
    this._id = uuidv4();
    /**
     * @type {VcsModule}
     * @private
     */
    this._defaultDynamicModule = new VcsModule({ _id: defaultDynamicModuleId });
    /**
     * @type {VcsModule}
     * @private
     */
    this._dynamicModule = this._defaultDynamicModule;

    const getDynamicModuleId = () => this._dynamicModule._id;

    /**
     * @type {VcsEvent<string>}
     * @private
     */
    this._dynamicModuleIdChanged = new VcsEvent();

    /**
     * represents the current Locale.
     * @type {string}
     * @private
     */
    this._locale = detectBrowserLocale();

    /**
     * fires if the current Locale changes.
     * @type {VcsEvent<string>}
     * @private
     */
    this._localeChanged = new VcsEvent();

    /**
     * @type {OverrideClassRegistry<VcsMap>}
     * @private
     */
    this._mapClassRegistry = new OverrideClassRegistry(mapClassRegistry);
    /**
     * @type {OverrideMapCollection}
     * @private
     */
    // @ts-ignore
    this._maps = makeOverrideCollection(
      new MapCollection(),
      getDynamicModuleId,
      null,
      deserializeMap.bind(null, this),
      VcsMap,
    );
    /**
     * @type {OverrideClassRegistry<Layer>}
     * @private
     */
    this._layerClassRegistry = new OverrideClassRegistry(layerClassRegistry);
    /**
     * @type {OverrideLayerCollection}
     * @private
     */
    // @ts-ignore
    this._layers = makeOverrideCollection(
      this._maps.layerCollection,
      getDynamicModuleId,
      serializeLayer.bind(null, this),
      deserializeLayer.bind(null, this),
      Layer,
      getLayerIndex,
    );
    this._layers.locale = this.locale;

    /**
     * @type {OverrideCollection<import("@vcmap/core").ObliqueCollection>}
     * @private
     */
    this._obliqueCollections = makeOverrideCollection(
      new Collection(),
      getDynamicModuleId,
      null,
      config => new ObliqueCollection(config),
      ObliqueCollection,
    );
    /**
     * @type {OverrideCollection<import("@vcmap/core").Viewpoint>}
     * @private
     */
    this._viewpoints = makeOverrideCollection(
      new Collection(),
      getDynamicModuleId,
      null,
      deserializeViewpoint,
      Viewpoint,
    );
    /**
     * @type {OverrideClassRegistry<StyleItem>}
     * @private
     */
    this._styleClassRegistry = new OverrideClassRegistry(styleClassRegistry);
    /**
     * @type {OverrideCollection<import("@vcmap/core").StyleItem>}
     * @private
     */
    this._styles = makeOverrideCollection(
      new Collection(),
      getDynamicModuleId,
      null,
      getObjectFromClassRegistry.bind(null, this._styleClassRegistry),
      StyleItem,
    );

    /**
     * @type {IndexedCollection<VcsModule>}
     * @private
     */
    this._modules = new IndexedCollection('_id');
    this._modules.add(this._dynamicModule);
    /**
     * @type {OverrideClassRegistry<import("@vcmap/core").Category<Object|import("@vcmap/core").VcsObject>>}
     * @private
     */
    this._categoryClassRegisty = new OverrideClassRegistry(categoryClassRegistry);
    /**
     * @type {CategoryCollection}
     * @private
     */
    this._categories = new CategoryCollection(this);
    /**
     * @type {import("@vcmap/core").VcsEvent<void>}
     * @private
     */
    this._destroyed = new VcsEvent();
    /**
     * @type {Promise<void>}
     * @private
     */
    this._moduleMutationPromise = Promise.resolve();
    /**
     * @type {OverrideClassRegistry<*>}
     * @private
     */
    this._categoryItemClassRegistry = new OverrideClassRegistry(new ClassRegistry());
    /**
     * @type {OverrideClassRegistry<import("@vcmap/core").TileProvider>}
     * @private
     */
    this._tileProviderClassRegsitry = new OverrideClassRegistry(tileProviderClassRegistry);
    /**
     * @type {OverrideClassRegistry<import("@vcmap/core").AbstractFeatureProvider>}
     * @private
     */
    this._featureProviderClassRegsitry = new OverrideClassRegistry(featureProviderClassRegistry);

    vcsApps.set(this._id, this);
  }

  /**
   * @type {string}
   * @readonly
   */
  get id() { return this._id; }

  /**
   * @returns {string}
   */
  get locale() {
    return this._locale;
  }

  /**
   * sets the locale of the vcsApp and the linked layerCollection.
   * This will trigger the localeChanged Event.
   * @param {string} value new locale with 2 letters
   */
  set locale(value) {
    check(value, String);

    if (value.length !== 2) {
      getLogger().warning('Provide a valid locale, for example "en", "de" with max. 2 letters');
      return;
    }
    if (this._locale !== value) {
      this._locale = value;
      this.layers.locale = value;
      this._localeChanged.raiseEvent(value);
    }
  }

  /**
   * @type {VcsEvent<string>}
   * @readonly
   */
  get localeChanged() {
    return this._localeChanged;
  }

  /**
   * @type {OverrideMapCollection}
   * @readonly
   */
  get maps() { return this._maps; }

  /**
   * @type {OverrideLayerCollection}
   * @readonly
   */
  get layers() { return this._layers; }

  /**
   * @type {OverrideCollection<import("@vcmap/core").ObliqueCollection>}
   * @readonly
   */
  get obliqueCollections() { return this._obliqueCollections; }

  /**
   * @type {OverrideCollection<import("@vcmap/core").Viewpoint>}
   * @readonly
   */
  get viewpoints() { return this._viewpoints; }

  /**
   * @type {OverrideCollection<import("@vcmap/core").StyleItem>}
   * @readonly
   */
  get styles() { return this._styles; }

  /**
   * @type {CategoryCollection}
   * @readonly
   */
  get categories() { return this._categories; }

  /**
   * @type {VcsEvent<void>}
   * @readonly
   */
  get destroyed() { return this._destroyed; }

  /**
   * @type {Array<VcsModule>}
   * @readonly
   */
  get modules() {
    return [...this._modules];
  }

  /**
   * @returns {VcsEvent<VcsModule>}
   * @readonly
   */
  get moduleAdded() { return this._modules.added; }

  /**
   * @returns {VcsEvent<VcsModule>}
   * @readonly
   */
  get moduleRemoved() { return this._modules.removed; }

  /**
   * @type {string}
   * @readonly
   */
  get dynamicModuleId() { return this._dynamicModule._id; }

  /**
   * @type {VcsEvent<string>}
   * @readonly
   */
  get dynamicModuleIdChanged() { return this._dynamicModuleIdChanged; }

  /**
   * @type {OverrideClassRegistry<VcsMap>}
   * @readonly
   */
  get mapClassRegistry() { return this._mapClassRegistry; }

  /**
   * @type {OverrideClassRegistry<Layer>}
   * @readonly
   */
  get layerClassRegistry() { return this._layerClassRegistry; }

  /**
   * @type {OverrideClassRegistry<StyleItem>}
   * @readonly
   */
  get styleClassRegistry() { return this._styleClassRegistry; }

  /**
   * @type {OverrideClassRegistry<import("@vcmap/core").Category<Object|import("@vcmap/core").VcsObject>>}
   * @readonly
   */
  get categoryClassRegistry() { return this._categoryClassRegisty; }

  /**
   * @type {OverrideClassRegistry<*>}
   * @readonly
   */
  get categoryItemClassRegistry() { return this._categoryItemClassRegistry; }

  /**
   * @type {OverrideClassRegistry<import("@vcmap/core").TileProvider>}
   * @readonly
   */
  get tileProviderClassRegistry() { return this._tileProviderClassRegsitry; }

  /**
   * @type {OverrideClassRegistry<import("@vcmap/core").AbstractFeatureProvider>}
   * @readonly
   */
  get featureProviderClassRegistry() { return this._featureProviderClassRegsitry; }

  /**
   * @param {string} id
   * @returns {VcsModule}
   */
  getModuleById(id) {
    return this._modules.getByKey(id);
  }

  /**
   * @param {VcsModule} module
   * @returns {Promise<void>}
   * @protected
   */
  async _parseModule(module) {
    const { config } = module;
    if (config.projection) { // XXX this needs fixing. this should be _projections_ and there should be a `defaultProjection`
      setDefaultProjectionOptions(config.projection);
    }

    await this._styles.parseItems(config.styles, module._id);
    await this._layers.parseItems(config.layers, module._id);
    // TODO add flights & ade here

    await this._obliqueCollections.parseItems(config.obliqueCollections, module._id);
    await this._viewpoints.parseItems(config.viewpoints, module._id);
    await this._maps.parseItems(config.maps, module._id);

    if (Array.isArray(config.categories)) {
      await Promise.all((config.categories).map(async ({ name, items }) => {
        await this._categories.parseCategoryItems(name, items, module._id);
      }));
    }
  }

  /**
   * @param {VcsModule} module
   * @returns {Promise<void>}
   * @protected
   */
  async _setModuleState(module) {
    const { config } = module;
    [...this._layers]
      .filter(l => l[moduleIdSymbol] === module._id)
      .forEach((l) => {
        if (l.activeOnStartup) {
          l.activate()
            .catch((err) => {
              getLogger().error(`Failed to activate active on startup layer ${l.name}`);
              getLogger().error(err);
              this._layers.remove(l);
              l.destroy();
            });
        }
      });

    const activeObliqueCollection = [...this._obliqueCollections]
      .find(c => c[moduleIdSymbol] === module._id && c.activeOnStartup);

    if (activeObliqueCollection) {
      [...this._maps]
        .filter(m => m instanceof ObliqueMap)
        .forEach((m) => { /** @type {ObliqueMap} */ (m).setCollection(activeObliqueCollection); });
    }

    if (config.startingMapName) {
      await this._maps.setActiveMap(config.startingMapName);
    } else if (!this._maps.activeMap && this._maps.size > 0) {
      await this._maps.setActiveMap([...this._maps][0].name);
    }

    if (config.startingViewpointName && this._maps.activeMap) {
      const startViewpoint = this._viewpoints.getByKey(config.startingViewpointName);
      if (startViewpoint) {
        await this._maps.activeMap.gotoViewpoint(startViewpoint);
      }
    }
  }

  /**
   * @param {VcsModule} module
   * @returns {Promise<void>}
   */
  addModule(module) {
    check(module, VcsModule);

    this._moduleMutationPromise = this._moduleMutationPromise
      .then(async () => {
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

  /**
   * @param {string} moduleId
   * @returns {VcsModuleConfig}
   */
  serializeModule(moduleId) {
    check(moduleId, String);
    if (!this._modules.hasKey(moduleId)) {
      throw new Error('VcsModule is not managed by this app, call add(module) before');
    }
    const config = this._modules.getByKey(moduleId).toJSON();
    config.maps = this._maps.serializeModule(moduleId);
    config.layers = this._layers.serializeModule(moduleId);
    config.obliqueCollections = this._obliqueCollections.serializeModule(moduleId);
    config.viewpoints = this._viewpoints.serializeModule(moduleId);
    config.styles = this._styles.serializeModule(moduleId);
    config.categories = [...this._categories]
      .map(c => c.serializeModule(moduleId))
      .filter(c => !!c);

    return config;
  }

  /**
   * sets the given module as the dynamic
   * @param {VcsModule} module
   */
  setDynamicModule(module) {
    if (!this._modules.has(module)) {
      throw new Error('VcsModule is not managed by this app, call add(module) before');
    }
    if (this._dynamicModule !== module) {
      this._dynamicModule = module;
      this.dynamicModuleIdChanged.raiseEvent(this.dynamicModuleId);
    }
  }

  /**
   * resets the dynamic VcsModule to the "defaultDynamicModule"
   */
  resetDynamicModule() {
    this.setDynamicModule(this._defaultDynamicModule);
  }

  /**
   * @param {string} moduleId
   * @returns {Promise<void>}
   * @protected
   */
  async _removeModule(moduleId) {
    await Promise.all([
      this._maps.removeModule(moduleId),
      this._layers.removeModule(moduleId),
      this._viewpoints.removeModule(moduleId),
      this._styles.removeModule(moduleId),
      this._obliqueCollections.removeModule(moduleId),
    ]);
  }

  /**
   * @param {string} moduleId
   * @returns {Promise<void>}
   */
  removeModule(moduleId) {
    this._moduleMutationPromise = this._moduleMutationPromise
      .then(async () => {
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
  destroy() {
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
    destroyCollection(this._modules);
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

/**
 * @param {string} id
 * @returns {VcsApp}
 */
export function getVcsAppById(id) {
  return vcsApps.get(id);
}

window.vcs = window.vcs || {};
window.vcs.apps = vcsApps;

export default VcsApp;
