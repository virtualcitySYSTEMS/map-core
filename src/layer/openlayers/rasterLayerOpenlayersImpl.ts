import LayerOpenlayersImpl from './layerOpenlayersImpl.js';
import type {
  RasterLayerImplementation,
  RasterLayerImplementationOptions,
  TilingScheme,
} from '../rasterLayer.js';
import type Extent from '../../util/extent.js';
import type OpenlayersMap from '../../map/openlayersMap.js';

class RasterLayerOpenlayersImpl
  extends LayerOpenlayersImpl
  implements RasterLayerImplementation
{
  static get className(): string {
    return 'RasterLayerOpenlayersImpl';
  }

  minLevel: number;

  maxLevel: number;

  tilingSchema: TilingScheme;

  extent: Extent;

  opacity: number;

  constructor(map: OpenlayersMap, options: RasterLayerImplementationOptions) {
    super(map, options);
    this.minLevel = options.minLevel;
    this.maxLevel = options.maxLevel;
    this.tilingSchema = options.tilingSchema;
    this.extent = options.extent as Extent;
    this.opacity = options.opacity;
  }

  updateOpacity(opacity: number): void {
    this.opacity = opacity;
    if (this.initialized) {
      this.olLayer!.setOpacity(this.opacity);
    }
  }
}

export default RasterLayerOpenlayersImpl;
