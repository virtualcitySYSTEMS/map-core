import { v5 as uuidv5 } from 'uuid';

/**
 * @typedef {Object} VcsAppConfig
 * @property {string|undefined} [id]
 * @property {Array<LayerOptions>} [layers]
 * @property {Array<VcsMapOptions>} [maps]
 * @property {Array<StyleItemOptions>} [styles]
 * @property {Array<ViewPointOptions>} [viewpoints]
 * @property {string} [startingViewPointName]
 * @property {string} [startingMapName]
 * @property {ProjectionOptions} [projection]
 * @property {Array<{ name: string, items: Array<Object> }>} [categories]
 * @property {Array<ObliqueCollectionOptions>} [obliqueCollections]
 */

/**
 * @type {string}
 */
const uniqueNamespace = '9c27cc2d-552f-4637-9194-09329ed4c1dc';

/**
 * @class
 */
class Context {
  /**
   * @param {VcsAppConfig} config
   */
  constructor(config) {
    /**
     * @type {VcsAppConfig}
     * @private
     */
    this._config = config;
    /**
     * @type {string}
     * @private
     */
    this._checkSum = uuidv5(JSON.stringify(config), uniqueNamespace);
    /**
     * @type {string}
     * @private
     */
    this._id = config.id || this._checkSum;
  }

  /**
   * @type {string}
   * @readonly
   */
  get id() {
    return this._id;
  }

  /**
   * @type {string}
   * @readonly
   */
  get checkSum() {
    return this._checkSum;
  }

  /**
   * @type {VcsAppConfig}
   * @readonly
   */
  get config() {
    return JSON.parse(JSON.stringify(this._config));
  }
}

export default Context;
