import { OpenStreetMapImageryProvider, ImageryLayer as CesiumImageryLayer } from '@vcmap/cesium';
import RasterLayerCesiumImpl from './rasterLayerCesiumImpl.js';

/**
 * represents a specific OpenStreetMapLayer layer for cesium.
 * @class
 * @export
 * @extends {RasterLayerCesiumImpl}
 */
class OpenStreetMapCesiumImpl extends RasterLayerCesiumImpl {
  static get className() { return 'OpenStreetMapCesiumImpl'; }

  /**
   * @inheritDoc
   * @returns {import("@vcmap/cesium").ImageryLayer}
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
