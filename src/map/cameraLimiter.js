import { Cartographic, Ellipsoid, Math as CesiumMath, sampleTerrain, sampleTerrainMostDetailed } from '@vcmap/cesium';
import { checkMaybe } from '@vcsuite/check';
import { parseInteger, parseNumber, parseEnumValue } from '@vcsuite/parsers';
import { getTerrainProviderForUrl, isTerrainTileAvailable } from '../layer/terrainHelpers.js';

/**
 * @typedef {Object} CameraLimiterOptions
 * @property {string|undefined} terrainUrl - required if mode is distance.
 * @property {string|undefined} [mode="height"] - either "height" or "distance".
 * @property {number} [limit=200]
 * @property {number|null} [level=12] - the level at which to request terrain data. setting this to null will request most detailed
 * @api
 */

/**
 * Enumeration of camera limiter modes.
 * @enum {string}
 * @property {string} HEIGHT
 * @property {string} DISTANCE
 */
export const CameraLimiterMode = {
  HEIGHT: 'height',
  DISTANCE: 'distance',
};

/**
 * Can limit a Cesium.Cameras position based on absolute height or distance to a given terrain
 * @class
 * @export
 * @api
 */
class CameraLimiter {
  static get className() { return 'CameraLimiter'; }

  /**
   * @returns {CameraLimiterOptions}
   */
  static getDefaultOptions() {
    return {
      mode: CameraLimiterMode.HEIGHT,
      terrainUrl: undefined,
      limit: 200,
      level: 12,
    };
  }

  /**
   * @param {CameraLimiterOptions} options
   */
  constructor(options) {
    const defaultOptions = CameraLimiter.getDefaultOptions();
    /**
     * The mode to use. When using DISTANCE mode, be sure to have a terrainProvider set.
     * @type {CameraLimiterMode}
     * @api
     */
    this.mode = parseEnumValue(options.mode, CameraLimiterMode, defaultOptions.mode);
    /**
     * @type {string|null}
     * @private
     */
    this._terrainUrl = options.terrainUrl || defaultOptions.terrainUrl;
    /**
     * @type {import("@vcmap/cesium").CesiumTerrainProvider|null}
     * @private
     */
    this._terrainProvider = this._terrainUrl ? getTerrainProviderForUrl({ url: this._terrainUrl }) : null;
    /**
     * The minimum height/distance to the terrain the camera must maintain
     * @type {number}
     * @api
     */
    this.limit = parseNumber(options.limit, defaultOptions.limit);
    /**
     * The level to request terrain data at
     * @type {number|null}
     * @api
     */
    this.level = options.level === null ? null : parseInteger(options.level, defaultOptions.level);
    /**
     * last checked camera position
     * @type {import("@vcmap/cesium").Cartographic}
     */
    this.lastCheckedPosition = new Cartographic();
    /**
     * last updated terrain height
     * @type {number|null}
     * @private
     */
    this._terrainHeight = null;
    /**
     * @type {boolean}
     * @private
     */
    this._updatingTerrainHeight = false;
  }

  /**
   * The url of the terrain to use. Required for mode DISTANCE
   * @type {string|null}
   * @api
   */
  get terrainUrl() {
    return this._terrainUrl;
  }

  /**
   * @param {string|null} url
   */
  set terrainUrl(url) {
    checkMaybe(url, String);

    if (this._terrainUrl !== url) {
      this._terrainUrl = url;
      this._terrainProvider = this._terrainUrl ? getTerrainProviderForUrl({ url: this._terrainUrl }) : null;
    }
  }

  /**
   * @param {import("@vcmap/cesium").Cartographic} cameraCartographic
   * @returns {Promise<Array<import("@vcmap/cesium").Cartographic>>}
   * @private
   */
  _limitWithLevel(cameraCartographic) {
    if (isTerrainTileAvailable(this._terrainProvider, this.level, cameraCartographic)) {
      return sampleTerrain(this._terrainProvider, this.level, [cameraCartographic]);
    }
    return this._limitMostDetailed(cameraCartographic);
  }

  /**
   * @param {import("@vcmap/cesium").Cartographic} cameraCartographic
   * @returns {Promise<Array<import("@vcmap/cesium").Cartographic>>}
   * @private
   */
  _limitMostDetailed(cameraCartographic) {
    return sampleTerrainMostDetailed(this._terrainProvider, [cameraCartographic]);
  }

  /**
   * @param {import("@vcmap/cesium").Cartographic} cameraCartographic
   * @returns {Promise<void>}
   * @private
   */
  async _updateTerrainHeight(cameraCartographic) {
    if (!this._updatingTerrainHeight &&
      !cameraCartographic.equalsEpsilon(this.lastCheckedPosition, CesiumMath.EPSILON5)) {
      this._updatingTerrainHeight = true;
      const [updatedPosition] = this.level != null ?
        await this._limitWithLevel(cameraCartographic.clone()) :
        await this._limitMostDetailed(cameraCartographic.clone());
      this._terrainHeight = updatedPosition.height;
      this.lastCheckedPosition = cameraCartographic;
      this._updatingTerrainHeight = false;
    }
  }

  /**
   * Limits the given camera based on this limiters specs.
   * @param {import("@vcmap/cesium").Camera} camera
   * @api
   * @returns {Promise<void>}
   */
  limitCamera(camera) {
    let promise = Promise.resolve();
    const cameraCartographic = Cartographic.fromCartesian(camera.position);
    if (cameraCartographic) {
      if (this.mode === CameraLimiterMode.DISTANCE && this._terrainProvider) {
        promise = this._updateTerrainHeight(cameraCartographic);
        if (this._terrainHeight && (cameraCartographic.height - this._terrainHeight) < this.limit) {
          const newHeight = this._terrainHeight + this.limit;
          Cartographic.toCartesian(
            new Cartographic(cameraCartographic.longitude, cameraCartographic.latitude, newHeight),
            Ellipsoid.WGS84,
            camera.position,
          );
        }
      } else if (cameraCartographic.height < this.limit) {
        Cartographic.toCartesian(
          new Cartographic(cameraCartographic.longitude, cameraCartographic.latitude, this.limit),
          Ellipsoid.WGS84,
          camera.position,
        );
      }
    }
    return promise;
  }

  /**
   * @returns {CameraLimiterOptions}
   */
  toJSON() {
    const config = {};
    const defaultOptions = CameraLimiter.getDefaultOptions();
    if (this.terrainUrl) {
      config.terrainUrl = this.terrainUrl;
    }

    if (this.limit !== defaultOptions.limit) {
      config.limit = this.limit;
    }

    if (this.mode !== defaultOptions.mode) {
      config.mode = this.mode;
    }

    if (this.level !== defaultOptions.level) {
      config.level = this.level;
    }
    return config;
  }
}

export default CameraLimiter;
