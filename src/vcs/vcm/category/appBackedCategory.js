import Category from './category.js';
import { VcsClassRegistry } from '../classRegistry.js';

/**
 * @typedef {CategoryOptions} AppBackedCategoryOptions
 * @property {string} collectionName
 */

/**
 * @class
 * @extends {Category<import("@vcmap/core").VcsObject>}
 */
class AppBackedCategory extends Category {
  static get className() { return 'category.AppBackedCategory'; }

  /**
   * @param {AppBackedCategoryOptions} options
   */
  constructor(options) {
    options.typed = true;
    super(options);
    this._collectionName = options.collectionName;
  }

  setApp(app) {
    super.setApp(app);
    this.setCollection(this._app[this._collectionName]);
  }

  /**
   * @param {string} contextId
   * @returns {null}
   */
  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  serializeForContext(contextId) {
    return null;
  }
}

export default AppBackedCategory;
VcsClassRegistry.registerClass(AppBackedCategory.className, AppBackedCategory);
