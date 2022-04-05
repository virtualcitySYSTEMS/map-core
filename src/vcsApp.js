import { getLogger as getLoggerByName } from '@vcsuite/logger';
import { v4 as uuidv4 } from 'uuid';
import { check } from '@vcsuite/check';
import Context from './context.js';
import {
  contextIdSymbol,
  destroyCollection,
  getObjectFromOptions,
  deserializeViewPoint,
  deserializeMap,
  getLayerIndex,
  serializeLayer,
} from './vcsAppContextHelpers.js';
import makeOverrideCollection from './util/overrideCollection.js';
import CategoryCollection from './category/categoryCollection.js';
import MapCollection from './util/mapCollection.js';
import VcsMap from './map/vcsMap.js';
import Layer from './layer/layer.js';
import Collection from './util/collection.js';
import ObliqueCollection from './oblique/obliqueCollection.js';
import ViewPoint from './util/viewpoint.js';
import StyleItem from './style/styleItem.js';
import IndexedCollection from './util/indexedCollection.js';
import VcsEvent from './vcsEvent.js';
import { setDefaultProjectionOptions } from './util/projection.js';
import ObliqueMap from './map/obliqueMap.js';

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
    this._defaultDynamicContext = new Context({ id: '_defaultDynamicContext' });
    /**
     * @type {Context}
     * @private
     */
    this._dynamicContext = this._defaultDynamicContext;

    const getDynamicContextId = () => this._dynamicContext.id;
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
     * @type {OverrideLayerCollection}
     * @private
     */
    // @ts-ignore
    this._layers = makeOverrideCollection(
      this._maps.layerCollection,
      getDynamicContextId,
      serializeLayer.bind(null, this),
      getObjectFromOptions,
      Layer,
      getLayerIndex,
    );
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
    ); // XXX there is a global for this collection in core.
    /**
     * @type {OverrideCollection<import("@vcmap/core").ViewPoint>}
     * @private
     */
    this._viewPoints = makeOverrideCollection(
      new Collection(),
      getDynamicContextId,
      null,
      deserializeViewPoint,
      ViewPoint,
    );
    /**
     * @type {OverrideCollection<import("@vcmap/core").StyleItem>}
     * @private
     */
    this._styles = makeOverrideCollection(
      new Collection(),
      getDynamicContextId,
      null,
      getObjectFromOptions,
      StyleItem,
    ); // XXX there is a global for this collection in core.

    /**
     * @type {IndexedCollection<Context>}
     * @private
     */
    this._contexts = new IndexedCollection('id');
    this._contexts.add(this._dynamicContext);
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
    vcsApps.set(this._id, this);
  }

  /**
   * @type {string}
   * @readonly
   */
  get id() { return this._id; }

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
   * @type {OverrideCollection<import("@vcmap/core").ViewPoint>}
   * @readonly
   */
  get viewPoints() { return this._viewPoints; }

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
   * @returns {VcsEvent<Context>}
   * @readonly
   */
  get contextAdded() { return this._contexts.added; }

  /**
   * @returns {VcsEvent<Context>}
   * @readonly
   */
  get contextRemoved() { return this._contexts.removed; }

  get dynamicContextId() { return this._dynamicContext.id; }

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

    await this._styles.parseItems(config.styles, context.id);
    await this._layers.parseItems(config.layers, context.id);
    // TODO add flights & ade here

    await this._obliqueCollections.parseItems(config.obliqueCollections, context.id);
    await this._viewPoints.parseItems(config.viewpoints, context.id);
    await this._maps.parseItems(config.maps, context.id);

    if (Array.isArray(config.categories)) {
      await Promise.all((config.categories).map(async ({ name, items }) => {
        await this._categories.parseCategoryItems(name, items, context.id);
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
      .filter(l => l[contextIdSymbol] === context.id)
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
      .find(c => c[contextIdSymbol] === context.id && c.activeOnStartup);

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

    if (config.startingViewPointName && this._maps.activeMap) {
      const startViewPoint = this._viewPoints.getByKey(config.startingViewPointName);
      if (startViewPoint) {
        await this._maps.activeMap.gotoViewPoint(startViewPoint);
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
          getLogger().info(`context with id ${context.id} already loaded`);
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
   * @returns {Promise<void>}
   * @protected
   */
  async _removeContext(contextId) {
    await Promise.all([
      this._maps.removeContext(contextId),
      this._layers.removeContext(contextId),
      this._viewPoints.removeContext(contextId),
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
    destroyCollection(this._viewPoints);
    destroyCollection(this._styles);
    destroyCollection(this._contexts);
    destroyCollection(this._categories);
    this.destroyed.raiseEvent();
    this.destroyed.destroy();
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
