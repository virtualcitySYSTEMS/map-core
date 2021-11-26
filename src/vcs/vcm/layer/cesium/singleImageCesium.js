import { Rectangle, SingleTileImageryProvider, ImageryLayer } from '@vcmap/cesium';
import RasterLayerCesium from './rasterLayerCesium.js';
import { wgs84Projection } from '../../util/projection.js';

/**
 * represents a specific Cesium SingleTileImagery Layer class.
 * @class
 * @export
 * @extends {RasterLayerCesium}
 */
class SingleImageCesium extends RasterLayerCesium {
  static get className() { return 'vcs.vcm.layer.cesium.singleImageLayer'; }

  /**
   * @param {import("@vcmap/core").CesiumMap} map
   * @param {SingleImageImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);
    /** @type {string} */
    this.credit = options.credit;
  }

  /**
   * @returns {import("@vcmap/cesium").ImageryLayer}
   */
  getCesiumLayer() {
    const options = {
      url: this.url,
      credit: this.credit,
    };

    const extent = this.extent.getCoordinatesInProjection(wgs84Projection);
    if (extent) {
      options.rectangle = Rectangle.fromDegrees(extent[0], extent[1], extent[2], extent[3]);
    }

    const imageryProvider = new SingleTileImageryProvider(options);
    const layerOptions = {
      rectangle: options.rectangle,
      alpha: this.opacity,
      defaultAlpha: 1.0,
      splitDirection: this.splitDirection,
    };
    return new ImageryLayer(imageryProvider, layerOptions);
  }
}

export default SingleImageCesium;
