import {
  OpenStreetMapImageryProvider,
  ImageryLayer as CesiumImageryLayer,
} from '@vcmap-cesium/engine';
import RasterLayerCesiumImpl from './rasterLayerCesiumImpl.js';

/**
 * represents a specific OpenStreetMapLayer layer for cesium.
 */
class OpenStreetMapCesiumImpl extends RasterLayerCesiumImpl {
  static get className(): string {
    return 'OpenStreetMapCesiumImpl';
  }

  getCesiumLayer(): Promise<CesiumImageryLayer> {
    return Promise.resolve(
      new CesiumImageryLayer(
        new OpenStreetMapImageryProvider({ maximumLevel: this.maxLevel }),
        {
          alpha: this.opacity,
          splitDirection: this.splitDirection,
        },
      ),
    );
  }
}

export default OpenStreetMapCesiumImpl;
