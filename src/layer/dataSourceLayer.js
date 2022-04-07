import { EntityCollection } from '@vcmap/cesium';
import Layer from './layer.js';
import CesiumMap from '../map/cesiumMap.js';
import DataSourceCesiumImpl from './cesium/dataSourceCesiumImpl.js';
import { vcsLayerName } from './layerSymbols.js';
import FeatureVisibility, { FeatureVisibilityAction } from './featureVisibility.js';
import { getGlobalHider } from './globalHider.js';
import { layerClassRegistry } from '../classRegistry.js';

/**
 * @typedef {LayerOptions} DataSourceOptions
 * @property {Object|undefined} genericFeatureProperties
 * @api
 */

/**
 * @typedef {Object} DataSourcePickedObject
 * @property {import("@vcmap/cesium").Entity} id
 * @property {ClickPosition} clickedPosition
 * @property {Object} attributes
 */

/**
 * @typedef {LayerImplementationOptions} DataSourceImplementationOptions
 * @property {import("@vcmap/cesium").EntityCollection} entities
 * @property {import("@vcmap/cesium").DataSourceClock|undefined} clock
 * @api
 */

/**
 * Represents a layer of Cesium.Entity
 * @class
 * @export
 * @extends {Layer}
 * @api stable
 */
class DataSourceLayer extends Layer {
  static get className() { return 'DataSourceLayer'; }

  /**
   * @returns {DataSourceOptions}
   */
  static getDefaultOptions() {
    return {
      ...Layer.getDefaultOptions(),
      genericFeatureProperties: {},
    };
  }

  /**
   * @param {DataSourceOptions} options
   */
  constructor(options) {
    super(options);
    const defaultOptions = DataSourceLayer.getDefaultOptions();
    /**
     * The entities of this layer. Use the `addEntity` API to add Enitities to ensure interoperability with vcm interfaces
     * @type {import("@vcmap/cesium").EntityCollection}
     * @api
     */
    this.entities = new EntityCollection();
    /**
     * @type {import("@vcmap/cesium").DataSourceClock|undefined}
     */
    this.clock = undefined;
    /**
     * @type {Object}
     * @private
     */
    this._genericFeatureProperties = options.genericFeatureProperties || defaultOptions.genericFeatureProperties;

    /**
     * The feature visibility of this layer. NOTE: Entities cannot be highlighted at this moment.
     * @type {FeatureVisibility}
     * @api
     */
    this.featureVisibility = new FeatureVisibility();
    /**
     * @type {Array<Function>}
     * @private
     */
    this._featureVisibilityListeners = [];

    this._supportedMaps = [
      CesiumMap.className,
    ];
  }

  /**
   * Sets up listeners for featureVisibility and global hider
   * @private
   */
  _setUpFeatureVisibility() {
    const globalHider = getGlobalHider();
    this._featureVisibilityListeners = [
      this.featureVisibility.changed.addEventListener(({ action, ids }) => {
        if (action === FeatureVisibilityAction.HIDE) {
          ids.forEach((id) => {
            const entity = this.entities.getById(id);
            if (entity) {
              this.featureVisibility.addHiddenFeature(id, entity);
            }
          });
        } // highlight is _possible_ but very tricky with all the possible entity values with potential materials
      }),
      globalHider.changed.addEventListener(({ action, ids }) => {
        if (action === FeatureVisibilityAction.HIDE) {
          ids.forEach((id) => {
            const entity = this.entities.getById(id);
            if (entity) {
              globalHider.addFeature(id, entity);
            }
          });
        }
      }),
      this.entities.collectionChanged.addEventListener((c, added) => {
        added.forEach((entity) => {
          if (this.featureVisibility.hiddenObjects[entity.id]) {
            this.featureVisibility.addHiddenFeature(entity.id, entity);
          }

          if (globalHider.hiddenObjects[entity.id]) {
            globalHider.addFeature(entity.id, entity);
          }
        });
      }),
    ];
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  initialize() {
    if (!this.initialized) {
      this._setUpFeatureVisibility();
    }
    return super.initialize();
  }

  /**
   * @returns {DataSourceImplementationOptions}
   */
  getImplementationOptions() {
    return {
      ...super.getImplementationOptions(),
      entities: this.entities,
      clock: this.clock,
    };
  }

  /**
   * @param {CesiumMap} map
   * @returns {Array<DataSourceCesiumImpl>}
   */
  createImplementationsForMap(map) {
    if (map instanceof CesiumMap) {
      return [new DataSourceCesiumImpl(map, this.getImplementationOptions())];
    }
    return [];
  }

  /**
   * adds an entity
   * @param {import("@vcmap/cesium").Entity.ConstructorOptions|import("@vcmap/cesium").Entity} options - Cesium Entity options or the entity
   * @param {?Object=} attributes - a set of properties, typically used for rendering a balloon
   * @param {boolean=} allowPicking - whether to override the layers allowPicking setting for this entity
   * @returns {null|string} the entities id
   * @api stable
   */
  addEntity(options, attributes, allowPicking) {
    const entity = this.entities.add(options);
    entity[vcsLayerName] = this.name;
    entity.attributes = attributes;
    entity.allowPicking = allowPicking;
    return entity.id;
  }

  /**
   * Zooms to an entity with the given id
   * @param {string} id
   * @api stable
   */
  flyToEntity(id) {
    this.getImplementations().forEach((impl) => {
      /** @type {DataSourceCesiumImpl} */ (impl).flyToEntity(id);
    });
  }

  /**
   * Removes an entity from this layer by id
   * @param {string} id
   * @api
   */
  removeEntityById(id) {
    this.entities.removeById(id);
  }

  /**
   * @param {DataSourcePickedObject} object
   * @returns {?Object}
   */
  objectClickedHandler(object) {
    if (this.allowPicking && object.id.allowPicking !== false) {
      const model = object.id;
      const { id } = model;
      // @ts-ignore
      model.clickedPosition = object.clickedPosition;
      return {
        id,
        feature: object,
      };
    }
    return null;
  }

  /**
   * @param {DataSourcePickedObject} object
   * @returns {GenericFeature}
   */
  getGenericFeatureFromClickedObject(object) {
    const attributes = { ...this._genericFeatureProperties, ...object.attributes || {} };
    return {
      layerName: this.name,
      layerClass: this.className,
      attributes,
      longitude: object.clickedPosition.longitude,
      latitude: object.clickedPosition.latitude,
      height: object.clickedPosition.height,
      relativeToGround: false,
    };
  }

  /**
   * @inheritDoc
   * @returns {DataSourceOptions}
   */
  toJSON() {
    const config = /** @type {DataSourceOptions} */ (super.toJSON());
    if (Object.keys(this._genericFeatureProperties).length > 0) {
      config.genericFeatureProperties = { ...this._genericFeatureProperties };
    }
    return config;
  }

  /**
   * @inheritDoc
   */
  destroy() {
    this.entities.removeAll();
    this._featureVisibilityListeners.forEach((cb) => { cb(); });
    this._featureVisibilityListeners = [];
    this.featureVisibility.destroy();
    super.destroy();
  }
}

layerClassRegistry.registerClass(DataSourceLayer.className, DataSourceLayer);
export default DataSourceLayer;
