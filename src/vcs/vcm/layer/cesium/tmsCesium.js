import Rectangle from '@vcmap/cesium/Source/Core/Rectangle.js';
import GeographicTilingScheme from '@vcmap/cesium/Source/Core/GeographicTilingScheme.js';
import TileMapServiceImageryProvider from '@vcmap/cesium/Source/Scene/TileMapServiceImageryProvider.js';
import CesiumImageryLayer from '@vcmap/cesium/Source/Scene/ImageryLayer.js';
import RasterLayerCesium from './rasterLayerCesium.js';
import { wgs84Projection } from '../../util/projection.js';
import { TilingScheme } from '../rasterLayer.js';

/**
 * TMS implementation for {@link vcs.vcm.maps.CesiumMap}.
 * @class
 * @export
 * @extends {vcs.vcm.layer.cesium.RasterLayerCesium}
 * @memberOf vcs.vcm.layer.cesium
 */
class TMSCesium extends RasterLayerCesium {
  static get className() { return 'vcs.vcm.layer.cesium.TMSCesium'; }

  /**
   * @param {vcs.vcm.maps.CesiumMap} map
   * @param {vcs.vcm.layer.TMS.ImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);
    /** @type {string} */
    this.format = options.format;
  }

  /**
   * @returns {Cesium/ImageryLayer}
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

export default TMSCesium;
