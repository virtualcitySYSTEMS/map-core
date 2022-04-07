import { check } from '@vcsuite/check';
import { v4 as uuidv4 } from 'uuid';
import { Feature } from 'ol';
import { contextIdSymbol, destroyCollection } from '../vcsAppContextHelpers.js';
import makeOverrideCollection, { isOverrideCollection } from '../util/overrideCollection.js';
import VcsObject from '../vcsObject.js';
import VectorLayer from '../layer/vectorLayer.js';
import IndexedCollection from '../util/indexedCollection.js';
import { parseGeoJSON, writeGeoJSONFeature } from '../layer/geojsonHelpers.js';
import Collection from '../util/collection.js';
import { getStyleOrDefaultStyle } from '../style/styleFactory.js';
import { categoryClassRegistry, getObjectFromClassRegistry } from '../classRegistry.js';
import OverrideClassRegistry from '../overrideClassRegistry.js';

/**
 * @typedef {VcsObjectOptions} CategoryOptions
 * @property {string|Object<string, string>} [title]
 * @property {string} [classRegistryName=''] - the class registry name on the current app to provide classes for this category. if provided, parseItems will deserialize using this class registry. See: {@link getObjectFromClassRegistry}.
 * @property {string|undefined} [featureProperty]
 * @property {VectorOptions} [layerOptions={}]
 * @property {Array<Object>} [items] - items are not evaluated by the constructor but passed to parseItem during deserialization.
 * @property {string} [keyProperty=name]
 */

/**
 * @type {*|string}
 */
const categoryContextId = uuidv4();

/**
 * @param {import("@vcmap/core").VectorLayer} layer
 * @param {VectorOptions} options
 * @private
 */
function assignLayerOptions(layer, options) {
  if (options.style) {
    layer.setStyle(getStyleOrDefaultStyle(options.style, layer.defaultStyle));
  }

  if (options.highlightStyle) {
    const highlightStyle = getStyleOrDefaultStyle(options.highlightStyle, layer.highlightStyle);
    layer.setHighlightStyle(/** @type {import("@vcmap/core").VectorStyleItem} */ (highlightStyle));
  }

  if (options.vectorProperties) {
    layer.vectorProperties.setValues(options.vectorProperties);
  }

  if (options.zIndex != null) {
    layer.zIndex = options.zIndex;
  }
}

/**
 * @param {string} key
 * @param {T} value
 * @param {T} defaultOption
 * @param {T=} option
 * @template {number|boolean|string} T
 * @returns {void}
 */
function checkMergeOptionOverride(key, value, defaultOption, option) {
  const isOverride = option == null ? value !== defaultOption : option !== value;
  if (isOverride) {
    throw new Error(`Cannot merge options, values of ${key} do not match`);
  }
}

/**
 * A category contains user based items and is a special container. The container should not be created directly, but via
 * the requestCategory API on the categories collection. Do not use toJSON to retrieve the state of a category, since
 * categories outlive contexts and may be changed with mergeOptions to no longer reflect your initial state. Requestors
 * should keep track of the requested options themselves.
 * @class
 * @extends {VcsObject}
 * @template {Object|VcsObject} T
 */
class Category extends VcsObject {
  static get className() { return 'Category'; }

  /**
   * @returns {CategoryOptions}
   */
  static getDefaultConfig() {
    return {
      title: '',
      featureProperty: undefined,
      classRegistryName: undefined,
      layerOptions: {},
      keyProperty: 'name',
      items: [],
    };
  }

