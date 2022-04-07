import { parseBoolean } from '@vcsuite/parsers';
import Layer from './layer.js';
import { getHeightFromTerrainProvider, getTerrainProviderForUrl } from './terrainHelpers.js';
import CesiumMap from '../map/cesiumMap.js';
import TerrainCesiumImpl from './cesium/terrainCesiumImpl.js';
import { layerClassRegistry } from '../classRegistry.js';

/**
 * @typedef {LayerOptions} TerrainOptions
 * @property {boolean} [requestVertexNormals=true] - if the terrain should be shaded
 * @property {boolean} [requestWaterMask=false] - if a watermask should be requested
 * @api
 */

/**
 * @typedef {LayerImplementationOptions} TerrainImplementationOptions
 * @property {boolean} requestVertexNormals
 * @property {boolean} requestWaterMask
 */

/**
 * represents a terrain layer.
 * @class
 * @export
 * @extends {Layer}
 * @api stable
 */
class TerrainLayer extends Layer {
  static get className() { return 'TerrainLayer'; }

  /**
   * @returns {TerrainOptions}
   */
  static getDefaultOptions() {
    return {
      ...Layer.getDefaultOptions(),
      requestVertexNormals: true,
      requestWaterMask: false,
    };
  }

  /**
   * @param {TerrainOptions} options
   */
  constructor(options) {
    super(options);
    const defaultOptions = TerrainLayer.getDefaultOptions();

    this._supportedMaps = [
      CesiumMap.className,
    ];

    /**
     * @type {boolean}
     * @api
     */
    this.requestVertexNormals = parseBoolean(options.requestVertexNormals, defaultOptions.requestVertexNormals);

    /**
     * @type {boolean}
     * @api
     */
    this.requestWaterMask = parseBoolean(options.requestWaterMask, defaultOptions.requestWaterMask);
  }

  /**
   * @returns {TerrainImplementationOptions}
   */
  getImplementationOptions() {
    return {
      ...super.getImplementationOptions(),
      requestVertexNormals: this.requestVertexNormals,
      requestWaterMask: this.requestWaterMask,
    };
  }

  /**
   * @inheritDoc
   * @param {import("@vcmap/core").VcsMap} map
   * @returns {Array<TerrainCesiumImpl>}
   */
  createImplementationsForMap(map) {
    if (map instanceof CesiumMap) {
      return [new TerrainCesiumImpl(map, this.getImplementationOptions())];
    }
    return [];
  }

  /**
   * getHeight for coordinates
   * @param {Array<import("ol/coordinate").Coordinate>} coords - the height is added to the coordinates in place
   * @returns {Promise<Array<import("ol/coordinate").Coordinate>>}
   * @api stable
   */
  getHeightForWGS84Coordinates(coords) {
    const terrainProvider = getTerrainProviderForUrl({
      url: this.url,
      requestVertexNormals: this.requestVertexNormals,
      requestWaterMask: this.requestWaterMask,
    });
    return getHeightFromTerrainProvider(terrainProvider, coords, null, coords);
  }

  /**
   * @returns {TerrainOptions}
   */
  toJSON() {
    const config = /** @type {TerrainOptions} */ (super.toJSON());
    const defaultOptions = TerrainLayer.getDefaultOptions();

    if (this.requestVertexNormals !== defaultOptions.requestVertexNormals) {
      config.requestVertexNormals = this.requestVertexNormals;
    }
    if (this.requestWaterMask !== defaultOptions.requestWaterMask) {
      config.requestWaterMask = this.requestWaterMask;
    }
    return config;
  }
}

layerClassRegistry.registerClass(TerrainLayer.className, TerrainLayer);
export default TerrainLayer;
