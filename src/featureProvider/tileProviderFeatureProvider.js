import AbstractFeatureProvider from './abstractFeatureProvider.js';
import { featureProviderClassRegistry } from '../classRegistry.js';


/**
 * @typedef {AbstractFeatureProviderOptions} TileProviderFeatureProviderOptions
 * @property {import("@vcmap/core").TileProvider} tileProvider
 * @api
 */

/**
 * @class
 * @extends {AbstractFeatureProvider}
 */
class TileProviderFeatureProvider extends AbstractFeatureProvider {
  static get className() { return 'TileProviderFeatureProvider'; }

  /**
   * @param {string} layerName
   * @param {TileProviderFeatureProviderOptions} options
   */
  constructor(layerName, options) {
    super(layerName, options);

    /**
     * Map ClassNames Can be used to only apply this featureProvider to the specified maps
     * @type {Array<string>}
     * @api
     */
    this.mapTypes = ['CesiumMap'];

    /**
     * TileProvider
     * @type {import("@vcmap/core").TileProvider}
     * @api
     */
    this.tileProvider = options.tileProvider;
  }


  /**
   * @inheritDoc
   * @param {import("ol/coordinate").Coordinate} coordinate
   * @param {number} resolution
   * @returns {Promise<Array<import("ol").Feature<import("ol/geom/Geometry").default>>>}
   */
  async getFeaturesByCoordinate(coordinate, resolution) {
    const features = await this.tileProvider.getFeaturesByCoordinate(coordinate, resolution);
    return features.filter((feature) => {
      return this.vectorProperties.getAllowPicking(feature);
    });
  }

  /**
   * @inheritDoc
   */
  destroy() {
    this.tileProvider = undefined;
    super.destroy();
  }
}

export default TileProviderFeatureProvider;
featureProviderClassRegistry.registerClass(TileProviderFeatureProvider.className, TileProviderFeatureProvider);
