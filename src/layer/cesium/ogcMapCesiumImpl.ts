import {
  Rectangle,
  GeographicTilingScheme,
  UrlTemplateImageryProvider,
  ImageryLayer as CesiumImageryLayer,
} from '@vcmap-cesium/engine';
import type { Size } from 'ol/size.js';
import type { OGCParameters } from '../ogcHelpers.js';
import RasterLayerCesiumImpl from './rasterLayerCesiumImpl.js';
import { wgs84Projection } from '../../util/projection.js';
import { TilingScheme } from '../rasterLayer.js';
import type BaseCesiumMap from '../../map/baseCesiumMap.js';
import type { OGCMapImplementationOptions } from '../ogcMapLayer.js';
import { getResourceOrUrl } from './resourceHelper.js';
import { CRS_3857, CRS_84, getOgcMapUrl } from '../ogcMapHelpers.js';

/**
 * OGCMapLayer implementation for {@link CesiumMap}.
 */
class OGCMapCesiumImpl extends RasterLayerCesiumImpl {
  static get className(): string {
    return 'OGCMapCesiumImpl';
  }

  tileSize: Size;

  styleId: string | undefined;

  parameters: OGCParameters;

  constructor(map: BaseCesiumMap, options: OGCMapImplementationOptions) {
    super(map, options);
    this.tileSize = options.tileSize;
    this.styleId = options.styleId;
    this.parameters = options.parameters;
  }

  private _getTemplateUrl(isGeographic: boolean): string {
    const crs = isGeographic ? CRS_84 : CRS_3857;
    const mapUrl = getOgcMapUrl(this.url!, {
      parameters: this.parameters,
      styleId: this.styleId,
    });
    mapUrl.searchParams.set('crs', crs);
    mapUrl.searchParams.set('bbox-crs', crs);
    const bbox = isGeographic
      ? '{westDegrees},{southDegrees},{eastDegrees},{northDegrees}'
      : '{westProjected},{southProjected},{eastProjected},{northProjected}';
    mapUrl.searchParams.set('bbox', bbox);
    mapUrl.searchParams.set('width', '{width}');
    mapUrl.searchParams.set('height', '{height}');

    return mapUrl.toString();
  }

  getCesiumLayer(): Promise<CesiumImageryLayer> {
    const isGeographic = this.tilingSchema === TilingScheme.GEOGRAPHIC;
    const options: UrlTemplateImageryProvider.ConstructorOptions = {
      url: getResourceOrUrl(this._getTemplateUrl(isGeographic), this.headers),
      tileWidth: this.tileSize[0],
      tileHeight: this.tileSize[1],
      minimumLevel: this.minLevel,
      maximumLevel: this.maxLevel,
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
    if (isGeographic) {
      options.tilingScheme = new GeographicTilingScheme();
    }

    const imageryProvider = new UrlTemplateImageryProvider(options);
    const layerOptions = this.getCesiumLayerOptions();
    return Promise.resolve(
      new CesiumImageryLayer(imageryProvider, layerOptions),
    );
  }
}

export default OGCMapCesiumImpl;
