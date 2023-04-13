import { v4 as uuidv4 } from 'uuid';
import { moduleIdSymbol } from './vcsModuleHelpers.js';
import Projection from './util/projection.js';

/**
 * @typedef {Object} VcsModuleConfig
 * @property {string|undefined} [_id]
 * @property {string|undefined} [name]
 * @property {string|undefined} [description]
 * @property {Array<LayerOptions>} [layers]
 * @property {Array<VcsMapOptions>} [maps]
 * @property {Array<StyleItemOptions>} [styles]
 * @property {Array<ViewpointOptions>} [viewpoints]
 * @property {string} [startingViewpointName]
 * @property {string} [startingMapName]
 * @property {ProjectionOptions} [projection]
 * @property {Array<{ name: string, items: Array<Object> }>} [categories]
 * @property {Array<ObliqueCollectionOptions>} [obliqueCollections]
 */

/**
 * The id of the volatile module. Objects with this id shall never be serialized.
 * @type {string}
 */
export const volatileModuleId = uuidv4();

/**
 * This marks an object as "volatile". This ensures, that an object added to the {@see VcsApp}
 * will never be serialized into a module, regardless of the current dynamic module. Typical use case is a scratch layer
 * which represents temporary features.
 * @param {import("@vcmap/core").VcsObject|Object} object - the object to mark as volatile
 */
export function markVolatile(object) {
  object[moduleIdSymbol] = volatileModuleId;
}

/**
 * @class
 */
class VcsModule {
  /**
   * @param {VcsModuleConfig} config
   */
  constructor(config) {
    /**
     * @type {string}
     * @private
     */
    this._uuid = config._id || uuidv4();
    /**
     * @type {string}
     */
    this.name = config.name;
    /**
     * @type {string}
     */
    this.description = config.description;
    /**
     * @type {string}
     */
    this.startingViewpointName = config.startingViewpointName;
    /**
     * @type {string}
     */
    this.startingMapName = config.startingMapName;
    /**
     * @type {Projection|undefined}
     */
    this.projection = config.projection ? new Projection(config.projection) : undefined;
    /**
     * @type {VcsModuleConfig}
     * @private
     */
    this._config = config;
  }

  /**
   * @type {string}
   * @readonly
   */
  get _id() {
    return this._uuid;
  }

  /**
   * @type {VcsModuleConfig}
   * @readonly
   */
  get config() {
    return JSON.parse(JSON.stringify(this._config));
  }

  /**
   * Sets the config object by serializing all runtime objects of the current app.
   * @param {import("@vcmap/core").VcsApp} app
   */
  setConfigFromApp(app) {
    this._config = app.serializeModule(this._uuid);
  }


  /**
   * @returns {VcsModuleConfig}
   */
  toJSON() {
    const config = {};
    if (this._config._id) {
      config._id = this._config._id;
    }
    if (this.name) {
      config.name = this.name;
    }
    if (this.description) {
      config.description = this.description;
    }
    if (this.startingViewpointName) {
      config.startingViewpointName = this.startingViewpointName;
    }
    if (this.startingMapName) {
      config.startingMapName = this.startingMapName;
    }
    if (this.projection) {
      config.projection = this.projection.toJSON();
    }
    return config;
  }
}

export default VcsModule;
