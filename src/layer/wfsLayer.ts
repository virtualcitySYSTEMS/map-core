import WFSFormat from 'ol/format/WFS.js';
import VectorLayer, { VectorOptions } from './vectorLayer.js';
import Projection from '../util/projection.js';
import { layerClassRegistry } from '../classRegistry.js';
import { getInitForUrl, requestUrl } from '../util/fetch.js';

export type WFSOptions = VectorOptions & {
  /**
   * the featureType to load. Supply an array for multiples
   */
  featureType: string | string[];
  /**
   * namespace used for the feature prefix
   */
  featureNS: string;
  featurePrefix: string;
  /**
   * additional config for [ol/format/WFS/writeGetFeature]{@link https://openlayers.org/en/latest/apidoc/ol.format.WFS.html} excluding featureType, featureNS and featurePrefix
   */
  getFeatureOptions?: Record<string, unknown>;

  /**
   * Version of the WFS Service, will be forwarded to the openlayers WFS Format.
   */
  version?: string;
};

/**
 * @group Layer
 */
class WFSLayer extends VectorLayer {
  static get className(): string {
    return 'WFSLayer';
  }

  featureType: string[];

  featureNS: string;

  featurePrefix: string;

  version: string | undefined;

  getFeaturesOptions: Record<string, unknown>;

  wfsFormat: WFSFormat;

  private _dataFetchedPromise: Promise<void> | null;

  static getDefaultOptions(): WFSOptions {
    return {
      ...VectorLayer.getDefaultOptions(),
      featureType: [],
      featureNS: '',
      featurePrefix: '',
      getFeatureOptions: {},
      version: undefined,
    };
  }

  constructor(options: WFSOptions) {
    const proj = new Projection(options.projection).toJSON();
    proj.alias = [
      `http://www.opengis.net/gml/srs/epsg.xml#${
        (proj.epsg as string).match(/\d+/)?.[0] as string
      }`,
    ];
    options.projection = proj;
    super(options);

    this.featureType = Array.isArray(options.featureType)
      ? options.featureType
      : [options.featureType];

    /**
     * @todo should this not be an Object with definition and prefix?
     */
    this.featureNS = options.featureNS;
    this.featurePrefix = options.featurePrefix;
    this.getFeaturesOptions = options.getFeatureOptions || {};
    this.version = options.version;
    this.wfsFormat = new WFSFormat({
      featureNS: this.featureNS,
      featureType: this.featureType,
      version: this.version,
    });

    this._dataFetchedPromise = null;
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.fetchData();
    }
    return super.initialize();
  }

  async reload(): Promise<void> {
    this.wfsFormat = new WFSFormat({
      featureNS: this.featureNS,
      featureType: this.featureType,
      version: this.version,
    });
    if (this._dataFetchedPromise) {
      this.removeAllFeatures();
      this._dataFetchedPromise = null;
      await this.fetchData();
    }
    return super.reload();
  }

  /**
   * Fetches the data for the layer. If data is already fetched returns a resolved Promise
   */
  fetchData(): Promise<void> {
    if (this._dataFetchedPromise) {
      return this._dataFetchedPromise;
    }
    if (this.url != null) {
      const requestDocument = this.wfsFormat.writeGetFeature({
        featureNS: this.featureNS,
        featurePrefix: this.featurePrefix,
        featureTypes: this.featureType,
        srsName: this.projection.epsg,
        ...this.getFeaturesOptions,
      });
      const postData = new XMLSerializer().serializeToString(requestDocument);
      const init = getInitForUrl(this.url, this.headers);
      init.method = 'POST';
      init.body = postData;
      init.headers = {
        ...init.headers,
        ...{
          'Content-Type': 'application/text+xml',
        },
      };
      this._dataFetchedPromise = requestUrl(this.url, init)
        .then((response) => response.text())
        .then((data) => this._parseWFSData(data))
        .catch((err) => {
          this.getLogger().info(
            `Could not send request for loading layer content (${String(err)})`,
          );
          return Promise.reject(err);
        });

      return this._dataFetchedPromise;
    }
    this.getLogger().warning('Could not load WFSLayer layer, no url is set');
    return Promise.reject(new Error('missing url in WFSLayer layer'));
  }

  private _parseWFSData(obj: string): void {
    const features = this.wfsFormat.readFeatures(obj);
    this.addFeatures(features);
  }

  toJSON(): WFSOptions {
    const config: Partial<WFSOptions> = super.toJSON();

    config.featureType = this.featureType.slice();
    config.featureNS = this.featureNS;
    config.featurePrefix = this.featurePrefix;
    if (Object.keys(this.getFeaturesOptions).length > 0) {
      config.getFeatureOptions = this.getFeaturesOptions;
    }
    return config as WFSOptions;
  }
}

layerClassRegistry.registerClass(WFSLayer.className, WFSLayer);
export default WFSLayer;