  /**
   * @param {CategoryOptions} options
   */
  constructor(options) {
    super(options);
    const defaultOptions = Category.getDefaultConfig();
    /**
     * @type {string|Object<string, string>}
     */
    this.title = options.title || this.name;
    /**
     * @type {import("@vcmap/core").VcsApp}
     * @protected
     */
    this._app = null;
    /**
     * @type {string}
     * @private
     */
    this._featureProperty = options.featureProperty || defaultOptions.featureProperty;
    /**
     * @type {string}
     * @private
     */
    this._classRegistryName = options.classRegistryName;
    /**
     * @type {VectorOptions}
     * @private
     */
    this._layerOptions = options.layerOptions || defaultOptions.layerOptions;
    /**
     * @type {import("@vcmap/core").VectorLayer}
     * @protected
     */
    this._layer = null;
    if (this._featureProperty) {
      this._layer = new VectorLayer(this._layerOptions);
      this._layer[contextIdSymbol] = categoryContextId;
    }
    /**
     * @type {string}
     * @private
     */
    this._keyProperty = options.keyProperty || defaultOptions.keyProperty;
    /**
     * @type {Array<function():void>}
     * @private
     */
    this._collectionListeners = [];
    /**
     * @type {OverrideCollection<T>}
     * @private
     */
    this._collection = null;
    this.setCollection(new IndexedCollection(this._keyProperty));
    /**
     * @type {function():void}
     * @private
     */
    this._contextRemovedListener = () => {};
  }

  /**
   * @type {string}
   * @readonly
   */
  get classRegistryName() { return this._classRegistryName; }

  /**
   * The collection of this category.
   * @type {OverrideCollection<T>}
   * @readonly
   */
  get collection() {
    return this._collection;
  }

  /**
   * Returns the layer of this collection. Caution, do not use the layer API to add or remove items.
   * When adding items to the collection, the features are added to the layer async (timeout of 0), since there is weird behavior
   * when removing and adding a feature with the same id in the same sync call.
   * @type {import("@vcmap/core").VectorLayer|null}
   */
  get layer() {
    return this._layer;
  }

  /**
   * @param {T} item
   * @protected
   */
  _itemAdded(item) {
    if (this._featureProperty) {
      const id = item[this._keyProperty];
      this._layer.removeFeaturesById([id]); // this may be a replacement.

      const geoJsonFeature = item[this._featureProperty];
      let feature;
      if (geoJsonFeature instanceof Feature) {
        feature = geoJsonFeature;
      } else if (typeof geoJsonFeature === 'object') {
        const { features } = parseGeoJSON(geoJsonFeature);
        if (features[0]) { // XXX do we warn on feature collection?
          feature = features[0];
        }
      }

      if (feature) {
        feature.setId(id);
        setTimeout(() => { this._layer.addFeatures([feature]); }, 0); // We need to set a timeout, since removing and adding the feature in the same sync call leads to undefined behavior in OL TODO recheck in ol 6.11
      }
    }
  }

  /**
   * @param {T} item
   * @protected
   */
  _itemRemoved(item) {
    if (this._featureProperty) {
      this._layer.removeFeaturesById([item[this._keyProperty]]);
    }
  }

  /**
   * @param {T} item
   * @protected
   */
  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  _itemReplaced(item) {}

  /**
   * @param {T} item
   * @protected
   */
  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  _itemMoved(item) {}

  /**
   * @returns {string}
   * @private
   */
  _getDynamicContextId() {
    if (!this._app) {
      throw new Error('Cannot get dynamic context id, before setting the vcApp');
    }
    return this._app.dynamicContextId;
  }

  /**
   * Throws if typed, featureProperty and keyProperty do not match. Merges other options.
   * Only merges: style, highlightStyle, zIndex & vectorProperties from layerOptions.
   * @param {CategoryOptions} options
   */
  mergeOptions(options) {
    const defaultOptions = Category.getDefaultConfig();
    checkMergeOptionOverride(
      'classRegistryName',
      this._classRegistryName,
      defaultOptions.classRegistryName,
      options.classRegistryName,
    );
    checkMergeOptionOverride(
      'featureProperty',
      this._featureProperty,
      defaultOptions.featureProperty,
      options.featureProperty,
    );
    checkMergeOptionOverride('keyProperty', this._keyProperty, defaultOptions.keyProperty, options.keyProperty);
    this.title = options.title || this.title;
    if (options.layerOptions && this._layer) {
      assignLayerOptions(this._layer, options.layerOptions);
    }
  }

