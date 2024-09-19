import { unByKey } from 'ol/Observable.js';
import {
  PrimitiveCollection,
  type Scene,
  type SplitDirection,
} from '@vcmap-cesium/engine';
import type VectorSource from 'ol/source/Vector.js';
import type { EventsKey } from 'ol/events.js';
import type { Feature } from 'ol/index.js';
import { vcsLayerName } from '../layerSymbols.js';
import LayerImplementation from '../layerImplementation.js';
import { synchronizeFeatureVisibilityWithSource } from '../vectorHelpers.js';
import type CesiumMap from '../../map/cesiumMap.js';
import type { FeatureLayerImplementation } from '../featureLayer.js';
import type { VectorImplementationOptions } from '../vectorLayer.js';
import type VectorProperties from '../vectorProperties.js';
import type StyleItem from '../../style/styleItem.js';
import type FeatureVisibility from '../featureVisibility.js';
import type GlobalHider from '../globalHider.js';
import VectorContext from './vectorContext.js';

/**
 * represents a specific vector layer for cesium.
 */
class VectorCesiumImpl
  extends LayerImplementation<CesiumMap>
  implements FeatureLayerImplementation
{
  static get className(): string {
    return 'VectorCesiumImpl';
  }

  vectorProperties: VectorProperties;

  source: VectorSource;

  splitDirection: SplitDirection;

  style: StyleItem;

  featureVisibility: FeatureVisibility;

  private _featureVisibilityListeners: (() => void)[] = [];

  // eslint-disable-next-line class-methods-use-this
  private _removeVectorPropertiesChangeHandler = (): void => {};

  protected _rootCollection: PrimitiveCollection;

  private _olListeners: (EventsKey | EventsKey[])[] = [];

  /**
   * A set of ol.Features to add once the map is back to cesium
   */
  private _featureToAdd: Set<Feature> = new Set();

  protected _context: VectorContext | null = null;

  private _scene: Scene | undefined = undefined;

  globalHider: GlobalHider | undefined;

  constructor(map: CesiumMap, options: VectorImplementationOptions) {
    super(map, options);

    this.vectorProperties = options.vectorProperties;
    this.source = options.source;
    this.splitDirection = options.splitDirection;
    this.style = options.style;
    this.featureVisibility = options.featureVisibility;

    this._rootCollection = new PrimitiveCollection();
    this._rootCollection[vcsLayerName] = options.name;
    this.globalHider = options.globalHider;
  }

  private _addListeners(): void {
    this._olListeners.push(
      this.source.on('addfeature', (event) => {
        this._addFeature(event.feature as Feature).catch(() => {
          this.getLogger().error('failed to convert feature');
        });
      }),
    );

    this._olListeners.push(
      this.source.on('removefeature', (event) => {
        this._removeFeature(event.feature as Feature);
      }),
    );

    this._olListeners.push(
      this.source.on('changefeature', (event) => {
        this._featureChanged(event.feature as Feature).catch(() => {
          this.getLogger().error('failed to convert feature');
        });
      }),
    );

    this._removeVectorPropertiesChangeHandler =
      this.vectorProperties.propertyChanged.addEventListener(
        this.refresh.bind(this),
      );
  }

  protected _setupContext(cesiumMap: CesiumMap): Promise<void> {
    const rootCollection = this._rootCollection;
    this._context = new VectorContext(
      cesiumMap,
      rootCollection,
      this.splitDirection,
    );
    cesiumMap.addPrimitiveCollection(rootCollection);
    return Promise.resolve();
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      this._scene = this.map.getScene();
      this._addListeners();
      this._addFeatures(this.source.getFeatures());
      await this._setupContext(this.map);
    }
    await super.initialize();
    if (this.splitDirection) {
      this.updateSplitDirection(this.splitDirection);
    }
  }

  private _addFeatures(features: Feature[]): void {
    // TODO we should make this non-blocking to better handle larger data sets check in RIWA Impl
    features.forEach((f) => {
      this._addFeature(f).catch((err) => {
        this.getLogger().error('failed to convert feature', f, err);
      });
    });
  }

  /**
   * converts a feature and adds the associated primitives to the collection of primitives
   */
  private async _addFeature(feature: Feature): Promise<void> {
    if (this.active) {
      // XXX cluster check here? or on init?
      await this._context!.addFeature(
        feature,
        this.style.style,
        this.vectorProperties,
        this._scene as Scene,
      );
    } else {
      this._featureToAdd.add(feature);
    }
  }

  /**
   * Forces a complete re-render of all features.
   */
  refresh(): void {
    this._context?.clear();
    this._addFeatures(this.source.getFeatures());
  }

  /**
   * removes the primitive of the specified feature
   */
  private _removeFeature(feature: Feature): void {
    this._context?.removeFeature(feature);
    this._featureToAdd.delete(feature);
  }

  /**
   * called when a features property have changed
   */
  private async _featureChanged(feature: Feature): Promise<void> {
    this._featureToAdd.delete(feature);
    await this._addFeature(feature);
  }

  async activate(): Promise<void> {
    if (!this.active) {
      await super.activate();
      if (this.active) {
        this._addFeatures([...this._featureToAdd]);
        this._featureToAdd.clear();
        this._rootCollection.show = true;
        if (this._featureVisibilityListeners.length === 0) {
          this._featureVisibilityListeners =
            synchronizeFeatureVisibilityWithSource(
              this.featureVisibility,
              this.source,
              this.globalHider as GlobalHider,
            );
        }
      }
    }
  }

  deactivate(): void {
    super.deactivate();
    this._rootCollection.show = false;
    this._featureVisibilityListeners.forEach((cb) => {
      cb();
    });
    this._featureVisibilityListeners = [];
  }

  updateStyle(style: StyleItem, silent?: boolean): void {
    this.style = style;
    if (this.initialized && !silent) {
      const features = this.source.getFeatures().filter((f) => !f.getStyle());
      features.forEach((f) => {
        // eslint-disable-next-line no-void
        void this._featureChanged(f);
      });
    }
  }

  updateSplitDirection(splitDirection: SplitDirection): void {
    this.splitDirection = splitDirection;
    if (this.initialized) {
      this._context?.updateSplitDirection(splitDirection);
    }
  }

  protected _destroyCollection(): void {
    this.map.removePrimitiveCollection(this._rootCollection);
  }

  destroy(): void {
    if (this.initialized) {
      this._context?.destroy();
      this._destroyCollection();
    }
    this._context = null;
    this._scene = undefined;
    this._removeVectorPropertiesChangeHandler();
    this._olListeners.forEach((listener) => {
      unByKey(listener);
    });
    this._olListeners = [];
    this._featureToAdd.clear();
    this._featureVisibilityListeners.forEach((cb) => {
      cb();
    });
    this._featureVisibilityListeners = [];
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.source = null;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.vectorProperties = null;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.featureVisibility = null;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.style = null;
    this.globalHider = undefined;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this._rootCollection = null;
    super.destroy();
  }
}

export default VectorCesiumImpl;
