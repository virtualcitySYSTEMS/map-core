import VcsObject from '../vcsObject.js';
import LayerState from './layerState.js';

/**
 * represents an implementation for a Layer for a specific Map
 * @class
 * @export
 * @extends {VcsObject}
 * @abstract
 * @api
 * @template {import("@vcmap/core").VcsMap} T
 */
class LayerImplementation extends VcsObject {
  static get className() { return 'LayerImplementation'; }

  /**
   * @param {T} map
   * @param {LayerImplementationOptions} options
   */
  constructor(map, options) {
    super(options);
    /** @type {T} */
    this.map = map;
    /**
     * @type {string}
     */
    this.url = options.url;
    /**
     * The current active state of the implementation
     * @type {LayerState}
     * @private
     */
    this._state = LayerState.INACTIVE;
    /**
     * @type {boolean}
     * @private
     */
    this._initialized = false;
  }

  /**
   * Whether this implementation has been initialized (e.g. activated at least once)
   * @type {boolean}
   * @readonly
   */
  get initialized() { return this._initialized; }

  /**
   * @type {boolean}
   * @api
   */
  get active() { return this._state === LayerState.ACTIVE; }

  /**
   * @type {boolean}
   * @api
   */
  get loading() { return this._state === LayerState.LOADING; }

  /**
   * interface to initialize this implementation, is used to setup elements which have to be created only once.
   * Has to set this.initialized = true;
   * @returns {Promise<void>}
   */
  async initialize() {
    this._initialized = true;
  }

  /**
   * activates the implementation, if the map is also active. calls initialize (only use internally)
   * Once the promise resolves, the layer can still be inactive, if deactivate was called while initializing the layer.
   * @returns {Promise<void>}
   */
  async activate() {
    if (this.map.active && !this.active) {
      this._state = LayerState.LOADING;
      await this.initialize();
      if (this.loading) {
        this._state = LayerState.ACTIVE;
      }
    }
  }

  /**
   * deactivates the implementation (only use internally)
   */
  deactivate() {
    this._state = LayerState.INACTIVE;
  }

  /**
   * destroys this implementation, after destroying the implementation cannot be used anymore.
   */
  destroy() {
    this._initialized = false;
    this._state = LayerState.INACTIVE;
    this.map = null;
    super.destroy();
  }
}

export default LayerImplementation;
