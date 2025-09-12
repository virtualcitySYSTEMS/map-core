import { check } from '@vcsuite/check';
import { Feature } from 'ol';
import type { GeoJSONFeature } from 'ol/format/GeoJSON.js';
import { destroyCollection } from '../vcsModuleHelpers.js';
import type {
  OverrideCollection,
  ReplacedEvent,
} from '../util/overrideCollection.js';
import makeOverrideCollection, {
  isOverrideCollection,
} from '../util/overrideCollection.js';
import type { VcsObjectOptions } from '../vcsObject.js';
import VcsObject from '../vcsObject.js';
import VectorLayer, { type VectorOptions } from '../layer/vectorLayer.js';
import IndexedCollection from '../util/indexedCollection.js';
import { parseGeoJSON, writeGeoJSONFeature } from '../layer/geojsonHelpers.js';
import Collection from '../util/collection.js';
import { getStyleOrDefaultStyle } from '../style/styleFactory.js';
import type { TypedConstructorOptions } from '../classRegistry.js';
import {
  categoryClassRegistry,
  getObjectFromClassRegistry,
} from '../classRegistry.js';
import OverrideClassRegistry from '../overrideClassRegistry.js';
import VcsEvent from '../vcsEvent.js';
import type VcsApp from '../vcsApp.js';
import { markVolatile } from '../vcsModule.js';
import type VectorStyleItem from '../style/vectorStyleItem.js';

export type CategoryOptions<T extends VcsObject | object> = VcsObjectOptions & {
  title?: string;
  /**
   * the class registry name on the current app to provide classes for this category. if provided, parseItems will deserialize using this class registry. See: {@link getObjectFromClassRegistry}.
   */
  classRegistryName?: keyof VcsApp;
  featureProperty?: keyof T;
  layerOptions?: VectorOptions;
  keyProperty?: keyof T;
};

function assignLayerOptions(layer: VectorLayer, options: VectorOptions): void {
  if (options.style) {
    layer.setStyle(getStyleOrDefaultStyle(options.style, layer.defaultStyle));
  }

  if (options.highlightStyle) {
    const highlightStyle = getStyleOrDefaultStyle(
      options.highlightStyle,
      layer.highlightStyle,
    ) as VectorStyleItem;
    layer.setHighlightStyle(highlightStyle);
  }

  if (options.vectorProperties) {
    layer.vectorProperties.setValues(options.vectorProperties);
  }

  if (options.zIndex != null) {
    layer.zIndex = options.zIndex;
  }
}

function checkMergeOptionOverride<
  T extends number | boolean | string | symbol | undefined,
>(key: string, value: T, defaultOption: T, option?: T): void {
  const isOverride =
    option == null ? value !== defaultOption : option !== value;
  if (isOverride) {
    throw new Error(`Cannot merge options, values of ${key} do not match`);
  }
}

/**
 * A category contains user based items and is a special container. The container should not be created directly, but via
 * the requestCategory API on the categories collection. Do not use toJSON to retrieve the state of a category, since
 * categories outlive modules and may be changed with mergeOptions to no longer reflect your initial state. Requestors
 * should keep track of the requested options themselves.
 * @template {Object|VcsObject} T the type of objects in this category
 * @template {Object} S the serialized state of the object in this category
 * @group Category
 */
class Category<
  T extends VcsObject | object = VcsObject | object,
  S extends object = object,
