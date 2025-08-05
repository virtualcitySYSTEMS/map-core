import type GeoTIFFSource from 'ol/source/GeoTIFF.js';
import { ImageryLayer as CesiumImageryLayer } from '@vcmap-cesium/engine';
import RasterLayerCesiumImpl from './rasterLayerCesiumImpl.js';
import COGImageryProvider from './cogImageryProvider.js';
import type { COGLayerImplementationOptions } from '../cogLayer.js';
import type CesiumMap from '../../map/cesiumMap.js';

/**
 * COG Layer implementation for {@link CesiumMap}.
 */
class COGCesiumImpl extends RasterLayerCesiumImpl {
  static get className(): string {
    return 'COGCesiumImpl';
  }

  private _source: GeoTIFFSource;

  constructor(map: CesiumMap, options: COGLayerImplementationOptions) {
    super(map, options);
    this._source = options.source;
  }

  async getCesiumLayer(): Promise<CesiumImageryLayer> {
    const imageryProvider = new COGImageryProvider(this._source);
    const layerOptions = this.getCesiumLayerOptions();
    return Promise.resolve(
      // @ts-expect-error: other impl
      new CesiumImageryLayer(imageryProvider, {
        ...layerOptions,
        rectangle: imageryProvider.tilingScheme.rectangle,
      }),
    );
  }
}

export default COGCesiumImpl;
