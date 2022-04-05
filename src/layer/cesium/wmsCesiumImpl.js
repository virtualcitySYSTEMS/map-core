import { ImageryLayer as CesiumImageryLayer, Rectangle, WebMercatorTilingScheme, WebMapServiceImageryProvider } from '@vcmap/cesium';

import RasterLayerCesiumImpl from './rasterLayerCesiumImpl.js';
import { wgs84Projection } from '../../util/projection.js';

/**
 * represents a specific Cesium WmsCesiumImpl Layer class.
 * @class
 * @export
 * @extends {RasterLayerCesiumImpl}
 */
class WmsCesiumImpl extends RasterLayerCesiumImpl {
  static get className() { return 'WmsCesiumImpl'; }

  /**
   * @param {import("@vcmap/core").CesiumMap} map
   * @param {WMSImplementationOptions} options
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
     * @type {import("ol/size").Size}
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

export default WmsCesiumImpl;
