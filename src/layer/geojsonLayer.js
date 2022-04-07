import VectorLayer from './vectorLayer.js';
import { parseGeoJSON, writeGeoJSONFeature } from './geojsonHelpers.js';
import Projection, { wgs84Projection } from '../util/projection.js';
import { layerClassRegistry } from '../classRegistry.js';
import { requestJson } from '../util/fetch.js';

/**
 * @typedef {VectorOptions} GeoJSONOptions
 * @property {Array<Object>|undefined} features - an array of GeojsonLayer features to parse
 * @api
 */

/**
 * indicates, that this feature is part of the options
 * @type {symbol}
 */
export const featureFromOptions = Symbol('featureFromOptions');


/**
 * GeojsonLayer layer for Cesium, OpenlayersMap and ObliqueMap
 * @class
 * @export
 * @extends {VectorLayer}
 * @api stable
 */
class GeoJSONLayer extends VectorLayer {
  static get className() { return 'GeoJSONLayer'; }

  /**
   * @returns {GeoJSONOptions}
   */
  static getDefaultOptions() {
    return {
      ...VectorLayer.getDefaultOptions(),
      projection: wgs84Projection.toJSON(),
      features: undefined,
    };
  }

  /**
   * @param {GeoJSONOptions} options
   */
  constructor(options) {
    const defaultOptions = GeoJSONLayer.getDefaultOptions();
    options.projection = options.projection || defaultOptions.projection;

    super(options);

    /**
     * @type {Promise<void>|null}
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
      this._dataFetchedPromise = requestJson(this.url)
        .then(data => this._parseGeojsonData(data))
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
   * @returns {GeoJSONOptions}
   */
  toJSON() {
    const config = /** @type {GeoJSONOptions} */ (super.toJSON());
    const defaultOptions = GeoJSONLayer.getDefaultOptions();

    const defaultProjection = new Projection(defaultOptions.projection);
    if (!this.projection.equals(defaultProjection)) {
      config.projection = this.projection.toJSON();
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

layerClassRegistry.registerClass(GeoJSONLayer.className, GeoJSONLayer);
export default GeoJSONLayer;
