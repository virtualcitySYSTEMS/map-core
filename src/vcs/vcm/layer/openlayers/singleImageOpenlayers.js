import ImageLayer from 'ol/layer/Image.js';
import ImageStatic from 'ol/source/ImageStatic.js';
import RasterLayerOpenlayers from './rasterLayerOpenlayers.js';
import { wgs84Projection } from '../../util/projection.js';
import { isSameOrigin } from '../../util/urlHelpers.js';

/**
 * represents a specific OpenLayers SingleImageLayer Layer class.
 * @class
 * @export
 * @extends {vcs.vcm.layer.openlayers.RasterLayerOpenlayers}
 * @memberOf vcs.vcm.layer.openlayers
 */
class SingleImageOpenlayers extends RasterLayerOpenlayers {
  static get className() { return 'vcs.vcm.layer.openlayers.SingleImageOpenlayers'; }

  /**
   * @param {vcs.vcm.maps.Openlayers} map
   * @param {vcs.vcm.layer.SingleImage.ImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);

    /** @type {string} */
    this.credit = options.credit;
  }

  /**
   * returns the ol Layer
   * @returns {ol/layer/Layer}
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