> extends VcsObject {
  static get className(): string {
    return 'Category';
  }

  static getDefaultConfig(): CategoryOptions<VcsObject> {
    return {
      title: '',
      featureProperty: undefined,
      classRegistryName: undefined,
      layerOptions: {},
      keyProperty: 'name',
    };
  }

  title: string;

  protected _app: VcsApp | null = null;

  private _featureProperty: keyof T | undefined;

  private _classRegistryName: keyof VcsApp | undefined;

  private _layerOptions: VectorOptions;

  protected _layer: VectorLayer | null;

  private _keyProperty: keyof T;

  /**
   * Event raised if the collection is reset
   */
  private _collectionChanged = new VcsEvent<void>();

  private _collectionListeners: (() => void)[] = [];

  private _collection = makeOverrideCollection<T, Collection<T>, S>(
    new IndexedCollection(),
    this._getDynamicModuleId.bind(this),
    this._serializeItem.bind(this),
    this._deserializeItem.bind(this),
  );

  // eslint-disable-next-line class-methods-use-this
  private _moduleRemovedListener: () => void = () => {};

  constructor(options: CategoryOptions<T>) {
    const defaultOptions = Category.getDefaultConfig();
    super({ ...defaultOptions, ...options });

    this.title = options.title || this.name;
    this._featureProperty =
      options.featureProperty ||
      (defaultOptions.featureProperty as keyof T | undefined);

    this._classRegistryName = options.classRegistryName;
    this._layerOptions =
      options.layerOptions || (defaultOptions.layerOptions as VectorOptions);
    this._layer = null;
    if (this._featureProperty) {
      this._layer = new VectorLayer(this._layerOptions);
      markVolatile(this._layer);
    }

    this._keyProperty =
      options.keyProperty || (defaultOptions.keyProperty as keyof T);

    this.setCollection(new IndexedCollection(this._keyProperty));
  }

  get classRegistryName(): string | symbol | undefined {
    return this._classRegistryName;
  }

  get collection(): OverrideCollection<T, Collection<T>, S> {
    return this._collection;
  }

  /**
   * Event raised if the collection is reset
   */
  get collectionChanged(): VcsEvent<void> {
    return this._collectionChanged;
  }

  /**
   * Returns the layer of this collection. Caution, do not use the layer API to add or remove items.
   * When adding items to the collection, the features are added to the layer async (timeout of 0), since there is weird behavior
   * when removing and adding a feature with the same id in the same sync call.
   */
  get layer(): VectorLayer | null {
    return this._layer;
  }

  protected _itemAdded(item: T): void {
    if (this._featureProperty && this._layer) {
      const id = item[this._keyProperty];
      this._layer.removeFeaturesById([id as string]); // this may be a replacement.

      const geoJsonFeature = item[this._featureProperty];
      let feature: Feature | undefined;
      if (geoJsonFeature instanceof Feature) {
        feature = geoJsonFeature;
      } else if (typeof geoJsonFeature === 'object') {
        const { features } = parseGeoJSON(geoJsonFeature as GeoJSONFeature);
        if (features[0]) {
          // XXX do we warn on feature collection?
          feature = features[0];
        }
      }

      if (feature) {
        feature.setId(String(id));
        setTimeout(() => {
          this._layer?.addFeatures([feature]);
        }, 0); // We need to set a timeout, since removing and adding the feature in the same sync call leads to undefined behavior in OL TODO recheck in ol 6.11
      }
    }
  }

  protected _itemRemoved(item: T): void {
    if (this._featureProperty && this._layer) {
      this._layer.removeFeaturesById([item[this._keyProperty] as string]);
    }
  }

  // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-unused-vars
  protected _itemReplaced(_item: ReplacedEvent<T>): void {}

  // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-unused-vars
  protected _itemMoved(_item: T): void {}

  private _getDynamicModuleId(): string {
    if (!this._app) {
      throw new Error('Cannot get dynamic module id, before setting the vcApp');
    }
    return this._app.dynamicModuleId;
  }

  /**
   * Throws if typed, featureProperty and keyProperty do not match. Merges other options.
   * Only merges: style, highlightStyle, zIndex & vectorProperties from layerOptions.
   * @param  options
   */
  mergeOptions(options: CategoryOptions<T>): void {
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
      defaultOptions.featureProperty as keyof T,
      options.featureProperty,
    );
    checkMergeOptionOverride(
      'keyProperty',
      this._keyProperty,
      defaultOptions.keyProperty as keyof T,
      options.keyProperty,
    );
    this.title = options.title || this.title;
    if (options.layerOptions && this._layer) {
      assignLayerOptions(this._layer, options.layerOptions);
    }
  }

  /**
   * When setting the category, it MUST use the same uniqueKey as the previous collection (default is "name").
   * All items in the current collection _will be destroyed_ and the current collection will be destroyed. The category will take
   * complete ownership of the collection and destroy it once the category is destroyed. The collection will
   * be turned into an {@link OverrideCollection}
   * @param  collection
   */
  setCollection(
    collection: Collection<T> | OverrideCollection<T, IndexedCollection<T>>,
  ): void {
    check(collection, Collection);

    if (this._keyProperty !== collection.uniqueKey) {
      throw new Error(
        'The collections key property does not match the categories key property',
      );
    }

    this._collectionListeners.forEach((cb) => {
      cb();
    });
    if (this._collection) {
      destroyCollection(this._collection);
    }
    if (this._layer) {
      this._layer.removeAllFeatures(); // XXX should we call `itemRemoved` instead?
    }

    this._collection = (collection as OverrideCollection<T, Collection<T>, S>)[
      isOverrideCollection
    ]
      ? (collection as OverrideCollection<T, Collection<T>, S>)
      : makeOverrideCollection<T, Collection<T>, S>(
          collection,
          this._getDynamicModuleId.bind(this),
          this._serializeItem.bind(this),
          this._deserializeItem.bind(this),
        );

    [...this.collection].forEach((item) => {
      this._itemAdded(item);
    });

    this._collectionListeners = [
      this._collection.added.addEventListener(this._itemAdded.bind(this)),
      this._collection.removed.addEventListener(this._itemRemoved.bind(this)),
      this._collection.replaced.addEventListener(this._itemReplaced.bind(this)),
    ];

    if (
      (this._collection as OverrideCollection<T, IndexedCollection<T>>).moved
    ) {
      this._collectionListeners.push(
        (
          this._collection as OverrideCollection<T, IndexedCollection<T>>
        ).moved.addEventListener(this._itemMoved.bind(this)),
      );
    }
    this.collectionChanged.raiseEvent();
  }

  setApp(app: VcsApp): void {
    if (this._app) {
      throw new Error('Cannot switch apps');
    }
    this._app = app;
    this._moduleRemovedListener = this._app.moduleRemoved.addEventListener(
      (module) => {
        this._collection.removeModule(module._id);
      },
    );
    if (this._layer) {
      this._app.layers.add(this._layer);
    }
  }

  protected _deserializeItem(config: object): Promise<T> {
    if (!this._app) {
      throw new Error('Cannot deserialize item before setting the vcApp');
    }
    const classRegistry = this._classRegistryName
      ? (this._app[this._classRegistryName] as OverrideClassRegistry<
          new () => T
        >)
      : null;

    let item: T | null = null;
    if (classRegistry && classRegistry instanceof OverrideClassRegistry) {
      item = getObjectFromClassRegistry(
        classRegistry,
        config as TypedConstructorOptions,
      );
    }
    return Promise.resolve((item ?? config) as T);
  }

  protected _serializeItem(item: T): S {
    const config = JSON.parse(JSON.stringify(item)) as Record<keyof T, unknown>;
    if (this._featureProperty && this._layer) {
      const feature = this._layer.getFeatureById(
        item[this._keyProperty] as string,
      );
      if (feature) {
        config[this._featureProperty] = writeGeoJSONFeature(feature);
      }
    }
    return config as S;
  }

  serializeModule(moduleId: string): { name: string; items: object[] } | null {
    if (this._collection.size === 0) {
      return null;
    }

    return {
      name: this.name,
      items: this.collection.serializeModule(moduleId),
    };
  }

  toJSON(defaultOptions = Category.getDefaultConfig()): CategoryOptions<T> {
    const config: CategoryOptions<T> = super.toJSON(defaultOptions);

    if (this.title !== this.name) {
      config.title = this.title;
    }
    if (this._featureProperty !== defaultOptions.featureProperty) {
      config.featureProperty = this._featureProperty;
    }
    if (this._classRegistryName !== defaultOptions.classRegistryName) {
      config.classRegistryName = this._classRegistryName;
    }
    if (Object.keys(this._layerOptions).length > 0) {
      config.layerOptions = { ...this._layerOptions };
    }
    if (this._keyProperty !== defaultOptions.keyProperty) {
      config.keyProperty = this._keyProperty;
    }
    return config;
  }

  destroy(): void {
    super.destroy();
    if (this._app && this._layer) {
      this._app.layers.remove(this._layer);
    }
    if (this._layer) {
      this._layer.destroy();
    }

    this._collectionListeners.forEach((cb) => {
      cb();
    });
    this._collectionListeners.splice(0);
    this._moduleRemovedListener();
    this._moduleRemovedListener = (): void => {};
    destroyCollection(this._collection);
    this._collectionChanged.destroy();
    this._app = null;
  }
}

export default Category;
categoryClassRegistry.registerClass(Category.className, Category);