  /**
   * When setting the category, it MUST use the same unqiueKey as the previous collection (default is "name").
   * All items in the current collection _will be destroyed_ and the current collection will be destroyed. The category will take
   * complete ownership of the collection and destroy it once the category is destroyed. The collection will
   * be turned into an {@see OverrideCollection}.
   * @param {import("@vcmap/core").Collection<T>} collection
   */
  setCollection(collection) {
    check(collection, Collection);

    if (this._keyProperty !== collection.uniqueKey) {
      throw new Error('The collections key property does not match the categories key property');
    }

    this._collectionListeners.forEach((cb) => { cb(); });
    if (this._collection) {
      destroyCollection(this._collection);
    }
    if (this._layer) {
      this._layer.removeAllFeatures(); // XXX should we call `itemRemoved` instead?
    }

    this._collection = collection[isOverrideCollection] ?
      /** @type {OverrideCollection} */ (collection) :
      makeOverrideCollection(
        collection,
        this._getDynamicContextId.bind(this),
        this._serializeItem.bind(this),
        this._deserializeItem.bind(this),
      );

    [...this.collection].forEach((item) => { this._itemAdded(item); });
    /**
     * @type {Array<function():void>}
     * @private
     */
    this._collectionListeners = [
      this._collection.added.addEventListener(this._itemAdded.bind(this)),
      this._collection.removed.addEventListener(this._itemRemoved.bind(this)),
      this._collection.replaced.addEventListener(this._itemReplaced.bind(this)),
    ];

    // @ts-ignore
    if (this._collection.moved) {
      // @ts-ignore
      this._collectionListeners.push(this._collection.moved.addEventListener(this._itemMoved.bind(this)));
    }
  }

  /**
   * @param {import("@vcmap/core").VcsApp} app
   */
  setApp(app) {
    if (this._app) {
      throw new Error('Cannot switch apps');
    }
    this._app = app;
    this._contextRemovedListener = this._app.contextRemoved.addEventListener((context) => {
      this._collection.removeContext(context.id);
    });
    if (this._layer) {
      this._app.layers.add(this._layer);
    }
  }

  /**
   * @protected
   * @param {*} config
   * @returns {Promise<T>} // XXX should this still be async?
   */
  async _deserializeItem(config) {
    if (!this._app) {
      throw new Error('Cannot deserialize item before setting the vcApp');
    }
    const classRegistry = this._classRegistryName ? this._app[this._classRegistryName] : null;
    if (classRegistry && classRegistry instanceof OverrideClassRegistry) {
      return getObjectFromClassRegistry(classRegistry, config);
    }
    return config;
  }

  /**
   * @protected
   * @param {T} item
   * @returns {Array<Object>}
   */
  _serializeItem(item) {
    const config = JSON.parse(JSON.stringify(item));
    if (this._featureProperty) {
      const feature = this._layer.getFeatureById(item[this._keyProperty]);
      if (feature) {
        config[this._featureProperty] = writeGeoJSONFeature(feature);
      }
    }
    return config;
  }

  /**
   * @param {string} contextId
   * @returns {CategoryOptions|null}
   */
  serializeForContext(contextId) {
    if (this._collection.size === 0) {
      return null;
    }

    return {
      name: this.name,
      items: this.collection.serializeContext(contextId),
    };
  }

  destroy() {
    super.destroy();
    if (this._app && this._layer) {
      this._app.layers.remove(this._layer);
    }
    if (this._layer) {
      this._layer.destroy();
    }

    this._collectionListeners.forEach((cb) => { cb(); });
    this._collectionListeners.splice(0);
    this._contextRemovedListener();
    this._contextRemovedListener = () => {};
    destroyCollection(this._collection);
    this._app = null;
  }
}

export default Category;
categoryClassRegistry.registerClass(Category.className, Category);
