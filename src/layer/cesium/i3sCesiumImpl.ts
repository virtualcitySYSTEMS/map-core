import type {
  Cesium3DTile,
  Cesium3DTileContent,
  SplitDirection,
} from '@vcmap-cesium/engine';
import { I3SDataProvider } from '@vcmap-cesium/engine';
import type BaseCesiumMap from '../../map/baseCesiumMap.js';
import type StyleItem from '../../style/styleItem.js';
import type { AttributeProvider } from '../../featureProvider/abstractAttributeProvider.js';
import type { FeatureLayerImplementation } from '../featureLayer.js';
import type FeatureVisibility from '../featureVisibility.js';
import type GlobalHider from '../globalHider.js';
import type { I3SImplementationOptions } from '../i3sLayer.js';
import LayerImplementation from '../layerImplementation.js';
import { allowPicking, vcsLayerName } from '../layerSymbols.js';
import { getResourceOrUrl } from './resourceHelper.js';
import {
  createCesiumStylingContext,
  createTilesetEventListeners,
} from './cesiumTilesetCesiumImpl.js';

class I3SCesiumImpl
  extends LayerImplementation<BaseCesiumMap>
  implements FeatureLayerImplementation
{
  static get className(): string {
    return 'I3SCesiumImpl';
  }

  data: I3SDataProvider | null;
  i3sOptions: I3SImplementationOptions;
  splitDirection: SplitDirection;
  style: StyleItem;
  featureVisibility: FeatureVisibility;
  globalHider: GlobalHider | undefined;
  allowPicking: boolean;

  attributeProvider?: AttributeProvider;
  private _initializedPromise: Promise<I3SDataProvider> | null = null;
  private _destroyStyle: (() => void) | null = null;
  styleContent: (content: Cesium3DTileContent) => void;
  updateStyle: (style: StyleItem) => void;
  applyStyle: (tile: Cesium3DTile) => void;

  constructor(map: BaseCesiumMap, options: I3SImplementationOptions) {
    super(map, options);
    this.data = null;
    this.i3sOptions = options;
    this.splitDirection = options.splitDirection;
    this.style = options.style;
    this.featureVisibility = options.featureVisibility;
    this.globalHider = options.globalHider;
    this.allowPicking = options.allowPicking;
    this.attributeProvider = options.attributeProvider;

    const stylingContext = createCesiumStylingContext(this);
    this.styleContent = stylingContext.styleContent;
    this.updateStyle = stylingContext.updateStyle;
    this.applyStyle = stylingContext.applyStyle;
    this._destroyStyle = stylingContext.destroy;
  }

  async initialize(): Promise<void> {
    if (!this._initializedPromise) {
      this._initializedPromise = I3SDataProvider.fromUrl(
        getResourceOrUrl(this.url!, this.headers),
        { ...this.i3sOptions, show: false },
      );
      this.data = await this._initializedPromise;

      if (this.isDestroyed) {
        this.data.destroy();
        return;
      }
      this.data[vcsLayerName] = this.name;
      this.data[allowPicking] = this.allowPicking;
      this.data.layers.forEach(({ tileset }) => {
        if (tileset) {
          createTilesetEventListeners(this, tileset);
        }
      });

      this.map.addPrimitiveCollection(this.data);
      await super.initialize();

      if (this.splitDirection) {
        this.data.layers.forEach(({ tileset }) => {
          if (tileset) {
            tileset.splitDirection = this.splitDirection;
          }
        });
      }
      this.updateStyle(this.style);
    }
    await this._initializedPromise;
  }

  async activate(): Promise<void> {
    await super.activate();
    if (this.active && this.data) {
      this.data.show = true;
    }
  }

  deactivate(): void {
    super.deactivate();
    if (this.data) {
      this.data.show = false;
    }
  }

  updateSplitDirection(splitDirection: SplitDirection): void {
    this.splitDirection = splitDirection;
    if (this.data) {
      this.data.layers.forEach(({ tileset }) => {
        if (tileset) {
          tileset.splitDirection = splitDirection;
        }
      });
    }
  }

  destroy(): void {
    if (this.data) {
      if (this.map.initialized) {
        const toRemove = this.data;
        this.map.removePrimitiveCollection(toRemove);
      } else {
        this.data.destroy();
      }
      this.data = null;
    }

    if (this._destroyStyle) {
      this._destroyStyle();
    }

    super.destroy();
  }
}
export default I3SCesiumImpl;
