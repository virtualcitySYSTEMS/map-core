import AbstractFeatureProvider from './abstractFeatureProvider.js';


/**
 * @typedef {vcs.vcm.util.featureProvider.AbstractFeatureProvider.Options} vcs.vcm.util.featureProvider.TileProviderFeatureProvider.Options
 * @property {vcs.vcm.layer.tileProvider.TileProvider} tileProvider
 * @api
 */

/**
 * @class
 * @extends {vcs.vcm.util.featureProvider.AbstractFeatureProvider}
 * @memberOf vcs.vcm.util.featureProvider
 */
class TileProviderFeatureProvider extends AbstractFeatureProvider {
  static get className() { return 'vcs.vcm.util.featureProvider.TileProviderFeatureProvider'; }

  /**
   * @param {string} layerName
   * @param {vcs.vcm.util.featureProvider.TileProviderFeatureProvider.Options} options
   */
  constructor(layerName, options) {
    super(layerName, options);

    /**
     * Map ClassNames Can be used to only apply this featureProvider to the specified maps
     * @type {Array<string>}
     * @api
     */
    this.mapTypes = ['vcs.vcm.maps.Cesium'];

    /**
     * TileProvider
     * @type {vcs.vcm.layer.tileProvider.TileProvider}
     * @api
     */
    this.tileProvider = options.tileProvider;
  }


  /**
   * @inheritDoc
   * @param {ol/Coordinate} coordinate
   * @param {number} resolution
   * @returns {Promise<Array<ol/Feature>>}
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
