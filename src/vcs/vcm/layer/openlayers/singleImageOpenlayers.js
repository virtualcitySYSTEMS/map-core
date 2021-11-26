import ImageLayer from 'ol/layer/Image.js';
import ImageStatic from 'ol/source/ImageStatic.js';
import RasterLayerOpenlayers from './rasterLayerOpenlayers.js';
import { wgs84Projection } from '../../util/projection.js';
import { isSameOrigin } from '../../util/urlHelpers.js';

/**
 * represents a specific OpenLayers SingleImageLayer Layer class.
 * @class
 * @export
 * @extends {RasterLayerOpenlayers}
 */
class SingleImageOpenlayers extends RasterLayerOpenlayers {
  static get className() { return 'vcs.vcm.layer.openlayers.SingleImageOpenlayers'; }

  /**
   * @param {import("@vcmap/core").Openlayers} map
   * @param {SingleImageImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);

    /** @type {string} */
    this.credit = options.credit;
  }

  /**
   * returns the ol Layer
   * @returns {import("ol/layer/Layer").default}
   */
  getOLLayer() {
    const options = {
      attributions: this.credit,
      url: this.url,
      projection: 'EPSG:4326',
      imageExtent: this.extent.getCoordinatesInProjection(wgs84Projection),
    };
    if (!isSameOrigin(this.url)) {
      options.crossOrigin = 'anonymous';
    }

    return new ImageLayer({
      source: new ImageStatic(options),
      opacity: this.opacity,
    });
  }
}

export default SingleImageOpenlayers;
