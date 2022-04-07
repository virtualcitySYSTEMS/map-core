import Category from './category.js';
import { categoryClassRegistry } from '../classRegistry.js';
import ViewPoint from '../util/viewpoint.js';
import ObliqueCollection from '../oblique/obliqueCollection.js';
import { deserializeLayer, deserializeMap } from '../vcsAppContextHelpers.js';

/**
 * @typedef {CategoryOptions} AppBackedCategoryOptions
 * @property {string} collectionName
 */

/**
 * @type {Object<string, string>}
 */
const collectionNameMap = {
  layers: 'layerClassRegistry',
  styles: 'styleClassRegistry',
  maps: 'mapClassRegistry',
  categories: 'categoryClassRegistry',
};

/**
 * @class
 * @extends {Category<import("@vcmap/core").VcsObject>}
 */
class AppBackedCategory extends Category {
  static get className() { return 'AppBackedCategory'; }

  /**
   * @param {AppBackedCategoryOptions} options
   */
  constructor(options) {
    options.classRegistryName = collectionNameMap[options.collectionName];
    super(options);
    this._collectionName = options.collectionName;
  }

  /**
   * @param {VcsObjectOptions} config
   * @returns {Promise<import("@vcmap/core").VcsObject>}
   * @protected
   */
  async _deserializeItem(config) {
    if (!this._app) {
      throw new Error('Cannot deserialize item before setting the vcApp');
    }

    if (this._collectionName === 'viewPoints') {
      return new ViewPoint(config);
    } else if (this._collectionName === 'obliqueCollections') {
      return new ObliqueCollection(config);
    } else if (this._collectionName === 'layers') {
      return deserializeLayer(this._app, config);
    } else if (this._collectionName === 'maps') {
      return deserializeMap(this._app, config);
    }
    return super._deserializeItem(config);
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
categoryClassRegistry.registerClass(AppBackedCategory.className, AppBackedCategory);
