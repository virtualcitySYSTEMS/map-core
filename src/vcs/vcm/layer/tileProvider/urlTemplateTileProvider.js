import axios from 'axios';
import { Math as CesiumMath, Rectangle } from '@vcmap/cesium';
import { parseGeoJSON } from '../geojsonHelpers.js';
import TileProvider from './tileProvider.js';
import { getCurrentLocale } from '../../util/locale.js';

/**
 * @typedef {TileProviderOptions} URLTemplateTileProviderOptions
 * @property {string} url  url Template in the form `http://myFeatureSource/layer/getFeatures?minx={minx}&miny={miny}&maxx={maxx}&maxy={maxy}` or `http://myFeatureSource/layer/getFeatures?x={x}&y={y}&level={z}`
 * @api
 */

/**
 * replaces {x}, {y}, {z} with the x, y, z tiling coordinates
 * replaces {minx}, {miny}, {maxx}, {maxy} with extent of the tile if tilingExtent is provided
 * replaces {locale} with the current locale
 *
 * @param {string} url
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {import("@vcmap/cesium").Rectangle=} tilingExtent
 * @returns {string}
 */
export function getURL(url, x, y, z, tilingExtent) {
  let replacedURL = url;
  if (tilingExtent) {
    const southwest = Rectangle.southwest(tilingExtent);
    const northeast = Rectangle.northeast(tilingExtent);
    const minx = CesiumMath.toDegrees(southwest.longitude);
    const miny = CesiumMath.toDegrees(southwest.latitude);
    const maxx = CesiumMath.toDegrees(northeast.longitude);
    const maxy = CesiumMath.toDegrees(northeast.latitude);
    replacedURL = replacedURL
      .replace(/\{minx\}/, String(minx))
      .replace(/\{miny\}/, String(miny))
      .replace(/\{maxx\}/, String(maxx))
      .replace(/\{maxy\}/, String(maxy));
  }

  replacedURL = replacedURL
    .replace(/\{x\}/, String(x))
    .replace(/\{y\}/, String(y))
    .replace(/\{z\}/, String(z))
    .replace(/\{locale\}/, getCurrentLocale());
  return replacedURL;
}

/**
 * TileProvider loads GeoJSON from the provided URL. The URL has placeholders:
 * the extent in latitude/longitude via: {minx}, {miny}, {maxx}, {maxy}
 * tile Coordinates in x, y, z(level) via:  {x}, {y}, {z}
 * {locale} can be used to request locale aware content.
 *
 * @class
 * @extends {TileProvider}
 * @export
 * @api
 */
class URLTemplateTileProvider extends TileProvider {
  /**
   * @readonly
   * @returns {string}
   */
  static get className() { return 'vcs.vcm.layer.tileProvider.URLTemplateTileProvider'; }

  /**
   * @returns {URLTemplateTileProviderOptions}
   */
  static getDefaultOptions() {
    return {
      ...TileProvider.getDefaultOptions(),
      url: undefined,
    };
  }

  /**
   * @param {URLTemplateTileProviderOptions} options
   */
  constructor(options) {
    const defaultOptions = URLTemplateTileProvider.getDefaultOptions();
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
  async loader(x, y, z) {
    const rectangle = this.tilingScheme.tileXYToRectangle(x, y, z);
    const url = getURL(this.url, x, y, z, rectangle);
    const response = await axios.get(url);
    const { features } = parseGeoJSON(response.data, { dynamicStyle: true });
    return features;
  }
}

export default URLTemplateTileProvider;
