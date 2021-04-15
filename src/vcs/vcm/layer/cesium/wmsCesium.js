import CesiumImageryLayer from 'cesium/Source/Scene/ImageryLayer.js';
import Rectangle from 'cesium/Source/Core/Rectangle.js';
import WebMercatorTilingScheme from 'cesium/Source/Core/WebMercatorTilingScheme.js';
import WebMapServiceImageryProvider from 'cesium/Source/Scene/WebMapServiceImageryProvider.js';

import RasterLayerCesium from './rasterLayerCesium.js';
import { wgs84Projection } from '../../util/projection.js';

/**
 * represents a specific Cesium WMSCesium Layer class.
 * @class
 * @export
 * @extends {vcs.vcm.layer.cesium.RasterLayerCesium}
 * @memberOf vcs.vcm.layer.cesium
 */
class WMSCesium extends RasterLayerCesium {
  static get className() { return 'vcs.vcm.layer.cesium.WMSCesium'; }

  /**
   * @param {vcs.vcm.maps.CesiumMap} map
   * @param {vcs.vcm.layer.WMS.ImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);
    /**
     * @type {Object<string, *>}
     */
    this.parameters = options.parameters;
    /**
     * @type {boolean}
     */
    this.highResolution = options.highResolution;
    /**
     * @type {ol/Size}
     */
    this.tileSize = options.tileSize;
  }

  getCesiumLayer() {
    const parameters = { ...this.parameters };
    if (this.highResolution) {
      parameters.width = this.tileSize[0] * 2;
      parameters.height = this.tileSize[1] * 2;
    }
    const options = {
      url: this.url,
      layers: parameters.LAYERS,
      minimumLevel: this.minLevel,
      maximumLevel: this.maxLevel,
      show: false,
      parameters,
      tileWidth: this.tileSize[0],
      tileHeight: this.tileSize[1],
    };

    if (this.extent && this.extent.isValid()) {
      const extent = this.extent.getCoordinatesInProjection(wgs84Projection);
      if (extent) {
        options.rectangle = Rectangle.fromDegrees(extent[0], extent[1], extent[2], extent[3]);
      }
    }
    if (this.tilingSchema === 'mercator') {
      options.tilingScheme = new WebMercatorTilingScheme();
    }

    const imageryProvider = new WebMapServiceImageryProvider(options);
    const layerOptions = {
      alpha: this.opacity,
      splitDirection: this.splitDirection,
    };
    return new CesiumImageryLayer(imageryProvider, layerOptions);
  }
}

export default WMSCesium;
