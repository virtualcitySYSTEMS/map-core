import Tile from 'ol/layer/Tile.js';
import type { Size } from 'ol/size.js';
import type TileWMS from 'ol/source/TileWMS.js';
import ImageWMS from 'ol/source/ImageWMS.js';
import ImageLayer from 'ol/layer/Image.js';
import RasterLayerOpenlayersImpl from './rasterLayerOpenlayersImpl.js';
import { getImageWMSSource, getWMSSource } from '../wmsHelpers.js';
import type { WMSImplementationOptions } from '../wmsLayer.js';
import type OpenlayersMap from '../../map/openlayersMap.js';
import { mercatorProjection } from '../../util/projection.js';

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

  singleImage2d: boolean;

  constructor(map: OpenlayersMap, options: WMSImplementationOptions) {
    super(map, options);
    this.parameters = options.parameters;
    this.version = options.version;
    this.tileSize = options.tileSize;
    this.singleImage2d = options.singleImage2d;
  }

  getOLLayer(): Tile<TileWMS> | ImageLayer<ImageWMS> {
    if (this.singleImage2d) {
      return new ImageLayer({
        extent: this.extent.getCoordinatesInProjection(mercatorProjection),
        visible: false,
        source: getImageWMSSource({
          url: this.url as string,
          parameters: this.parameters,
          tilingSchema: this.tilingSchema,
          version: this.version,
          headers: this.headers,
        }),
        opacity: this.opacity,
        minZoom: this.minRenderingLevel,
        maxZoom: this.maxRenderingLevel,
      });
    }
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
      minZoom: this.minRenderingLevel,
      maxZoom: this.maxRenderingLevel,
    });
  }
}

export default WmsOpenlayersImpl;
