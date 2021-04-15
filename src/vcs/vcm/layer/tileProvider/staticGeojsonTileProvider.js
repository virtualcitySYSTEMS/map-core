import axios from 'axios';
import { parseGeoJSON } from '../geojsonHelpers.js';
import TileProvider from './tileProvider.js';

/**
 * @typedef {vcs.vcm.layer.tileProvider.TileProvider.Options} vcs.vcm.layer.tileProvider.StaticGeojsonTileProvider.Options
 * @property {string} url geojson
 * @api
 */

/**
 * Loads the provided geojson url and tiles the content in memory, data is only requested once
 *
 * @class
 * @memberOf vcs.vcm.layer
 * @extends {vcs.vcm.layer.tileProvider.TileProvider}
 * @export
 * @api
 */
class StaticGeojsonTileProvider extends TileProvider {
  /**
   * @readonly
   * @returns {string}
   */
  static get className() { return 'vcs.vcm.layer.tileProvider.StaticGeojsonTileProvider'; }

  /**
   * @returns {vcs.vcm.layer.tileProvider.StaticGeojsonTileProvider.Options}
   */
  static getDefaultOptions() {
    return {
      ...TileProvider.getDefaultOptions(),
      url: undefined,
      baseLevels: [0],
    };
  }

  /**
   * @param {vcs.vcm.layer.tileProvider.StaticGeojsonTileProvider.Options} options
   */
  constructor(options) {
    const defaultOptions = StaticGeojsonTileProvider.getDefaultOptions();
    options.baseLevels = defaultOptions.baseLevels;
    super(options);

    /**
     * @type {string}
     */
    this.url = options.url || defaultOptions.url;
  }


  /**
   * @inheritDoc
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {Promise<Array<ol/Feature>>}
   */
  // eslint-disable-next-line no-unused-vars
  async loader(x, y, z) {
    const response = await axios.get(this.url);
    const { features } = parseGeoJSON(response.data, { dynamicStyle: true });
    return features;
  }
}

export default StaticGeojsonTileProvider;
