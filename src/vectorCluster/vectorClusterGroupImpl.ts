import { StyleFunction } from 'ol/style/Style.js';
import type { VectorClusterGroupImplementationOptions } from './vectorClusterGroup.js';
import VcsObject from '../vcsObject.js';
import LayerState from '../layer/layerState.js';
import VectorProperties from '../layer/vectorProperties.js';
import ClusterEnhancedVectorSource from '../ol/source/ClusterEnhancedVectorSource.js';
import { synchronizeFeatureVisibilityWithSource } from '../layer/vectorHelpers.js';
import type GlobalHider from '../layer/globalHider.js';
import FeatureVisibility from '../layer/featureVisibility.js';
import VcsMap from '../map/vcsMap.js';

/**
 * Clusters for vector layers containing point features only
 */
export default class VectorClusterGroupImpl<
  M extends VcsMap,
> extends VcsObject {
  static get className(): string {
    return 'VectorClusterCesiumImpl';
  }

  private _map: M | undefined;

  private _state = LayerState.INACTIVE;

  private _initialized = false;

  style: StyleFunction;

  protected _source: ClusterEnhancedVectorSource;

  private _featureVisibilityListeners = [] as (() => void)[];

  protected _featureVisibility: FeatureVisibility;

  protected _globalHider: GlobalHider | undefined;

  vectorProperties: VectorProperties;

  constructor(map: M, options: VectorClusterGroupImplementationOptions) {
    super(options);
    this._map = map;

    this.style = options.style;
    this._source = options.source;
    this.vectorProperties = options.vectorProperties;
    this._featureVisibility = options.featureVisibility;
    this._globalHider = options.globalHider;
  }

  get map(): M {
    if (!this._map) {
      throw new Error('Trying to access uninitialized VectorClusterGroupImpl');
    }
    return this._map;
  }

  get active(): boolean {
    return this._state === LayerState.ACTIVE;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  initialize(): Promise<void> {
    this._initialized = true;
    return Promise.resolve();
  }

  async activate(): Promise<void> {
    if (this.map.active && !this.active) {
      this._state = LayerState.LOADING;
      await this.initialize();
      if (this._state === LayerState.LOADING) {
        this._state = LayerState.ACTIVE;
        if (this._featureVisibilityListeners.length === 0) {
          this._featureVisibilityListeners =
            synchronizeFeatureVisibilityWithSource(
              this._featureVisibility,
              this._source,
              this._globalHider!,
            );
        }
      }
    }
  }

  deactivate(): void {
    this._state = LayerState.INACTIVE;
    this._featureVisibilityListeners.forEach((cb) => {
      cb();
    });
    this._featureVisibilityListeners = [];
  }

  destroy(): void {
    this._featureVisibilityListeners.forEach((cb) => {
      cb();
    });
    this._featureVisibilityListeners = [];
    this._initialized = false;
    this._state = LayerState.INACTIVE;
    this._map = undefined;
    super.destroy();
  }
}
