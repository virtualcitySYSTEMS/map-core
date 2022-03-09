import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

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
const uuidNamespace = uuidv4();

/**
 * @class
 * @export
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
    this._checkSum = uuidv5(JSON.stringify(config), uuidNamespace);
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
