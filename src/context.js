import { v5 as uuidv5, v4 as uuidv4 } from 'uuid';
import { contextIdSymbol } from './vcsAppContextHelpers.js';

/**
 * @typedef {Object} VcsAppConfig
 * @property {string|undefined} [id]
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
 * @type {string}
 */
const uniqueNamespace = '9c27cc2d-552f-4637-9194-09329ed4c1dc';

/**
 * The id of the volatile context. Objects with this id shall never be serialized.
 * @type {string}
 */
export const volatileContextId = uuidv4();

/**
 * This marks an object as "volatile". This ensures, that an object added to the {@see VcsApp}
 * will never be serialized into a context, regardless of the current dynamic context. Typical use case is a scratch layer
 * which represents temporary features.
 * @param {import("@vcmap/core").VcsObject|Object} object - the object to mark as volatile
 */
export function markVolatile(object) {
  object[contextIdSymbol] = volatileContextId;
}

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
