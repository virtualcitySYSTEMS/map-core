import {
  OpenStreetMapImageryProvider,
  ImageryLayer as CesiumImageryLayer,
} from '@vcmap-cesium/engine';
import RasterLayerCesiumImpl from './rasterLayerCesiumImpl.js';

/**
 * represents a specific OpenStreetMapLayer layer for cesium.
 * @class
 * @extends {RasterLayerCesiumImpl}
 */
class OpenStreetMapCesiumImpl extends RasterLayerCesiumImpl {
  static get className() {
    return 'OpenStreetMapCesiumImpl';
  }

  /**
   * @inheritDoc
   * @returns {import("@vcmap-cesium/engine").ImageryLayer}
   */
  getCesiumLayer() {
    return new CesiumImageryLayer(
      new OpenStreetMapImageryProvider({ maximumLevel: this.maxLevel }),
      {
        alpha: this.opacity,
        splitDirection: this.splitDirection,
      },
    );
  }
}

export default OpenStreetMapCesiumImpl;
