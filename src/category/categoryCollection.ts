import { getLogger as getLoggerByName, type Logger } from '@vcsuite/logger';
import Category, { CategoryOptions } from './category.js';
import IndexedCollection from '../util/indexedCollection.js';
import { getObjectFromClassRegistry } from '../classRegistry.js';
import type VcsApp from '../vcsApp.js';
import VcsObject from '../vcsObject.js';

function getLogger(): Logger {
  return getLoggerByName('CategoryCollection');
}

/**
 * @group Category
 */
class CategoryCollection extends IndexedCollection<Category> {
  private _app: VcsApp;

  /**
   * Map of category names, where the value is a map of moduleId and items.
   */
  private _cache: Map<string, Map<string, object[]>> = new Map();

  private _moduleRemovedListener: () => void;

  constructor(app: VcsApp) {
    super();

    this._app = app;

    this._moduleRemovedListener = this._app.moduleRemoved.addEventListener(
      (module) => {
        this._cache.forEach((moduleMap, name) => {
          moduleMap.delete(module._id);
          if (moduleMap.size === 0) {
            this._cache.delete(name);
          }
        });
      },
    );
  }

  /**
   * Do not call add directly. Use request category for adding categories.
   */
  add(category: Category): number | null {
    // XXX use a symbol to enforce using request over add?
    if (this.hasKey(category.name)) {
      return null;
    }

    category.setApp(this._app);
    const added = super.add(category);
    if (added != null && this._cache.has(category.name)) {
      this._cache.get(category.name)!.forEach((items, moduleId) => {
        // eslint-disable-next-line no-void
        void this.parseCategoryItems(category.name, items, moduleId);
      });

      this._cache.delete(category.name);
    }
    return added;
  }

  /**
   * Categories should be static. Removing them can lead to undefined behavior.
   */
  remove(category: Category): void {
    // XXX add logger warning?
    super.remove(category);
    this._cache.delete(category.name);
  }

  /**
   * Parses the category items. Items will only be parsed, if a category with said name exists. Otherwise,
   * they will be cached, until such a category is requested.
   */
  async parseCategoryItems(
    name: string,
    items: object[],
    moduleId: string,
  ): Promise<void> {
    const category = this.getByKey(name);

    if (category) {
      await category.collection.parseItems(items, moduleId);
    } else if (this._cache.has(name)) {
      this._cache.get(name)!.set(moduleId, items);
    } else {
      this._cache.set(name, new Map([[moduleId, items]]));
    }
  }

  /**
   * Add categories with this API.
   */
  requestCategory<T extends VcsObject | object>(
    options: CategoryOptions<T>,
  ): Category<T> | null {
    if (!options.name) {
      getLogger().error('Cannot request a category without a name');
      return null;
    }

    if (!options.type) {
      getLogger().warning(
        `Implicitly typing category ${options.name} as ${Category.className}`,
      );
      options.type = Category.className;
    }

    let category: Category<T> | Category | null;
    if (this.hasKey(options.name)) {
      category = this.getByKey(options.name) as unknown as Category<T>;
      category.mergeOptions(options);
    } else {
      category = getObjectFromClassRegistry(
        this._app.categoryClassRegistry,
        options,
      );
      if (category) {
        if (this.add(category) == null) {
          return null;
        }
      }
    }

    if (!category) {
      throw new Error(
        `Category ${options.name} with type ${options.type} could not be created`,
      );
    }
    return category as Category<T>;
  }

  destroy(): void {
    super.destroy();
    this._moduleRemovedListener();
    this._cache.clear();
  }
}

export default CategoryCollection;
