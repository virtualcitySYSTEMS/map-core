import type { ImageryLayer, SplitDirection } from '@vcmap-cesium/engine';
import { vcsLayerName } from '../layerSymbols.js';
import LayerImplementation from '../layerImplementation.js';
import type CesiumMap from '../../map/cesiumMap.js';
import type {
  RasterLayerImplementation,
  RasterLayerImplementationOptions,
  TilingScheme,
} from '../rasterLayer.js';
import type Extent from '../../util/extent.js';

class RasterLayerCesiumImpl
  extends LayerImplementation<CesiumMap>
  implements RasterLayerImplementation
{
  static get className(): string {
    return 'RasterLayerCesiumImpl';
  }

  cesiumLayer: ImageryLayer | null = null;

  splitDirection: SplitDirection;

  minLevel: number;

  maxLevel: number;

  extent: Extent | undefined;

  opacity: number;

  tilingSchema: TilingScheme;

  constructor(map: CesiumMap, options: RasterLayerImplementationOptions) {
    super(map, options);
    this.splitDirection = options.splitDirection;
    this.minLevel = options.minLevel;
    this.maxLevel = options.maxLevel;
    this.extent = options.extent;
    this.opacity = options.opacity;
    this.tilingSchema = options.tilingSchema;
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      this.cesiumLayer = await this.getCesiumLayer();
      if (this.isDestroyed) {
        this.cesiumLayer.destroy();
        return Promise.resolve();
      }
      this.cesiumLayer[vcsLayerName] = this.name;
      this.cesiumLayer.show = false;
      this.map.addImageryLayer(this.cesiumLayer);
    }
    return super.initialize();
  }

  updateSplitDirection(splitDirection: SplitDirection): void {
    this.splitDirection = splitDirection;
    if (this.initialized && this.cesiumLayer) {
      this.cesiumLayer.splitDirection = splitDirection;
    }
  }

  // eslint-disable-next-line class-methods-use-this
  getCesiumLayer(): Promise<ImageryLayer> {
    throw new Error('implementation error');
  }

  async activate(): Promise<void> {
    await super.activate();
    if (this.active && this.cesiumLayer) {
      this.cesiumLayer.show = true;
    }
  }

  deactivate(): void {
    super.deactivate();
    if (this.cesiumLayer) {
      this.cesiumLayer.show = false;
    }
  }

  updateOpacity(opacity: number): void {
    this.opacity = opacity;
    if (this.initialized && this.cesiumLayer) {
      this.cesiumLayer.alpha = opacity;
    }
  }

  destroy(): void {
    if (this.cesiumLayer) {
      this.map.removeImageryLayer(this.cesiumLayer);
    }
    this.cesiumLayer = null;
    super.destroy();
  }
}

export default RasterLayerCesiumImpl;
