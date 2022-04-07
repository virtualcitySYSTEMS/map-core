import GML2 from 'ol/format/GML2.js';
import WFS from 'ol/format/WFS.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import GML3 from 'ol/format/GML3.js';
import Point from 'ol/geom/Point.js';
import { getTransform } from 'ol/proj.js';
import { parseInteger } from '@vcsuite/parsers';
import AbstractFeatureProvider from './abstractFeatureProvider.js';
import Projection, { mercatorProjection } from '../util/projection.js';
import { getWMSSource } from '../layer/wmsHelpers.js';
import Extent from '../util/extent.js';
import { requestJson } from '../util/fetch.js';
import { featureProviderClassRegistry } from '../classRegistry.js';

/**
 * @typedef {AbstractFeatureProviderOptions} WMSFeatureProviderOptions
 * @property {string|undefined} [responseType='text/xml'] - the response type for the feature info
 * @property {Object|undefined} formatOptions - format options for the GeojsonLayer, WfsLayer or GML format. To overwrite the gmlFormat option in WfsLayer format, use 'GML', 'GML2' or 'GML3' as string
 * @property {ProjectionOptions|undefined} projection - the projection of the data, if not encoded in the response
 * @property {string} url
 * @property {string} [tilingSchema='geographic'] -  either "geographic" or "mercator"
 * @property {number} [maxLevel=18]
 * @property {number} [minLevel=0]
 * @property {import("ol/size").Size} [tileSize=[256,256]]
 * @property {Extent|ExtentOptions|undefined} extent
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
 * @returns {null|import("ol/format/Feature").default}
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
 * @export
 * @extends {AbstractFeatureProvider}
 */
class WMSFeatureProvider extends AbstractFeatureProvider {
  static get className() { return 'WMSFeatureProvider'; }

  /**
   * @returns {WMSFeatureProviderOptions}
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
   * @param {WMSFeatureProviderOptions} options
   */
  constructor(layerName, options) {
    super(layerName, options);
    const defaultOptions = WMSFeatureProvider.getDefaultOptions();

    /**
     * @type {import("@vcmap/core").Extent|null}
     */
    this.extent = null;
    if (options.extent) {
      if (options.extent instanceof Extent) {
        this.extent = options.extent;
      } else {
        this.extent = new Extent(options.extent);
      }
    }
    /** @type {WMSSourceOptions} */
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
     * The WmsLayer Source used to generate getFeatureInfo urls
     * @type {import("ol/source/TileWMS").default}
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
     * The feature response format determined by the response type. Use formatOptions to configure the underlying ol.format.Feature
     * @type {import("ol/format/Feature").default}
     * @api
     */
    this.featureFormat = getFormat(this.featureInfoResponseType, options.formatOptions);
    /**
     * The feature response projection, if not present in the response format.
     * @type {Projection}
     * @api
     */
    this.projection = options.projection ? new Projection(options.projection) : undefined;
  }

  /**
   * @param {import("ol/format/GeoJSON").GeoJSONObject} data
   * @param {import("ol/coordinate").Coordinate} coordinate
   * @returns {Array<import("ol").Feature<import("ol/geom/Geometry").default>>}
   */
  featureResponseCallback(data, coordinate) {
    /** @type {Array<import("ol").Feature<import("ol/geom/Geometry").default>>} */
    let features;

    try {
      features = /** @type {Array<import("ol").Feature<import("ol/geom/Geometry").default>>} */
      (this.featureFormat.readFeatures(data, {
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
   * @param {import("ol/coordinate").Coordinate} coordinate
   * @param {number} resolution
   * @returns {Promise<Array<import("ol").Feature<import("ol/geom/Geometry").default>>>}
   */
  async getFeaturesByCoordinate(coordinate, resolution) {
    const projection = this.wmsSource.getProjection();
    let coords = coordinate;
    if (projection) {
      const transform = getTransform(mercatorProjection.proj, projection);
      // error in TransformFunction type definition, remove undefined after openlayer fixed the type
      coords = transform(coordinate.slice(), undefined, undefined);
    }

    const metersPerUnit = 111194.87428468118;
    const url = this.wmsSource.getFeatureInfoUrl(
      coords,
      resolution / metersPerUnit,
      projection,
      { INFO_FORMAT: this.featureInfoResponseType },
    );

    if (url) {
      let data;
      try {
        data = await requestJson(url);
      } catch (ex) {
        this.getLogger().error(`Failed fetching WMS FeatureInfo ${url}`);
        return [];
      }
      return this.featureResponseCallback(data, coordinate)
        .map(f => this.getProviderFeature(f));
    }
    return [];
  }

  /**
   * @inheritDoc
   * @returns {WMSFeatureProviderOptions}
   */
  toJSON() {
    const config = /** @type {WMSFeatureProviderOptions} */ (super.toJSON());
    const defaultOptions = WMSFeatureProvider.getDefaultOptions();
    if (this.featureInfoResponseType !== defaultOptions.responseType) {
      config.responseType = this.featureInfoResponseType;
    }

    if (this._formatOptions !== defaultOptions.formatOptions) {
      config.formatOptions = { ...this._formatOptions };
    }

    if (this.projection !== defaultOptions.projection) {
      config.projection = this.projection.toJSON();
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
      config.extent = this.extent.toJSON();
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
featureProviderClassRegistry.registerClass(WMSFeatureProvider.className, WMSFeatureProvider);
