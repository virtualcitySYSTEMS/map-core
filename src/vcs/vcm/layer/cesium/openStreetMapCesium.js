import { OpenStreetMapImageryProvider, ImageryLayer as CesiumImageryLayer } from '@vcmap/cesium';
import RasterLayerCesium from './rasterLayerCesium.js';

/**
 * represents a specific OpenStreetMap layer for cesium.
 * @class
 * @export
 * @extends {vcs.vcm.layer.cesium.RasterLayerCesium}
 * @memberOf vcs.vcm.layer.cesium
 */
class OpenStreetMapCesium extends RasterLayerCesium {
  static get className() { return 'vcs.vcm.layer.cesium.OpenStreetMapCesium'; }

  /**
   * @inheritDoc
   * @returns {Cesium/ImageryLayer}
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


export default OpenStreetMapCesium;
