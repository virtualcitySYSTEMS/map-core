import ImageLayer from 'ol/layer/Image.js';
import { TrustedServers } from '@vcmap-cesium/engine';
import ImageStatic, {
  type Options as ImageStaticOptions,
} from 'ol/source/ImageStatic.js';
import RasterLayerOpenlayersImpl from './rasterLayerOpenlayersImpl.js';
import { wgs84Projection } from '../../util/projection.js';
import { isSameOrigin } from '../../util/urlHelpers.js';
import type { SingleImageImplementationOptions } from '../singleImageLayer.js';
import type OpenlayersMap from '../../map/openlayersMap.js';

/**
 * represents a specific OpenLayers SingleImageLayer Layer class.
 */
class SingleImageOpenlayersImpl extends RasterLayerOpenlayersImpl {
  static get className(): string {
    return 'SingleImageOpenlayersImpl';
  }

  credit: string | undefined;

  constructor(map: OpenlayersMap, options: SingleImageImplementationOptions) {
    super(map, options);
    this.credit = options.credit;
  }

  /**
   * returns the ol Layer
   */
  getOLLayer(): ImageLayer<ImageStatic> {
    const options: ImageStaticOptions = {
      attributions: this.credit,
      url: this.url as string,
      projection: 'EPSG:4326',
      imageExtent: this.extent.getCoordinatesInProjection(wgs84Projection),
    };
    if (TrustedServers.contains(options.url)) {
      options.crossOrigin = 'use-credentials';
    } else if (!isSameOrigin(this.url as string)) {
      options.crossOrigin = 'anonymous';
    }

    if (this.headers) {
      options.imageLoadFunction = (imageWrapper, src): void => {
        const init: RequestInit = {
          headers: this.headers,
        };
        if (TrustedServers.contains(src)) {
          init.credentials = 'include';
        }
        fetch(src, init)
          .then((response) => {
            if (!response.ok) {
              throw new Error('Not 2xx response', { cause: response });
            }
            return response.blob();
          })
          .then((blob) => {
            const url = URL.createObjectURL(blob);
            const image = imageWrapper.getImage() as HTMLImageElement;
            image.src = url;
            image.onload = (): void => {
              URL.revokeObjectURL(url);
            };
          })
          .catch(() => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call,no-underscore-dangle
            imageWrapper.handleImageError_();
          });
      };
    }

    return new ImageLayer({
      source: new ImageStatic(options),
      opacity: this.opacity,
    });
  }
}

export default SingleImageOpenlayersImpl;
