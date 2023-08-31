import axios from 'axios';
import MVT from 'ol/format/MVT.js';
import Feature from 'ol/Feature.js';
import { getCenter } from 'ol/extent.js';
import TileProvider, { rectangleToExtent } from './tileProvider.js';
import { getURL } from './urlTemplateTileProvider.js';

/**
 * @typedef {vcs.vcm.layer.tileProvider.TileProvider.Options} vcs.vcm.layer.tileProvider.MVTTileProvider.Options
 * @property {string} url to pbf tiled datasource {x}, {y}, {z} are placeholders for x, y, zoom
 * @property {string|undefined} idProperty if property exists will be used to set the ID of the feature
 * @api
 */

/**
 * Loads the pbf tiles
 *
 * @class
 * @memberOf vcs.vcm.layer.tileProvider
 * @extends {vcs.vcm.layer.tileProvider.TileProvider}
 * @export
 * @api
 */
class MVTTileProvider extends TileProvider {
  /**
   * @readonly
   * @returns {string}
   */
  static get className() { return 'vcs.vcm.layer.tileProvider.MVTTileProvider'; }

  /**
   * @returns {vcs.vcm.layer.tileProvider.MVTTileProvider.Options}
   */
  static getDefaultOptions() {
    return {
      ...TileProvider.getDefaultOptions(),
      url: undefined,
      idProperty: undefined,
    };
  }

  /**
   * @param {vcs.vcm.layer.tileProvider.MVTTileProvider.Options} options
   */
  constructor(options) {
    const defaultOptions = MVTTileProvider.getDefaultOptions();
    super(options);

    /**
     * @type {string}
     */
    this.url = options.url || defaultOptions.url;

    /**
     * @type {string|undefined}
     */
    this.idProperty = options.idProperty || defaultOptions.idProperty;

    /**
     * @type {ol/format/MVT}
     * @private
     */
    this._MVTFormat = new MVT({ featureClass: Feature });
  }


  /**
   * @inheritDoc
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {Promise<Array<ol/Feature>>}
   */
  async loader(x, y, z) {
    const rectangle = this.tilingScheme.tileXYToRectangle(x, y, z);
    const url = getURL(this.url, x, y, z, rectangle);
    const extent = rectangleToExtent(rectangle);
    const center = getCenter(extent);
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const features = /** @type {Array<ol/Feature>} */(this._MVTFormat.readFeatures(response.data));
    const sx = ((extent[2] - extent[0]) / 4096);
    const sy = -((extent[3] - extent[1]) / 4096);
    features.forEach((feature) => {
      const idToUse = feature.get(this.idProperty);
      if (idToUse != null) {
        feature.setId(String(idToUse));
      }
      const geom = feature.getGeometry();
      const flatCoordinates = geom.getFlatCoordinates();
      const flatCoordinatesLength = flatCoordinates.length;
      for (let i = 0; i < flatCoordinatesLength; i++) {
        if (i % 2) {
          flatCoordinates[i] = (flatCoordinates[i] - 2048) * sy;
          flatCoordinates[i] += center[1];
        } else {
          flatCoordinates[i] = (flatCoordinates[i] - 2048) * sx;
          flatCoordinates[i] += center[0];
        }
      }
    });
    return features;
  }

  /**
   * @inheritDoc
   * @returns {vcs.vcm.layer.tileProvider.MVTTileProvider.Options}
   */
  getConfigObject() {
    const config = /** @type {vcs.vcm.layer.tileProvider.MVTTileProvider.Options} */ (super.toJSON());

    if (this.url) {
      config.url = this.url;
    }

    if (this.idProperty) {
      config.idProperty = this.idProperty;
    }
    return config;
  }
}

export default MVTTileProvider;
