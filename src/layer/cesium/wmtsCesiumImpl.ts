import {
  Rectangle,
  WebMapTileServiceImageryProvider,
  ImageryLayer as CesiumImageryLayer,
} from '@vcmap-cesium/engine';
import type { Size } from 'ol/size.js';
import RasterLayerCesiumImpl from './rasterLayerCesiumImpl.js';
import { wgs84Projection } from '../../util/projection.js';
import { getTilingScheme } from '../rasterLayer.js';
import type { WMTSImplementationOptions } from '../wmtsLayer.js';
import type CesiumMap from '../../map/cesiumMap.js';
import { getResourceOrUrl } from './resourceHelper.js';

/**
 * represents a specific WmtsLayer Implementation for {@link CesiumMap}.
 */
class WmtsCesiumImpl extends RasterLayerCesiumImpl {
  static get className(): string {
    return 'WmtsCesiumImpl';
  }

  layer: string;

  style: string;

  format: string;

  tileMatrixSetID: string;

  tileSize: Size;

  numberOfLevelZeroTilesX: number;

  numberOfLevelZeroTilesY: number;

  matrixIds: Array<string>;

  constructor(map: CesiumMap, options: WMTSImplementationOptions) {
    super(map, options);

    this.layer = options.layer;
    this.style = options.style;
    this.format = options.format;
    this.tileMatrixSetID = options.tileMatrixSetID;
    this.tileSize = options.tileSize;
    this.numberOfLevelZeroTilesX = options.numberOfLevelZeroTilesX;
    this.numberOfLevelZeroTilesY = options.numberOfLevelZeroTilesY;
    this.matrixIds = options.matrixIds;
  }

  getCesiumLayer(): Promise<CesiumImageryLayer> {
    const currentUrl = this.url as string;
    // This is a bug in Cesium, they cant cope with {Layer} placeholder..
    const url: string =
      currentUrl.indexOf('{Layer}') !== -1
        ? currentUrl.replace('{Layer}', this.layer)
        : currentUrl;

    const extent = this.extent!.getCoordinatesInProjection(wgs84Projection);
    const options: WebMapTileServiceImageryProvider.ConstructorOptions = {
      url: getResourceOrUrl(url, this.headers),
      layer: this.layer,
      style: this.style,
      format: this.format,
      tileMatrixSetID: this.tileMatrixSetID,
      maximumLevel: this.maxLevel,
      rectangle: Rectangle.fromDegrees(
        extent[0],
        extent[1],
        extent[2],
        extent[3],
      ),
      tileWidth: this.tileSize[0],
      tileHeight: this.tileSize[1],
    };

    options.tilingScheme = getTilingScheme({
      tilingSchema: this.tilingSchema,
      numberOfLevelZeroTilesX: this.numberOfLevelZeroTilesX,
      numberOfLevelZeroTilesY: this.numberOfLevelZeroTilesY,
    });

    options.tileMatrixLabels = this.matrixIds;

    const imageryProvider = new WebMapTileServiceImageryProvider(options);
    const layerOptions = this.getCesiumLayerOptions();
    return Promise.resolve(
      new CesiumImageryLayer(imageryProvider, layerOptions),
    );
  }
}

export default WmtsCesiumImpl;
