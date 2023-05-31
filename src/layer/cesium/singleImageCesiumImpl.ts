import {
  Rectangle,
  SingleTileImageryProvider,
  ImageryLayer,
} from '@vcmap-cesium/engine';
import RasterLayerCesiumImpl from './rasterLayerCesiumImpl.js';
import { wgs84Projection } from '../../util/projection.js';
import type { SingleImageImplementationOptions } from '../singleImageLayer.js';
import type CesiumMap from '../../map/cesiumMap.js';

/**
 * represents a specific Cesium SingleTileImagery Layer class.
 */
class SingleImageCesiumImpl extends RasterLayerCesiumImpl {
  static get className(): string {
    return 'SingleImageCesiumImpl';
  }

  credit: string | undefined;

  constructor(map: CesiumMap, options: SingleImageImplementationOptions) {
    super(map, options);
    this.credit = options.credit;
  }

  getCesiumLayer(): ImageryLayer {
    const options: SingleTileImageryProvider.ConstructorOptions = {
      url: this.url as string,
      credit: this.credit,
    };

    const extent = this.extent?.getCoordinatesInProjection(wgs84Projection);
    if (extent) {
      options.rectangle = Rectangle.fromDegrees(
        extent[0],
        extent[1],
        extent[2],
        extent[3],
      );
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

export default SingleImageCesiumImpl;
