import { Rectangle, GeographicTilingScheme, TileMapServiceImageryProvider, ImageryLayer as CesiumImageryLayer } from '@vcmap/cesium';
import RasterLayerCesiumImpl from './rasterLayerCesiumImpl.js';
import { wgs84Projection } from '../../util/projection.js';
import { TilingScheme } from '../rasterLayer.js';

/**
 * TmsLayer implementation for {@link CesiumMap}.
 * @class
 * @export
 * @extends {RasterLayerCesiumImpl}
 */
class TmsCesiumImpl extends RasterLayerCesiumImpl {
  static get className() { return 'TmsCesiumImpl'; }

  /**
   * @param {import("@vcmap/core").CesiumMap} map
   * @param {TMSImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);
    /** @type {string} */
    this.format = options.format;
  }

  /**
   * @returns {import("@vcmap/cesium").ImageryLayer}
   */
  getCesiumLayer() {
    const options = {
      url: this.url,
      fileExtension: this.format,
      maximumLevel: this.maxLevel,
      minimumLevel: this.minLevel,
      show: false,
    };

    if (this.extent && this.extent.isValid()) {
      const extent = this.extent.getCoordinatesInProjection(wgs84Projection);
      options.rectangle = Rectangle.fromDegrees(extent[0], extent[1], extent[2], extent[3]);
    }
    if (this.tilingSchema === TilingScheme.GEOGRAPHIC) {
      options.tilingScheme = new GeographicTilingScheme();
    }
    const imageryProvider = new TileMapServiceImageryProvider(options);
    const layerOptions = {
      alpha: this.opacity,
      splitDirection: this.splitDirection,
    };

    return new CesiumImageryLayer(imageryProvider, layerOptions);
  }
}

export default TmsCesiumImpl;
