import Tile from 'ol/layer/Tile.js';
import type { Size } from 'ol/size.js';
import type TileWMS from 'ol/source/TileWMS.js';
import RasterLayerOpenlayersImpl from './rasterLayerOpenlayersImpl.js';
import { getWMSSource } from '../wmsHelpers.js';
import type { WMSImplementationOptions } from '../wmsLayer.js';
import type OpenlayersMap from '../../map/openlayersMap.js';

/**
 * represents a specific Cesium WmsOpenlayersImpl Layer class.
 */
class WmsOpenlayersImpl extends RasterLayerOpenlayersImpl {
  static get className(): string {
    return 'WmsOpenlayersImpl';
  }

  parameters: Record<string, string>;

  version: string;

  tileSize: Size;

  constructor(map: OpenlayersMap, options: WMSImplementationOptions) {
    super(map, options);
    this.parameters = options.parameters;
    this.version = options.version;
    this.tileSize = options.tileSize;
  }

  getOLLayer(): Tile<TileWMS> {
    return new Tile({
      visible: false,
      source: getWMSSource({
        url: this.url as string,
        parameters: this.parameters,
        version: this.version,
        extent: this.extent,
        tileSize: this.tileSize,
        minLevel: this.minLevel,
        maxLevel: this.maxLevel,
        tilingSchema: this.tilingSchema,
        headers: this.headers,
      }),
      opacity: this.opacity,
    });
  }
}

export default WmsOpenlayersImpl;
