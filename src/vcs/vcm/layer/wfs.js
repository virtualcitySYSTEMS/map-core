import WFSFormat from 'ol/format/WFS.js';
import axios from 'axios';
import Vector from './vector.js';
import Projection from '../util/projection.js';
import { VcsClassRegistry } from '../classRegistry.js';

/**
 * @typedef {VectorOptions} WFSOptions
 * @property {string|Array<string>} featureType - required parameter of the featureType to load. Supply an array for multiples
 * @property {string} featureNS - required parameter, namespace used for the feature prefix
 * @property {string} featurePrefix - required parameter, feature prefix
 * @property {Object|undefined} getFeatureOptions - additional config for [ol/format/WFS/writeGetFeature]{@link https://openlayers.org/en/latest/apidoc/ol.format.WFS.html} excluding featureType, featureNS and featurePrefix
 * @api
 */

/**
 * WFS Vector Layer
 * @class
 * @export
 * @extends {Vector}
 * @api
 */
class WFS extends Vector {
  static get className() { return 'vcs.vcm.layer.WFS'; }

  /**
   * @returns {WFSOptions}
   */
  static getDefaultOptions() {
    return {
      ...Vector.getDefaultOptions(),
      featureType: [],
      featureNS: '',
      featurePrefix: '',
      getFeatureOptions: {},
    };
  }

  /**
   * @param {WFSOptions} options
   */
  constructor(options) {
    const proj = new Projection(options.projection).toJSON();
    proj.alias = [`http://www.opengis.net/gml/srs/epsg.xml#${/** @type {string} */ (proj.epsg).match(/\d+/)[0]}`];
    options.projection = proj;
    super(options);

    /** @type {Array<string>} */
    this.featureType = Array.isArray(options.featureType) ? options.featureType : [options.featureType];

    /**
     * @type {string}
     * @todo should this not be an Object with definition and prefix?
     */
    this.featureNS = options.featureNS;

    /** @type {string} */
    this.featurePrefix = options.featurePrefix;

    /** @type {!Object} */
    this.getFeaturesOptions = options.getFeatureOptions || {};

    /** @type {import("ol/format/WFS").default} */
    this.wfsFormat = new WFSFormat({
      featureNS: this.featureNS,
      featureType: this.featureType,
    });

    /**
     * @type {Promise<void>|null}
     * @private
     */
    this._dataFetchedPromise = null;
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
      this.removeAllFeatures();
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
    if (this.url != null) {
      const requestDocument = this.wfsFormat
        .writeGetFeature(/** @type {import("ol/format/WFS").WriteGetFeatureOptions} */ ({
          featureNS: this.featureNS,
          featurePrefix: this.featurePrefix,
          featureTypes: this.featureType,
          srsName: this.projection.epsg,
          ...this.getFeaturesOptions,
        }));
      const postData = new XMLSerializer().serializeToString(requestDocument);
      this._dataFetchedPromise = axios.post(this.url, postData, {
        headers: {
          'Content-Type': 'application/text+xml',
        },
      })
        .then((response) => {
          this._parseWFSData(response.data);
        })
        .catch((err) => {
          this.getLogger().info(`Could not send request for loading layer content (${err.message})`);
          return Promise.reject(err);
        });

      return this._dataFetchedPromise;
    }
    this.getLogger().warning('Could not load WFS layer, no url is set');
    return Promise.reject(new Error('missing url in WFS layer'));
  }

  /**
   * @param {Element} obj
   * @private
   */
  _parseWFSData(obj) {
    const features = this.wfsFormat.readFeatures(obj);
    this.addFeatures(features);
  }

  /**
   * @inheritDoc
   * @returns {WFSOptions}
   */
  toJSON() {
    const config = /** @type {WFSOptions} */ (super.toJSON());

    config.featureType = this.featureType.slice();
    config.featureNS = this.featureNS;
    config.featurePrefix = this.featurePrefix;
    if (Object.keys(this.getFeaturesOptions).length > 0) {
      config.getFeatureOptions = this.getFeaturesOptions;
    }
    return config;
  }
}

VcsClassRegistry.registerClass(WFS.className, WFS);
export default WFS;
