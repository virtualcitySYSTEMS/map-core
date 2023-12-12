import { TrustedServers } from '@vcmap-cesium/engine';
import XYZ, { type Options as XYZOptions } from 'ol/source/XYZ.js';
import Tile from 'ol/layer/Tile.js';
import { type Options as TileOptions } from 'ol/layer/BaseTile.js';
import type { Size } from 'ol/size.js';
import { mercatorProjection } from '../../util/projection.js';
import RasterLayerOpenlayersImpl from './rasterLayerOpenlayersImpl.js';
import { TilingScheme } from '../rasterLayer.js';
import { isSameOrigin } from '../../util/urlHelpers.js';
import type { TMSImplementationOptions } from '../tmsLayer.js';
import type OpenlayersMap from '../../map/openlayersMap.js';
import { getTileLoadFunction } from './loadFunctionHelpers.js';

/**
 * TmsLayer implementation for {@link OpenlayersMap}.
 */
class TmsOpenlayersImpl extends RasterLayerOpenlayersImpl {
  static get className(): string {
    return 'TmsOpenlayersImpl';
  }

  format: string;

  tileSize: Size;

  /**
   * @param  map
   * @param  options
   */
  constructor(map: OpenlayersMap, options: TMSImplementationOptions) {
    super(map, options);
    this.format = options.format;
    this.tileSize = options.tileSize;
  }

  getOLLayer(): Tile<XYZ> {
    const sourceOptions: XYZOptions = {
      tileUrlFunction: (tileCoord) => {
        const baseUrl = this.url!.replace(/\/$/, '');
        const y = (1 << tileCoord[0]) - tileCoord[2] - 1;
        return `${baseUrl}/${tileCoord[0]}/${tileCoord[1]}/${y}.${this.format}`;
      },
      tileSize: this.tileSize,
      minZoom: this.minLevel,
      maxZoom: this.maxLevel,
      wrapX: false,
    };
    if (TrustedServers.contains(this.url as string)) {
      sourceOptions.crossOrigin = 'use-credentials';
    } else if (!isSameOrigin(this.url as string)) {
      sourceOptions.crossOrigin = 'anonymous';
    }
    if (this.tilingSchema === TilingScheme.GEOGRAPHIC) {
      sourceOptions.projection = 'EPSG:4326';
    }
    if (this.headers) {
      sourceOptions.tileLoadFunction = getTileLoadFunction(this.headers);
    }

    const tileOptions: TileOptions<XYZ> = {
      source: new XYZ(sourceOptions),
      opacity: this.opacity,
    };
    if (this.extent && this.extent.isValid()) {
      tileOptions.extent =
        this.extent.getCoordinatesInProjection(mercatorProjection);
    }
    return new Tile(tileOptions);
  }
}

export default TmsOpenlayersImpl;
