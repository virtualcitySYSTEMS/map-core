import type VectorSource from 'ol/source/Vector.js';
import OLVectorLayer from 'ol/layer/Vector.js';
import type { SplitDirection } from '@vcmap-cesium/engine';
import LayerObliqueImpl from './layerObliqueImpl.js';
import { synchronizeFeatureVisibilityWithSource } from '../vectorHelpers.js';
import type { FeatureLayerImplementation } from '../featureLayer.js';
import type { VectorImplementationOptions } from '../vectorLayer.js';
import type ObliqueMap from '../../map/obliqueMap.js';
import type GlobalHider from '../globalHider.js';
import type StyleItem from '../../style/styleItem.js';
import type FeatureVisibility from '../featureVisibility.js';
import type { SourceObliqueSync } from './sourceObliqueSync.js';
import { createSourceObliqueSync } from './sourceObliqueSync.js';

/**
 * represents a specific vector layer for oblique.
 */
class VectorObliqueImpl
  extends LayerObliqueImpl
  implements FeatureLayerImplementation
{
  static get className(): string {
    return 'VectorObliqueImpl';
  }

  obliqueSource: VectorSource;

  private _featureVisibilityListeners: (() => void)[] = [];

  globalHider: GlobalHider;

  source: VectorSource;

  style: StyleItem;

  featureVisibility: FeatureVisibility;

  olLayer: OLVectorLayer | null = null;

  private _sourceObliqueSync: SourceObliqueSync;

  constructor(map: ObliqueMap, options: VectorImplementationOptions) {
    super(map, options);

    this._sourceObliqueSync = createSourceObliqueSync(options.source, map);
    this.obliqueSource = this._sourceObliqueSync.obliqueSource;
    this.globalHider = options.globalHider as GlobalHider;
    this.source = options.source;
    this.style = options.style;
    this.featureVisibility = options.featureVisibility;
  }

  getOLLayer(): OLVectorLayer {
    return new OLVectorLayer({
      visible: false,
      source: this.obliqueSource,
      style: this.style.style,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateStyle(style: StyleItem, _silent?: boolean): void {
    this.style = style;
    if (this.initialized && this.olLayer) {
      this.olLayer.setStyle(this.style.style);
    }
  }

  // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-unused-vars
  updateSplitDirection(_splitDirection: SplitDirection): void {}

  async activate(): Promise<void> {
    if (!this.active) {
      await super.activate();
      if (this.active) {
        this.olLayer!.setVisible(true);
        if (this._featureVisibilityListeners.length === 0) {
          this._featureVisibilityListeners =
            synchronizeFeatureVisibilityWithSource(
              this.featureVisibility,
              this.source,
              this.globalHider,
            );
        }
        this._sourceObliqueSync.activate();
      }
    }
  }

  deactivate(): void {
    super.deactivate();
    if (this.olLayer) {
      this.olLayer.setVisible(false);
    }

    this._featureVisibilityListeners.forEach((cb) => {
      cb();
    });
    this._featureVisibilityListeners = [];

    this._sourceObliqueSync.deactivate();
  }

  destroy(): void {
    if (this.olLayer) {
      this.map.removeOLLayer(this.olLayer);
    }
    this.olLayer = null;

    this._sourceObliqueSync.destroy();
    super.destroy();
  }
}

export default VectorObliqueImpl;
