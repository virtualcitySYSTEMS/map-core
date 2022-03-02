import { parseGeoJSON } from '../geojsonHelpers.js';
import TileProvider from './tileProvider.js';
import { requestJson } from '../../util/fetch.js';

/**
 * @typedef {TileProviderOptions} StaticGeojsonTileProviderOptions
 * @property {string} url geojson
 * @api
 */

/**
 * Loads the provided geojson url and tiles the content in memory, data is only requested once
 *
 * @class
 * @extends {TileProvider}
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
   * @returns {StaticGeojsonTileProviderOptions}
   */
  static getDefaultOptions() {
    return {
      ...TileProvider.getDefaultOptions(),
      url: undefined,
      baseLevels: [0],
    };
  }

  /**
   * @param {StaticGeojsonTileProviderOptions} options
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
   * @returns {Promise<Array<import("ol").Feature<import("ol/geom/Geometry").default>>>}
   */
  // eslint-disable-next-line no-unused-vars
  async loader(x, y, z) {
    const data = await requestJson(this.url);
    const { features } = parseGeoJSON(data, { dynamicStyle: true });
    return features;
  }
}

export default StaticGeojsonTileProvider;
