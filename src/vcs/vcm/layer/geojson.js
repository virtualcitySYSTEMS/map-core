import axios from 'axios';
import Vector from './vector.js';
import { parseGeoJSON, writeGeoJSONFeature } from './geojsonHelpers.js';
import Projection, { wgs84Projection } from '../util/projection.js';
import { VcsClassRegistry } from '../classRegistry.js';

/**
 * @typedef {vcs.vcm.layer.Vector.Options} vcs.vcm.layer.GeoJSON.Options
 * @property {Array<Object>|undefined} features - an array of GeoJSON features to parse
 * @api
 */

/**
 * indicates, that this feature is part of the options
 * @type {symbol}
 */
export const featureFromOptions = Symbol('featureFromOptions');


/**
 * GeoJSON layer for Cesium, Openlayers and Oblique
 * @class
 * @export
 * @extends {vcs.vcm.layer.Vector}
 * @api stable
 * @memberOf vcs.vcm.layer
 */
class GeoJSON extends Vector {
  static get className() { return 'vcs.vcm.layer.GeoJSON'; }

  /**
   * @returns {vcs.vcm.layer.GeoJSON.Options}
   */
  static getDefaultOptions() {
    return {
      ...Vector.getDefaultOptions(),
      projection: wgs84Projection.getConfigObject(),
      features: undefined,
    };
  }

  /**
   * @param {vcs.vcm.layer.GeoJSON.Options} options
   */
  constructor(options) {
    const defaultOptions = GeoJSON.getDefaultOptions();
    options.projection = options.projection || defaultOptions.projection;

    super(options);

    /**
     * @type {Promise|null}
     * @private
     */
    this._dataFetchedPromise = null;
    /**
     * @type {Array<Object>}
     * @private
     */
    this._featuresToLoad = options.features || defaultOptions.features;
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.initialized) {
      await this.fetchData();
    }
    return super.initialize();
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  async reload() {
    if (this._dataFetchedPromise) {
      const configFeatures = this.getFeatures().filter(f => f[featureFromOptions]);
      this.removeAllFeatures();
      this.source.addFeatures(configFeatures);
      this._dataFetchedPromise = null;
      await this.fetchData();
    }
    return super.reload();
  }

  /**
   * Fetches the data for the layer. If data is already fetched returns a resolved Promise
   * @returns {Promise<void>}
   * @api
   */
  fetchData() {
    if (this._dataFetchedPromise) {
      return this._dataFetchedPromise;
    }

    if (Array.isArray(this._featuresToLoad)) {
      this._parseGeojsonData({
        type: 'FeatureCollection',
        features: this._featuresToLoad,
      });

      this.getFeatures()
        .forEach((f) => {
          f[featureFromOptions] = true;
        });

      this._featuresToLoad.splice(0);
      this._featuresToLoad = undefined;
    }

    if (this.url) {
      this._dataFetchedPromise = axios.get(this.url)
        .then((response) => {
          this._parseGeojsonData(response.data);
        })
        .catch((err) => {
          this.getLogger().warning(`Could not send request for loading layer content (${err.message})`);
          return Promise.reject(err);
        });
    } else {
      this._dataFetchedPromise = Promise.resolve();
    }
    return this._dataFetchedPromise;
  }

  /**
   * @param {Object} obj
   * @private
   */
  _parseGeojsonData(obj) {
    const data = parseGeoJSON(obj, {
      dataProjection: this.projection,
      dynamicStyle: true,
    });
    this.addFeatures(data.features);
    if (data.style) {
      this.setStyle(data.style);
    }
    if (data.vcsMeta) {
      // configured layer vectorProperties trumps vectorProperties from geojson file;
      const meta = { ...data.vcsMeta, ...this.vectorProperties.getVcsMeta() };
      this.setVcsMeta(meta);
    }
  }

  /**
   * @inheritDoc
   * @returns {vcs.vcm.layer.GeoJSON.Options}
   */
  getConfigObject() {
    const config = /** @type {vcs.vcm.layer.GeoJSON.Options} */ (super.getConfigObject());
    const defaultOptions = GeoJSON.getDefaultOptions();

    const defaultProjection = new Projection(defaultOptions.projection);
    if (!this.projection.equals(defaultProjection)) {
      config.projection = this.projection.getConfigObject();
    } else {
      delete config.projection;
    }

    if (Array.isArray(this._featuresToLoad)) {
      config.features = this._featuresToLoad.slice();
    } else {
      const features = this.getFeatures().filter(f => f[featureFromOptions]);
      if (features.length > 0) {
        config.features = features.map(f => writeGeoJSONFeature(f, { writeStyle: true, writeId: true }));
      }
    }

    return config;
  }

  /**
   * @inheritDoc
   */
  destroy() {
    super.destroy();
    this._featuresToLoad = undefined;
  }
}

VcsClassRegistry.registerClass(GeoJSON.className, GeoJSON);
export default GeoJSON;
