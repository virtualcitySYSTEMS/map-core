import { PrimitiveCollection, type SplitDirection } from '@vcmap-cesium/engine';
import type VectorSource from 'ol/source/Vector.js';
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
import type { SourceVectorContextSync } from './sourceVectorContextSync.js';
import { createSourceVectorContextSync } from './sourceVectorContextSync.js';

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

  private _rootCollection: PrimitiveCollection;

  private _context: VectorContext | null = null;

  private _sourceVectorContextSync: SourceVectorContextSync | undefined;

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

  async initialize(): Promise<void> {
    if (!this.initialized) {
      this._context = new VectorContext(
        this.map,
        this._rootCollection,
        this.splitDirection,
      );
      this.map.addPrimitiveCollection(this._rootCollection);
      this._sourceVectorContextSync = createSourceVectorContextSync(
        this.source,
        this._context,
        this.map.getScene()!,
        this.style.style,
        this.vectorProperties,
      );
    }
    await super.initialize();
    if (this.splitDirection) {
      this.updateSplitDirection(this.splitDirection);
    }
  }

  /**
   * Forces a complete re-render of all features.
   */
  refresh(): void {
    this._sourceVectorContextSync?.refresh();
  }

  async activate(): Promise<void> {
    if (!this.active) {
      await super.activate();
      if (this.active) {
        this._sourceVectorContextSync?.activate();
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
    this._sourceVectorContextSync?.deactivate();
    this._rootCollection.show = false;
    this._featureVisibilityListeners.forEach((cb) => {
      cb();
    });
    this._featureVisibilityListeners = [];
  }

  updateStyle(style: StyleItem, silent?: boolean): void {
    this.style = style;
    if (this.initialized && !silent) {
      this.source
        .getFeatures()
        .filter((f) => !f.getStyle())
        .forEach((f) => {
          f.changed();
        });
    }
  }

  updateSplitDirection(splitDirection: SplitDirection): void {
    this.splitDirection = splitDirection;
    if (this.initialized) {
      this._context?.updateSplitDirection(splitDirection);
    }
  }

  destroy(): void {
    if (this.initialized) {
      this._sourceVectorContextSync?.destroy();
      this._context?.destroy();
      this.map.removePrimitiveCollection(this._rootCollection);
    }
    this._context = null;
    this._featureVisibilityListeners.forEach((cb) => {
      cb();
    });
    this._featureVisibilityListeners = [];
    super.destroy();
  }
}

export default VectorCesiumImpl;
