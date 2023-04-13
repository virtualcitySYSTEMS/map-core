import { getLogger as getLoggerByName } from '@vcsuite/logger';
import Category from './category.js';
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
     * Map of category names, where the value is a map of moduleId and items.
     * @type {Map<string, Map<string, Array<Object>>>}
     * @private
     */
    this._cache = new Map();
    /**
     * @type {Function}
     * @private
     */
    this._moduleRemovedListener = this._app.moduleRemoved.addEventListener((module) => {
      this._cache.forEach((moduleMap, name) => {
        moduleMap.delete(module._id);
        if (moduleMap.size === 0) {
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
        .forEach((items, moduleId) => {
          this.parseCategoryItems(category.name, items, moduleId);
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
   * @param {string} moduleId
   * @returns {Promise<void>}
   */
  async parseCategoryItems(name, items, moduleId) {
    const category = this.getByKey(name);

    if (category) {
      await category.collection.parseItems(items, moduleId);
    } else if (this._cache.has(name)) {
      this._cache.get(name).set(moduleId, items);
    } else {
      this._cache.set(name, new Map([[moduleId, items]]));
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
    this._moduleRemovedListener();
    this._cache.clear();
    this._app = null;
  }
}

export default CategoryCollection;
