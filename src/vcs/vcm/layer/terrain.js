import { parseBoolean } from '@vcs/parsers';
import Layer from './layer.js';
import { getHeightFromTerrainProvider, getTerrainProviderForUrl } from './terrainHelpers.js';
import CesiumMap from '../maps/cesium.js';
import TerrainCesium from './cesium/terrainCesium.js';

/**
 * @typedef {vcs.vcm.layer.Layer.Options} vcs.vcm.layer.Terrain.Options
 * @property {boolean} [requestVertexNormals=true] - if the terrain should be shaded
 * @property {boolean} [requestWaterMask=false] - if a watermask should be requested
 * @api
 */

/**
 * @typedef {vcs.vcm.layer.Layer.ImplementationOptions} vcs.vcm.layer.Terrain.ImplementationOptions
 * @property {boolean} requestVertexNormals
 * @property {boolean} requestWaterMask
 */

/**
 * represents a terrain layer.
 * @class
 * @export
 * @extends {vcs.vcm.layer.Layer}
 * @api stable
 * @memberOf vcs.vcm.layer
 */
class Terrain extends Layer {
  static get className() { return 'vcs.vcm.layer.Terrain'; }

  /**
   * @returns {vcs.vcm.layer.Terrain.Options}
   */
  static getDefaultOptions() {
    return {
      ...Layer.getDefaultOptions(),
      requestVertexNormals: true,
      requestWaterMask: false,
    };
  }

  /**
   * @param {vcs.vcm.layer.Terrain.Options} options
   */
  constructor(options) {
    super(options);
    const defaultOptions = Terrain.getDefaultOptions();

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
   * @returns {vcs.vcm.layer.Terrain.ImplementationOptions}
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
   * @param {vcs.vcm.maps.VcsMap} map
   * @returns {Array<vcs.vcm.layer.cesium.TerrainCesium>}
   */
  createImplementationsForMap(map) {
    if (map instanceof CesiumMap) {
      return [new TerrainCesium(map, this.getImplementationOptions())];
    }
    return [];
  }

  /**
   * getHeight for coordinates
   * @param {Array<ol/Coordinate>} coords - the height is added to the coordinates in place
   * @returns {Promise}
   * @api stable
   */
  getHeightForWGS84Coordinates(coords) {
    const terrainProvider = getTerrainProviderForUrl({
      url: this.url,
      requestVertexNormals: this.requestVertexNormals,
      requestWaterMask: this.requestWaterMask,
    });
    return getHeightFromTerrainProvider(terrainProvider, coords);
  }

  /**
   * @returns {vcs.vcm.layer.Terrain.Options}
   */
  getConfigObject() {
    const config = /** @type {vcs.vcm.layer.Terrain.Options} */ (super.getConfigObject());
    const defaultOptions = Terrain.getDefaultOptions();

    if (this.requestVertexNormals !== defaultOptions.requestVertexNormals) {
      config.requestVertexNormals = this.requestVertexNormals;
    }
    if (this.requestWaterMask !== defaultOptions.requestWaterMask) {
      config.requestWaterMask = this.requestWaterMask;
    }
    return config;
  }
}

export default Terrain;
