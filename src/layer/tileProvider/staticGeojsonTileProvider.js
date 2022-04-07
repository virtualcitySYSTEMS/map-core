import { parseGeoJSON } from '../geojsonHelpers.js';
import TileProvider from './tileProvider.js';
import { requestJson } from '../../util/fetch.js';
import { tileProviderClassRegistry } from '../../classRegistry.js';

/**
 * @typedef {TileProviderOptions} StaticGeoJSONTileProviderOptions
 * @property {string} url - url to the geojson
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
class StaticGeoJSONTileProvider extends TileProvider {
  /**
   * @readonly
   * @returns {string}
   */
  static get className() { return 'StaticGeoJSONTileProvider'; }

  /**
   * @returns {StaticGeoJSONTileProviderOptions}
   */
  static getDefaultOptions() {
    return {
      ...TileProvider.getDefaultOptions(),
      url: undefined,
      baseLevels: [0],
    };
  }

  /**
   * @param {StaticGeoJSONTileProviderOptions} options
   */
  constructor(options) {
    const defaultOptions = StaticGeoJSONTileProvider.getDefaultOptions();
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

  /**
   * @returns {StaticGeoJSONTileProviderOptions}
   */
  toJSON() {
    const config = /** @type {StaticGeoJSONTileProviderOptions} */ (super.toJSON());
    delete config.baseLevels;

    if (this.url) {
      config.url = this.url;
    }
    return config;
  }
}

export default StaticGeoJSONTileProvider;
tileProviderClassRegistry.registerClass(StaticGeoJSONTileProvider.className, StaticGeoJSONTileProvider);
