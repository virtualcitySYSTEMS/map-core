import axios from 'axios';
import GML2 from 'ol/format/GML2.js';
import WFS from 'ol/format/WFS.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import GML3 from 'ol/format/GML3.js';
import Point from 'ol/geom/Point.js';
import { getTransform } from 'ol/proj.js';
import { parseInteger } from '@vcsuite/parsers';
import AbstractFeatureProvider from './abstractFeatureProvider.js';
import Projection, { mercatorProjection } from '../projection.js';
import { getWMSSource } from '../../layer/wmsHelpers.js';
import Extent from '../extent.js';

/**
 * @typedef {vcs.vcm.util.featureProvider.AbstractFeatureProvider.Options} vcs.vcm.util.featureProvider.WMSFeatureProvider.Options
 * @property {string|undefined} [responseType='text/xml'] - the response type for the feature info
 * @property {Object|undefined} formatOptions - format options for the GeoJSON, WFS or GML format. To overwrite the gmlFormat option in WFS format, use 'GML', 'GML2' or 'GML3' as string
 * @property {vcs.vcm.util.Projection.Options|undefined} projection - the projection of the data, if not encoded in the response
 * @property {string} url
 * @property {string} [tilingSchema='geographic'] -  either "geographic" or "mercator"
 * @property {number} [maxLevel=18]
 * @property {number} [minLevel=0]
 * @property {ol/Size} [tileSize=[256,256]]
 * @property {vcs.vcm.util.Extent|vcs.vcm.util.Extent.Options|undefined} extent
 * @property {Object<string, string>} parameters
 * @property {string} [version='1.1.1']
 * @api
 */

const gmlFormats = {
  GML: GML3,
  GML2,
  GML3,
};

/**
 * @type {Array<string>}
 * @const
 */
const geojsonFormats = [
  'application/geojson',
  'application/json',
  'application/vnd.geo+json',
];

/**
 * @param {string} responseType
 * @param {Object} options
 * @returns {null|ol/format/FeatureFormat}
 */
export function getFormat(responseType, options = {}) {
  if (responseType === 'text/xml') {
    options.gmlFormat = options.gmlFormat ? new gmlFormats[options.gmlFormat]() : new GML2();
    return new WFS(options);
  }
  if (geojsonFormats.includes(responseType)) {
    return new GeoJSON(options);
  }
  if (responseType === 'application/vnd.ogc.gml') {
    return new GML2(options);
  }
  if (responseType === 'application/vnd.ogc.gml/3.1.1') {
    return new GML3(options);
  }
  return null;
}

/**
 * @class
 * @extends {vcs.vcm.util.featureProvider.AbstractFeatureProvider}
 * @memberOf vcs.vcm.util.featureProvider
 */
class WMSFeatureProvider extends AbstractFeatureProvider {
  static get className() { return 'vcs.vcm.util.featureProvider.WMSFeatureProvider'; }

  /**
   * @returns {vcs.vcm.util.featureProvider.WMSFeatureProvider.Options}
   */
  static getDefaultOptions() {
    return {
      ...AbstractFeatureProvider.getDefaultOptions(),
      responseType: 'text/xml',
      style: undefined,
      formatOptions: undefined,
      projection: undefined,
      url: '',
      tilingSchema: 'geographic',
      version: '1.1.1',
      maxLevel: 0,
      minLevel: 0,
      tileSize: [256, 256],
      parameters: {},
      extent: undefined,
    };
  }

  /**
   * @param {string} layerName
   * @param {vcs.vcm.util.featureProvider.WMSFeatureProvider.Options} options
   */
  constructor(layerName, options) {
    super(layerName, options);
    const defaultOptions = WMSFeatureProvider.getDefaultOptions();

    /**
     * @type {vcs.vcm.util.Extent|null}
     */
    this.extent = null;
    if (options.extent) {
      if (options.extent instanceof Extent) {
        this.extent = options.extent;
      } else {
        this.extent = new Extent(options.extent);
      }
    }
    /** @type {vcs.vcm.layer.WMS.SourceOptions} */
    this._wmsSourceOptions = {
      url: options.url,
      tilingSchema: options.tilingSchema || defaultOptions.tilingSchema,
      maxLevel: parseInteger(options.maxLevel, defaultOptions.maxLevel),
      minLevel: parseInteger(options.minLevel, defaultOptions.minLevel),
      tileSize: options.tileSize || defaultOptions.tileSize,
      parameters: options.parameters,
      version: options.version || defaultOptions.version,
    };
    /**
     * The WMS Source used to generate getFeatureInfo urls
     * @type {ol/source/TileWMS}
     * @api
     */
    this.wmsSource = getWMSSource(this._wmsSourceOptions);
    /**
     * The response type of the get feature info response, e.g. text/xml
     * @type {string}
     * @api
     */
    this.featureInfoResponseType = options.responseType || defaultOptions.responseType;
    /**
     * @type {Object}
     * @private
     */
    this._formatOptions = options.formatOptions || defaultOptions.formatOptions;
    /**
     * The feature response format determined by the response type. Use formatOptions to configure the underlying ol.format.FeatureFormat
     * @type {ol/format/FeatureFormat}
     * @api
     */
    this.featureFormat = getFormat(this.featureInfoResponseType, options.formatOptions);
    /**
     * The feature response projection, if not present in the response format.
     * @type {vcs.vcm.util.Projection}
     * @api
     */
    this.projection = options.projection ? new Projection(options.projection) : undefined;
  }

