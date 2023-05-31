import ImageLayer from 'ol/layer/Image.js';
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
    if (!isSameOrigin(this.url as string)) {
      options.crossOrigin = 'anonymous';
    }

    return new ImageLayer({
      source: new ImageStatic(options),
      opacity: this.opacity,
    });
  }
}

export default SingleImageOpenlayersImpl;
