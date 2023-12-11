import { TrustedServers } from '@vcmap-cesium/engine';
import { getTopLeft, getWidth } from 'ol/extent.js';
import WMTSTileGrid, {
  type Options as WMTSTileGridOptions,
} from 'ol/tilegrid/WMTS.js';
import Tile from 'ol/layer/Tile.js';
import WMTSSource, { type Options as OLWMTSOptions } from 'ol/source/WMTS.js';
import type { Size } from 'ol/size.js';
import { wgs84Projection, mercatorProjection } from '../../util/projection.js';
import RasterLayerOpenlayersImpl from './rasterLayerOpenlayersImpl.js';
import { TilingScheme } from '../rasterLayer.js';
import { isSameOrigin } from '../../util/urlHelpers.js';
import type { WMTSImplementationOptions } from '../wmtsLayer.js';
import type OpenlayersMap from '../../map/openlayersMap.js';
import { getTileLoadFunction } from './loadFunctionHelpers.js';

/**
 * WmtsLayer implementation for {@link OpenlayersMap}.
 */
class WmtsOpenlayersImpl extends RasterLayerOpenlayersImpl {
  static get className(): string {
    return 'WmtsOpenlayersImpl';
  }

  layer: string;

  style: string;

  format: string;

  tileMatrixSetID: string;

  tileSize: Size;

  numberOfLevelZeroTilesX: number;

  numberOfLevelZeroTilesY: number;

  matrixIds: Array<string>;

  openlayersOptions: Partial<OLWMTSOptions>;

  constructor(map: OpenlayersMap, options: WMTSImplementationOptions) {
    super(map, options);

    this.layer = options.layer;
    this.style = options.style;
    this.format = options.format;
    this.tileMatrixSetID = options.tileMatrixSetID;
    this.tileSize = options.tileSize;
    this.numberOfLevelZeroTilesX = options.numberOfLevelZeroTilesX;
    this.numberOfLevelZeroTilesY = options.numberOfLevelZeroTilesY;
    this.matrixIds = options.matrixIds;
    this.openlayersOptions = options.openlayersOptions;
  }

  getOLLayer(): Tile<WMTSSource> {
    const projection =
      this.tilingSchema === TilingScheme.GEOGRAPHIC
        ? wgs84Projection
        : mercatorProjection;
    const projectionExtent = projection.proj.getExtent();
    let size = getWidth(projectionExtent) / this.tileSize[0];
    if (this.numberOfLevelZeroTilesX > 1) {
      size /= this.numberOfLevelZeroTilesX;
    }
    if (this.tilingSchema === TilingScheme.GEOGRAPHIC) {
      size = getWidth(projectionExtent) / (this.tileSize[0] * 2);
    }

    const maxZoom = this.maxLevel + 1;
    const resolutions = new Array(maxZoom)
      .fill(undefined)
      .map((_value, index) => {
        return size / 2 ** index;
      });

    const extent = this.extent.getCoordinatesInProjection(projection);
    const tileGridOptions: WMTSTileGridOptions = {
      origin: getTopLeft(projectionExtent),
      extent,
      resolutions,
      matrixIds: this.matrixIds,
      tileSize: this.tileSize,
    };

    if (this.numberOfLevelZeroTilesX > 1 || this.numberOfLevelZeroTilesY > 1) {
      const sizes = [];
      let sizeX = this.numberOfLevelZeroTilesX;
      let sizeY = this.numberOfLevelZeroTilesY;
      for (let i = 0; i <= maxZoom; i++) {
        sizes.push([sizeX, sizeY]);
        sizeX *= 2;
        sizeY *= 2;
      }
      tileGridOptions.sizes = sizes;
    }
    const tileGrid = new WMTSTileGrid(tileGridOptions);

    const requestEncoding = this.url!.indexOf('{') >= 0 ? 'REST' : 'KVP';
    const wmtsOptions: OLWMTSOptions = {
      tileGrid,
      requestEncoding,
      layer: this.layer,
      style: this.style,
      format: this.format,
      matrixSet: this.tileMatrixSetID,
      url: this.url,
    };

    if (TrustedServers.contains(this.url as string)) {
      wmtsOptions.crossOrigin = 'use-credentials';
    } else if (!isSameOrigin(this.url as string)) {
      wmtsOptions.crossOrigin = 'anonymous';
    }

    if (this.tilingSchema === TilingScheme.GEOGRAPHIC) {
      wmtsOptions.projection = 'EPSG:4326';
    }
    if (this.headers) {
      wmtsOptions.tileLoadFunction = getTileLoadFunction(this.headers);
    }

    Object.assign(wmtsOptions, this.openlayersOptions);
    return new Tile({
      opacity: this.opacity,
      source: new WMTSSource(wmtsOptions),
    });
  }
}

export default WmtsOpenlayersImpl;
