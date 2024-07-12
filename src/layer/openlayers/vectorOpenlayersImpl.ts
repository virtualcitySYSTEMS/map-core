import type VectorSource from 'ol/source/Vector.js';
import OLVectorLayer from 'ol/layer/Vector.js';
import LayerOpenlayersImpl from './layerOpenlayersImpl.js';
import { synchronizeFeatureVisibilityWithSource } from '../vectorHelpers.js';
import type { FeatureLayerImplementation } from '../featureLayer.js';
import type { VectorImplementationOptions } from '../vectorLayer.js';
import type StyleItem from '../../style/styleItem.js';
import type FeatureVisibility from '../featureVisibility.js';
import type GlobalHider from '../globalHider.js';
import type OpenlayersMap from '../../map/openlayersMap.js';

/**
 * represents a specific vectorlayer for openlayers.
 */
class VectorOpenlayersImpl
  extends LayerOpenlayersImpl
  implements FeatureLayerImplementation
{
  static get className(): string {
    return 'VectorOpenlayersImpl';
  }

  source: VectorSource;

  style: StyleItem;

  maxResolution: number | undefined;

  minResolution: number | undefined;

  featureVisibility: FeatureVisibility;

  private _featureVisibilityListeners: (() => void)[] = [];

  olLayer: OLVectorLayer | null = null;

  globalHider: GlobalHider;

  constructor(map: OpenlayersMap, options: VectorImplementationOptions) {
    super(map, options);
    this.source = options.source;
    this.style = options.style;
    this.maxResolution = options.maxResolution;
    this.minResolution = options.minResolution;
    this.featureVisibility = options.featureVisibility;
    this.globalHider = options.globalHider as GlobalHider;
  }

  // eslint-disable-next-line no-unused-vars
  updateStyle(style: StyleItem, _silent?: boolean): void {
    this.style = style;
    if (this.initialized) {
      this.olLayer!.setStyle(this.style.style);
    }
  }

  getOLLayer(): OLVectorLayer {
    const olLayer = new OLVectorLayer({
      visible: false,
      source: this.source,
      style: this.style.style,
    });

    if (this.minResolution) {
      olLayer.setMinResolution(this.minResolution);
    }
    if (this.maxResolution) {
      olLayer.setMaxResolution(this.maxResolution);
    }
    return olLayer;
  }

  async activate(): Promise<void> {
    if (!this.active) {
      await super.activate();
      if (this.active) {
        if (this._featureVisibilityListeners.length === 0) {
          this._featureVisibilityListeners =
            synchronizeFeatureVisibilityWithSource(
              this.featureVisibility,
              this.source,
              this.globalHider,
            );
        }
      }
    }
  }

  deactivate(): void {
    super.deactivate();
    this._featureVisibilityListeners.forEach((cb) => {
      cb();
    });
    this._featureVisibilityListeners = [];
  }

  setVisibility(visibility: boolean): void {
    if (this.initialized) {
      this.olLayer!.setVisible(visibility);
    }
  }

  destroy(): void {
    this._featureVisibilityListeners.forEach((cb) => {
      cb();
    });
    this._featureVisibilityListeners = [];
    super.destroy();
  }
}

export default VectorOpenlayersImpl;
