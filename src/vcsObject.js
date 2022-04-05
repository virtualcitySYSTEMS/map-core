import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '@vcsuite/logger';

/**
 * @typedef {Object} VcsObjectOptions
 * @property {string|undefined} [type] - the type of object, typically only used in configs
 * @property {string|undefined} [name] - name of the object, if not given a uuid is generated, is used for the framework functions getObjectByName
 * @property {Object|undefined} [properties] - key value store for framework independent values per Object
 * @api
 */

/**
 * baseclass for all Objects
 * @class
 * @api stable
 */
class VcsObject {
  static get className() { return 'VcsObject'; }

  /**
   * @param {VcsObjectOptions} options
   */
  constructor(options) {
    /**
     * unique Name
     * @type {string}
     * @api
     * @readonly
     */
    this.name = options.name || uuidv4();


    /**
     * @type {Object}
     * @api
     */
    this.properties = options.properties || {};
  }

  /**
   * @api
   * @readonly
   * @type {string}
   */
  get className() {
    // @ts-ignore
    return this.constructor.className;
  }

  /**
   * @returns {import("@vcsuite/logger").Logger}
   * @api
   */
  getLogger() {
    return getLogger(this.className);
  }

  /**
   * @returns {VcsObjectOptions}
   * @api
   */
  toJSON() {
    const config = {
      type: this.className,
      name: this.name,
    };

    if (Object.keys(this.properties).length > 0) {
      config.properties = { ...this.properties };
    }

    return config;
  }

  /**
   * @api
   */
  destroy() {
    this.isDestroyed = true;
    this.properties = {};
  }
}

export default VcsObject;
