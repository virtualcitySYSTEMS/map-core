import { getLogger as getLoggerByName } from '@vcsuite/logger';
import { v4 as uuidv4 } from 'uuid';
import { check } from '@vcsuite/check';
import Context from './context.js';
import {
  contextIdSymbol,
  destroyCollection,
  deserializeViewpoint,
  deserializeMap,
  getLayerIndex,
  serializeLayer,
  deserializeLayer,
} from './vcsAppContextHelpers.js';
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
export const defaultDynamicContextId = '_defaultDynamicContext';

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
     * @type {Context}
     * @private
     */
    this._defaultDynamicContext = new Context({ _id: defaultDynamicContextId });
    /**
     * @type {Context}
     * @private
     */
    this._dynamicContext = this._defaultDynamicContext;

    const getDynamicContextId = () => this._dynamicContext._id;

    /**
     * @type {VcsEvent<string>}
     * @private
     */
    this._dynamicContextIdChanged = new VcsEvent();

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
      getDynamicContextId,
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
      getDynamicContextId,
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
      getDynamicContextId,
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
      getDynamicContextId,
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
      getDynamicContextId,
      null,
      getObjectFromClassRegistry.bind(null, this._styleClassRegistry),
      StyleItem,
    );

    /**
     * @type {IndexedCollection<Context>}
     * @private
     */
    this._contexts = new IndexedCollection('_id');
    this._contexts.add(this._dynamicContext);
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
    this._contextMutationPromise = Promise.resolve();
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
   * @type {Array<Context>}
   * @readonly
   */
  get contexts() {
    return [...this._contexts];
  }

  /**
   * @returns {VcsEvent<Context>}
   * @readonly
   */
  get contextAdded() { return this._contexts.added; }

  /**
   * @returns {VcsEvent<Context>}
   * @readonly
   */
  get contextRemoved() { return this._contexts.removed; }

  /**
   * @type {string}
   * @readonly
   */
  get dynamicContextId() { return this._dynamicContext._id; }

  /**
   * @type {VcsEvent<string>}
   * @readonly
   */
  get dynamicContextIdChanged() { return this._dynamicContextIdChanged; }

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
   * @returns {Context}
   */
  getContextById(id) {
    return this._contexts.getByKey(id);
  }

  /**
   * @param {Context} context
   * @returns {Promise<void>}
   * @protected
   */
  async _parseContext(context) {
    const { config } = context;
    if (config.projection) { // XXX this needs fixing. this should be _projections_ and there should be a `defaultProjection`
      setDefaultProjectionOptions(config.projection);
    }

    await this._styles.parseItems(config.styles, context._id);
    await this._layers.parseItems(config.layers, context._id);
    // TODO add flights & ade here

    await this._obliqueCollections.parseItems(config.obliqueCollections, context._id);
    await this._viewpoints.parseItems(config.viewpoints, context._id);
    await this._maps.parseItems(config.maps, context._id);

    if (Array.isArray(config.categories)) {
      await Promise.all((config.categories).map(async ({ name, items }) => {
        await this._categories.parseCategoryItems(name, items, context._id);
      }));
    }
  }

  /**
   * @param {Context} context
   * @returns {Promise<void>}
   * @protected
   */
  async _setContextState(context) {
    const { config } = context;
    [...this._layers]
      .filter(l => l[contextIdSymbol] === context._id)
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
      .find(c => c[contextIdSymbol] === context._id && c.activeOnStartup);

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
   * @param {Context} context
   * @returns {Promise<void>}
   */
  addContext(context) {
    check(context, Context);

    this._contextMutationPromise = this._contextMutationPromise
      .then(async () => {
        if (this._contexts.has(context)) {
          getLogger().info(`context with id ${context._id} already loaded`);
          return;
        }

        await this._parseContext(context);
        await this._setContextState(context);
        this._contexts.add(context);
      });
    return this._contextMutationPromise;
  }

  /**
   * @param {string} contextId
   * @returns {VcsAppConfig}
   */
  serializeContext(contextId) {
    check(contextId, String);
    if (!this._contexts.hasKey(contextId)) {
      throw new Error('Context is not managed by this app, call add(context) before');
    }
    const config = this._contexts.getByKey(contextId).toJson();
    config.maps = this._maps.serializeContext(contextId);
    config.layers = this._layers.serializeContext(contextId);
    config.obliqueCollections = this._obliqueCollections.serializeContext(contextId);
    config.viewpoints = this._viewpoints.serializeContext(contextId);
    config.styles = this._styles.serializeContext(contextId);
    config.categories = [...this._categories]
      .map(c => c.serializeContext(contextId))
      .filter(c => !!c);

    return config;
  }

  /**
   * sets the given context as the dynamic
   * @param {Context} context
   */
  setDynamicContext(context) {
    if (!this._contexts.has(context)) {
      throw new Error('Context is not managed by this app, call add(context) before');
    }
    if (this._dynamicContext !== context) {
      this._dynamicContext = context;
      this.dynamicContextIdChanged.raiseEvent(this.dynamicContextId);
    }
  }

  /**
   * resets the dynamic Context to the "defaultDynamicContext"
   */
  resetDynamicContext() {
    this.setDynamicContext(this._defaultDynamicContext);
  }

  /**
   * @param {string} contextId
   * @returns {Promise<void>}
   * @protected
   */
  async _removeContext(contextId) {
    await Promise.all([
      this._maps.removeContext(contextId),
      this._layers.removeContext(contextId),
      this._viewpoints.removeContext(contextId),
      this._styles.removeContext(contextId),
      this._obliqueCollections.removeContext(contextId),
    ]);
  }

  /**
   * @param {string} contextId
   * @returns {Promise<void>}
   */
  removeContext(contextId) {
    this._contextMutationPromise = this._contextMutationPromise
      .then(async () => {
        const context = this._contexts.getByKey(contextId);
        if (!context) {
          getLogger().info(`context with id ${contextId} has alread been removed`);
          return;
        }
        await this._removeContext(contextId);
        this._contexts.remove(context);
      });

    return this._contextMutationPromise;
  }

  /**
   * Destroys the app and all its collections, their content and ui managers.
   */
  destroy() {
    Object.defineProperty(this, '_contextMutationPromise', {
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
    destroyCollection(this._contexts);
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
    this.dynamicContextIdChanged.destroy();
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
