import {
  Rectangle,
  GeographicTilingScheme,
  TileMapServiceImageryProvider,
  ImageryLayer as CesiumImageryLayer,
} from '@vcmap-cesium/engine';
import RasterLayerCesiumImpl from './rasterLayerCesiumImpl.js';
import { wgs84Projection } from '../../util/projection.js';
import { TilingScheme } from '../rasterLayer.js';
import type CesiumMap from '../../map/cesiumMap.js';
import type { TMSImplementationOptions } from '../tmsLayer.js';
import { getResourceOrUrl } from './resourceHelper.js';

/**
 * TmsLayer implementation for {@link CesiumMap}.
 */
class TmsCesiumImpl extends RasterLayerCesiumImpl {
  static get className(): string {
    return 'TmsCesiumImpl';
  }

  format: string;

  constructor(map: CesiumMap, options: TMSImplementationOptions) {
    super(map, options);
    this.format = options.format;
  }

  async getCesiumLayer(): Promise<CesiumImageryLayer> {
    const options: TileMapServiceImageryProvider.ConstructorOptions = {
      fileExtension: this.format,
      maximumLevel: this.maxLevel,
      minimumLevel: this.minLevel,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      show: false,
    };

    if (this.extent && this.extent.isValid()) {
      const extent = this.extent.getCoordinatesInProjection(wgs84Projection);
      options.rectangle = Rectangle.fromDegrees(
        extent[0],
        extent[1],
        extent[2],
        extent[3],
      );
    }
    if (this.tilingSchema === TilingScheme.GEOGRAPHIC) {
      options.tilingScheme = new GeographicTilingScheme();
    }
    const imageryProvider = await TileMapServiceImageryProvider.fromUrl(
      getResourceOrUrl(this.url!, this.headers),
      options,
    );
    const layerOptions = {
      alpha: this.opacity,
      splitDirection: this.splitDirection,
    };

    return new CesiumImageryLayer(imageryProvider, layerOptions);
  }
}

export default TmsCesiumImpl;