  /**
   * @param {axios.AxiosResponse<*>} response
   * @param {ol/Coordinate} coordinate
   * @returns {Array<ol/Feature>}
   */
  featureResponseCallback(response, coordinate) {
    const { data } = response;
    /** @type {Array<ol/Feature>} */
    let features;

    try {
      features = /** @type {Array<ol/Feature>} */ (this.featureFormat.readFeatures(data, {
        dataProjection: this.projection ? this.projection.proj : undefined,
        featureProjection: mercatorProjection.proj,
      }));
    } catch (ex) {
      this.getLogger().warning('Features could not be read, please verify the featureInfoResponseType with the capabilities from the server');
      return [];
    }

    if (Array.isArray(features)) {
      features.forEach((feature) => {
        const geometry = feature.getGeometry();
        if (!geometry) {
          feature.setGeometry(new Point(coordinate));
        }
      });
      return features;
    }

    return [];
  }

  /**
   * @inheritDoc
   * @param {ol/Coordinate} coordinate
   * @param {number} resolution
   * @returns {Promise<Array<ol/Feature>>}
   */
  async getFeaturesByCoordinate(coordinate, resolution) {
    const projection = this.wmsSource.getProjection();
    let coords = coordinate;
    if (projection) {
      const transform = getTransform(mercatorProjection.proj, projection);
      coords = transform(coordinate.slice());
    }

    const metersPerUnit = 111194.87428468118;
    const url = this.wmsSource.getFeatureInfoUrl(
      coords,
      resolution / metersPerUnit,
      projection,
      { INFO_FORMAT: this.featureInfoResponseType },
    );

    if (url) {
      const response = await axios.get(url);
      return this.featureResponseCallback(response, coordinate)
        .map(f => this.getProviderFeature(f));
    }
    return [];
  }

  /**
   * @inheritDoc
   * @returns {vcs.vcm.util.featureProvider.WMSFeatureProvider.Options}
   */
  getConfigObject() {
    const config = /** @type {vcs.vcm.util.featureProvider.WMSFeatureProvider.Options} */ (super.getConfigObject());
    const defaultOptions = WMSFeatureProvider.getDefaultOptions();
    if (this.featureInfoResponseType !== defaultOptions.responseType) {
      config.responseType = this.featureInfoResponseType;
    }

    if (this._formatOptions !== defaultOptions.formatOptions) {
      config.formatOptions = { ...this._formatOptions };
    }

    if (this.projection !== defaultOptions.projection) {
      config.projection = this.projection.getConfigObject();
    }

    config.url = this._wmsSourceOptions.url;
    config.parameters = { ...this._wmsSourceOptions.parameters };

    if (this._wmsSourceOptions.tilingSchema !== defaultOptions.tilingSchema) {
      config.tilingSchema = this._wmsSourceOptions.tilingSchema;
    }
    if (this._wmsSourceOptions.maxLevel !== defaultOptions.maxLevel) {
      config.maxLevel = this._wmsSourceOptions.maxLevel;
    }
    if (this._wmsSourceOptions.minLevel !== defaultOptions.minLevel) {
      config.minLevel = this._wmsSourceOptions.minLevel;
    }
    if (this._wmsSourceOptions.version !== defaultOptions.version) {
      config.version = this._wmsSourceOptions.version;
    }
    if (
      this._wmsSourceOptions.tileSize[0] !== defaultOptions.tileSize[0] ||
      this._wmsSourceOptions.tileSize[1] !== defaultOptions.tileSize[1]
    ) {
      config.tileSize = this._wmsSourceOptions.tileSize.slice();
    }
    if (this.extent) {
      config.extent = this.extent.getConfigObject();
    }

    return config;
  }

  /**
   * @inheritDoc
   */
  destroy() {
    this.wmsSource = undefined;
    this.featureFormat = undefined;
    this.projection = undefined;
    this._formatOptions = undefined;
    super.destroy();
  }
}

export default WMSFeatureProvider;
