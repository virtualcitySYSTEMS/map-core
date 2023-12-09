import {
  ImageryLayer as CesiumImageryLayer,
  Rectangle,
  WebMercatorTilingScheme,
  WebMapServiceImageryProvider,
  Resource,
} from '@vcmap-cesium/engine';
import type { Size } from 'ol/size.js';

import RasterLayerCesiumImpl from './rasterLayerCesiumImpl.js';
import { wgs84Projection } from '../../util/projection.js';
import type { WMSImplementationOptions } from '../wmsLayer.js';
import type CesiumMap from '../../map/cesiumMap.js';

/**
 * represents a specific Cesium WmsCesiumImpl Layer class.
 */
class WmsCesiumImpl extends RasterLayerCesiumImpl {
  static get className(): string {
    return 'WmsCesiumImpl';
  }

  parameters: Record<string, string>;

  highResolution: boolean;

  tileSize: Size;

  constructor(map: CesiumMap, options: WMSImplementationOptions) {
    super(map, options);
    this.parameters = options.parameters;
    this.highResolution = options.highResolution;
    this.tileSize = options.tileSize;
  }

  getCesiumLayer(): Promise<CesiumImageryLayer> {
    const parameters = { ...this.parameters };
    if (this.highResolution) {
      parameters.width = String(this.tileSize[0] * 2);
      parameters.height = String(this.tileSize[1] * 2);
    }
    const options: WebMapServiceImageryProvider.ConstructorOptions = {
      url: this.url as string,
      layers: parameters.LAYERS,
      minimumLevel: this.minLevel,
      maximumLevel: this.maxLevel,
      parameters,
      tileWidth: this.tileSize[0],
      tileHeight: this.tileSize[1],
    };

    if (this.extent && this.extent.isValid()) {
      const extent = this.extent.getCoordinatesInProjection(wgs84Projection);
      if (extent) {
        options.rectangle = Rectangle.fromDegrees(
          extent[0],
          extent[1],
          extent[2],
          extent[3],
        );
      }
    }
    if (this.tilingSchema === 'mercator') {
      options.tilingScheme = new WebMercatorTilingScheme();
    }
    if (this.headers) {
      options.url = new Resource({
        url: this.url!,
        headers: this.headers,
      });
      options.url.request;
    }

    const imageryProvider = new WebMapServiceImageryProvider(options);
    const layerOptions = {
      alpha: this.opacity,
      splitDirection: this.splitDirection,
    };
    return Promise.resolve(
      new CesiumImageryLayer(imageryProvider, layerOptions),
    );
  }
}

export default WmsCesiumImpl;
