import { getLogger as getLoggerByName } from '@vcsuite/logger';
import Category from './category.js';
import './appBackedCategory.js';
import IndexedCollection from '../util/indexedCollection.js';
import { getObjectFromClassRegistry } from '../classRegistry.js';

/**
 * @returns {import("@vcsuite/logger").Logger}
 */
function getLogger() {
  return getLoggerByName('CategoryCollection');
}

/**
 * @class
 * @extends {IndexedCollection<Category<Object|import("@vcmap/core").VcsObject>>}
 */
class CategoryCollection extends IndexedCollection {
  /**
   * @param {import("@vcmap/core").VcsApp} app
   */
  constructor(app) {
    super();
    /**
     * @type {import("@vcmap/core").VcsApp}
     * @private
     */
    this._app = app;
    /**
     * Map of category names, where the value is a map of contextId and items.
     * @type {Map<string, Map<string, Array<Object>>>}
     * @private
     */
    this._cache = new Map();
    /**
     * @type {Function}
     * @private
     */
    this._contextRemovedListener = this._app.contextRemoved.addEventListener((context) => {
      this._cache.forEach((contextMap, name) => {
        contextMap.delete(context.id);
        if (contextMap.size === 0) {
          this._cache.delete(name);
        }
      });
    });
  }

  /**
   * Do not call add directly. Use request category for adding categories.
   * @param {Category<Object|import("@vcmap/core").VcsObject>} category
   * @returns {number|null}
   */
  add(category) { // XXX use a symbol to enforce using request over add?
    if (this.hasKey(category.name)) {
      return null;
    }

    category.setApp(this._app);
    const added = super.add(category);
    if (added != null && this._cache.has(category.name)) {
      this._cache
        .get(category.name)
        .forEach((items, contextId) => {
          this.parseCategoryItems(category.name, items, contextId);
        });

      this._cache.delete(category.name);
    }
    return added;
  }

  /**
   * Categories should be static. Removing them can lead to undefined behavior.
   * @param {Category<Object|import("@vcmap/core").VcsObject>} category
   */
  remove(category) { // XXX add logger warning?
    super.remove(category);
    this._cache.delete(category.name);
  }

  /**
   * Parses the category items. Items will only be parsed, if a category with said name exists. Otherwise,
   * they will be cached, until such a category is requested.
   * @param {string} name
   * @param {Array<Object>} items
   * @param {string} contextId
   * @returns {Promise<void>}
   */
  async parseCategoryItems(name, items, contextId) {
    const category = this.getByKey(name);

    if (category) {
      await category.collection.parseItems(items, contextId);
    } else if (this._cache.has(name)) {
      this._cache.get(name).set(contextId, items);
    } else {
      this._cache.set(name, new Map([[contextId, items]]));
    }
  }

  /**
   * Add categories with this API.
   * @param {CategoryOptions} options
   * @returns {Promise<Category<Object|import("@vcmap/core").VcsObject>>}
   */
  async requestCategory(options) {
    if (!options.name) {
      getLogger().error('Cannot request a category without a name');
      return null;
    }

    if (!options.type) {
      getLogger().warning(`Implicitly typing category ${options.name} as ${Category.className}`);
      options.type = Category.className;
    }

    let category;
    if (this.hasKey(options.name)) {
      category = this.getByKey(options.name);
      category.mergeOptions(options);
    } else {
      category = await getObjectFromClassRegistry(this._app.categoryClassRegistry, options);
      if (category) {
        if (this.add(category) == null) {
          return null;
        }
      }
    }

    if (!category) {
      throw new Error(`Category ${options.name} with type ${options.type} could not be created`);
    }
    return category;
  }

  destroy() {
    super.destroy();
    this._contextRemovedListener();
    this._cache.clear();
    this._app = null;
  }
}

export default CategoryCollection;
