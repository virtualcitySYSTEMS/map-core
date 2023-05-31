import VcsObject from '../vcsObject.js';
import LayerState from './layerState.js';
import type VcsMap from '../map/vcsMap.js';
import type { LayerImplementationOptions } from './layer.js';

/**
 * represents an implementation for a Layer for a specific Map
 */
class LayerImplementation<M extends VcsMap> extends VcsObject {
  static get className(): string {
    return 'LayerImplementation';
  }

  private _map: M | undefined;

  url: string | undefined;

  protected _state: LayerState = LayerState.INACTIVE;

  private _initialized = false;

  constructor(map: M, options: LayerImplementationOptions) {
    super(options);
    this._map = map;
    this.url = options.url;
  }

  get map(): M {
    if (!this._map) {
      throw new Error('Accessing destroyed implementation');
    }
    return this._map;
  }

  /**
   * Whether this implementation has been initialized (e.g. activated at least once)
   */
  get initialized(): boolean {
    return this._initialized;
  }

  get active(): boolean {
    return this._state === LayerState.ACTIVE;
  }

  get loading(): boolean {
    return this._state === LayerState.LOADING;
  }

  /**
   * interface to initialize this implementation, is used to setup elements which have to be created only once.
   * Has to set this.initialized = true;
   */
  initialize(): Promise<void> {
    this._initialized = true;
    return Promise.resolve();
  }

  /**
   * activates the implementation, if the map is also active. calls initialize (only use internally)
   * Once the promise resolves, the layer can still be inactive, if deactivate was called while initializing the layer.
   */
  async activate(): Promise<void> {
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
  deactivate(): void {
    this._state = LayerState.INACTIVE;
  }

  /**
   * destroys this implementation, after destroying the implementation cannot be used anymore.
   */
  destroy(): void {
    this._initialized = false;
    this._state = LayerState.INACTIVE;
    this._map = undefined;
    super.destroy();
  }
}

export default LayerImplementation;
