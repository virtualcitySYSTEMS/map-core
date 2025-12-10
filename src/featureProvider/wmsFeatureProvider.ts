import GML2 from 'ol/format/GML2.js';
import type { Options as GMLOptions } from 'ol/format/GMLBase.js';
import WFS from 'ol/format/WFS.js';
import GeoJSON, { type Options as GeoJSONOptions } from 'ol/format/GeoJSON.js';
import GML3 from 'ol/format/GML3.js';
import GML32 from 'ol/format/GML32.js';
import Point from 'ol/geom/Point.js';
import { getTransform, type Projection as OLProjection } from 'ol/proj.js';
import type { Size } from 'ol/size.js';
import { Feature } from 'ol';
import type { Coordinate } from 'ol/coordinate.js';
import type { TileWMS } from 'ol/source.js';
import type FeatureFormat from 'ol/format/Feature.js';
import WMSGetFeatureInfo from 'ol/format/WMSGetFeatureInfo.js';
import type { Options as WMSGetFeatureInfoOptions } from 'ol/format/WMSGetFeatureInfo.js';
import { containsCoordinate } from 'ol/extent.js';
import { parseInteger } from '@vcsuite/parsers';
import { getLogger } from '@vcsuite/logger';
import { type AbstractFeatureProviderOptions } from './abstractFeatureProvider.js';
import AbstractFeatureProvider from './abstractFeatureProvider.js';
import type { ProjectionOptions } from '../util/projection.js';
import Projection, { mercatorProjection } from '../util/projection.js';
import type { WMSSourceOptions } from '../layer/wmsHelpers.js';
import { getWMSSource } from '../layer/wmsHelpers.js';
import type { ExtentOptions } from '../util/extent.js';
import Extent from '../util/extent.js';
import { getInitForUrl, requestUrl } from '../util/fetch.js';
import { featureProviderClassRegistry } from '../classRegistry.js';
import { TilingScheme } from '../layer/rasterLayer.js';
import type Layer from '../layer/layer.js';

export type FormatOptions = GeoJSONOptions &
  GMLOptions &
  Record<string, unknown>;

export type WMSFeatureProviderOptions = AbstractFeatureProviderOptions & {
  /**
   * the response type for the feature info
   * @default 'text/xml'
   */
  responseType?: string;
  /**
   * format options forwarded to OpenLayers
   */
  formatOptions?: FormatOptions;
  /**
   * optional format to use to parse the feature info response, overriding the responseType to format mapping. Use 'GeoJSON', 'GML2', 'GML3', 'GML32', 'WMSGetFeatureInfo' or 'WFS' as string.
   */
  featureInfoFormat?: keyof typeof featureInfoFormat;
  /**
   * optional GMLFormat for the WFS format to override the default GML2 format. Use 'GML', 'GML2', 'GML3' or 'GML32' as string
   */
  wfsGMLFormat?: keyof typeof gmlFormats;
  /**
   * the projection of the data, if not encoded in the response
   */
  projection?: ProjectionOptions;
  url: string;
  /**
   * @default {@link TilingScheme.GEOGRAPHIC}
   */
  tilingSchema?: TilingScheme;
  /**
   * @default 18
   */
  maxLevel?: number;
  /**
   * @default 0
   */
  minLevel?: number;
  /**
   * @default [256, 256]
   */
  tileSize?: Size;
  extent?: Extent | ExtentOptions;
  parameters: Record<string, string>;
  /**
   * @default '1.1.1'
   */
  version?: string;
  htmlPositionFeatureTitle?: string;
  /**
   * Optional headers to include in GetFeatureInfo requests. Overrides layer headers.
   */
  headers?: Record<string, string>;
};

const gmlFormats = { GML: GML3, GML2, GML3, GML32 };

const featureInfoFormat = {
  GeoJSON,
  GML2,
  GML3,
  GML32,
  WMSGetFeatureInfo,
  WFS,
};

const geojsonFormats = [
  'application/geojson',
  'application/json',
  'application/vnd.geo+json',
  'application/geo+json',
];

export function getFormat(
  responseType: string,
  options: FormatOptions = {},
  format?: keyof typeof featureInfoFormat,
  gmlFormatKey?: keyof typeof gmlFormats,
): null | FeatureFormat {
  if (format) {
    if (!(format in featureInfoFormat)) {
      getLogger('WMSFeatureProvider').error(
        `Unknown featureInfoFormat ${format}`,
      );
      return null;
    }
    const formatOptions = {
      ...options,
      ...(gmlFormatKey && { gmlFormat: new gmlFormats[gmlFormatKey]() }),
    };
    return new featureInfoFormat[format](formatOptions);
  }

  if (responseType === 'text/html') {
    return new WMSGetFeatureInfo(options as WMSGetFeatureInfoOptions);
  }
  if (responseType === 'text/xml') {
    if (gmlFormatKey && !(gmlFormatKey in gmlFormats)) {
      getLogger('WMSFeatureProvider').error(
        `Unknown GML format ${gmlFormatKey}`,
      );
      return null;
    }
    const gmlFormat: GML2 | GML3 | GML32 = new gmlFormats[
      gmlFormatKey ?? 'GML2'
    ]();
    return new WFS({ ...options, gmlFormat });
  }
  if (geojsonFormats.includes(responseType)) {
    return new GeoJSON(options);
  }
  if (responseType === 'application/vnd.ogc.gml') {
    // works with mapServer and "msGMLOutput", replaces GML2 format, and still works with gml2 documents
    return new WMSGetFeatureInfo(options as WMSGetFeatureInfoOptions);
  }
  if (
    responseType === 'application/vnd.ogc.gml/3.1.1' ||
    responseType === 'text/xml; subtype=gml/3.1.1'
  ) {
    return new GML3(options);
  }
  if (
    responseType === 'text/xml; subtype=gml/3.2.1' ||
    responseType === 'text/xml;subtype=gml/3.2.1'
  ) {
    return new GML32(options);
  }
  return null;
}

/**
 * Calculates meters per degree at a given coordinate's latitude
 * @param coordinate - Coordinate in geographic projection
 * @returns Meters per degree at the coordinate's latitude
 */
function getMetersPerDegreeAtCoordinate(coordinate: Coordinate): number {
  const latitude = coordinate[1];
  const latitudeRadians = (latitude * Math.PI) / 180;

  // Meters per degree longitude varies with latitude: cos(lat) * metersPerDegreeAtEquator
  // Meters per degree latitude is approximately constant at ~111,320 m
  // Using an average that accounts for longitude compression at latitude
  const metersPerDegreeAtEquator = 111320;
  return metersPerDegreeAtEquator * Math.cos(latitudeRadians);
}

class WMSFeatureProvider extends AbstractFeatureProvider {
  static get className(): string {
    return 'WMSFeatureProvider';
  }

  static getDefaultOptions(): WMSFeatureProviderOptions {
    return {
      ...AbstractFeatureProvider.getDefaultOptions(),
      responseType: 'text/xml',
      style: undefined,
      formatOptions: undefined,
      projection: undefined,
      url: '',
      tilingSchema: TilingScheme.GEOGRAPHIC,
      version: '1.1.1',
      maxLevel: 0,
      minLevel: 0,
      tileSize: [256, 256],
      parameters: {},
      extent: undefined,
      headers: undefined,
    };
  }

  extent: Extent | null = null;

  private _wmsSourceOptions: WMSSourceOptions;

  /**
   * The WmsLayer Source used to generate getFeatureInfo urls
   */
  private _wmsSource: TileWMS | undefined;

  /**
   * The response type of the get feature info response, e.g. text/xml
   */
  featureInfoResponseType: string;

  /**
   * The feature info format, if different from the responseType.
   */
  featureInfoFormat: keyof typeof featureInfoFormat | undefined;

  private _formatOptions: FormatOptions | undefined;

  /**
   * The GMLFormat used for the WfsLayer, defaults to GML2.
   * Use 'GML', 'GML2', 'GML3' or 'GML32' as string
   */
  wfsGMLFormat: keyof typeof gmlFormats | undefined;

  /**
   * The feature response format determined by the response type. Use formatOptions to configure the underlying ol.format.Feature
   */
  featureFormat: FeatureFormat | null;

  /**
   * The feature response projection, if not present in the response format.
   */
  projection: Projection | undefined;

  htmlPositionFeatureTitle?: string;

  /**
   * Optional headers to include in GetFeatureInfo requests.
   */
  headers?: Record<string, string>;

  constructor(options: WMSFeatureProviderOptions) {
    const defaultOptions = WMSFeatureProvider.getDefaultOptions();
    super({ ...defaultOptions, ...options });

    if (options.extent) {
      if (options.extent instanceof Extent) {
        this.extent = options.extent;
      } else {
        this.extent = new Extent(options.extent);
      }
    }
    this._wmsSourceOptions = {
      url: options.url,
      tilingSchema:
        options.tilingSchema || (defaultOptions.tilingSchema as TilingScheme),
      maxLevel: parseInteger(options.maxLevel, defaultOptions.maxLevel),
      minLevel: parseInteger(options.minLevel, defaultOptions.minLevel),
      tileSize: options.tileSize || (defaultOptions.tileSize as Size),
      parameters: options.parameters,
      version: options.version || (defaultOptions.version as string),
    };

    this._wmsSource = getWMSSource(this._wmsSourceOptions);
    this.featureInfoResponseType =
      options.responseType || (defaultOptions.responseType as string);
    this.featureInfoFormat = options.featureInfoFormat;
    this._formatOptions = options.formatOptions || defaultOptions.formatOptions;
    this.wfsGMLFormat = options.wfsGMLFormat;
    this.featureFormat = getFormat(
      this.featureInfoResponseType,
      options.formatOptions,
      this.featureInfoFormat,
      this.wfsGMLFormat,
    );
    this.projection = options.projection
      ? new Projection(options.projection)
      : undefined;
    this.htmlPositionFeatureTitle = options.htmlPositionFeatureTitle;
    this.headers = options.headers
      ? structuredClone(options.headers)
      : undefined;
  }

  get wmsSource(): TileWMS {
    if (!this._wmsSource) {
      throw new Error('Accessing destroyed WMSFeatureProvider');
    }
    return this._wmsSource;
  }

  set wmsSource(source: TileWMS) {
    this._wmsSource = source;
  }

  featureResponseCallback(
    // any because this is the type provided by readFeatures
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-redundant-type-constituents
    data: Document | Element | ArrayBuffer | any | string,
    coordinate: Coordinate,
  ): Feature[] {
    let features = [];

    try {
      if (this.featureInfoResponseType === 'text/html') {
        features = [new Feature({ title: this.htmlPositionFeatureTitle })];
      } else {
        features = this.featureFormat!.readFeatures(data, {
          dataProjection: this.projection ? this.projection.proj : undefined,
          featureProjection: mercatorProjection.proj,
        });
      }
    } catch (_err) {
      this.getLogger().warning(
        'Features could not be read, please verify the featureInfoResponseType with the capabilities from the server',
      );
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

  async getFeaturesByCoordinate(
    coordinate: Coordinate,
    resolution: number,
    layer: Layer,
  ): Promise<Feature[]> {
    if (
      this.extent?.isValid() &&
      !containsCoordinate(
        this.extent.getCoordinatesInProjection(mercatorProjection),
        coordinate,
      )
    ) {
      return [];
    }

    const projection = this.wmsSource.getProjection() as OLProjection;
    let coords = coordinate;
    let res = resolution;
    if (projection) {
      const transform = getTransform(mercatorProjection.proj, projection);
      coords = transform(coordinate.slice());
    }
    if (projection.getUnits() === 'degrees') {
      const metersPerDegree = getMetersPerDegreeAtCoordinate(coords);
      res = resolution / metersPerDegree;
    }

    const url = this.wmsSource.getFeatureInfoUrl(coords, res, projection, {
      INFO_FORMAT: this.featureInfoResponseType,
    });

    if (this.featureInfoResponseType === 'text/html') {
      return this.featureResponseCallback(null, coordinate).map((f) =>
        this.getProviderFeature(f, layer),
      );
    } else if (url) {
      const init = getInitForUrl(url, this.headers ?? layer.headers);
      let data: string;
      try {
        const response = await requestUrl(url, init);
        data = await response.text();
      } catch (ex) {
        this.getLogger().error(`Failed fetching WMS FeatureInfo ${url}`);
        return [];
      }
      return this.featureResponseCallback(data, coordinate).map((f) =>
        this.getProviderFeature(f, layer),
      );
    }
    return [];
  }

  toJSON(
    defaultOptions = WMSFeatureProvider.getDefaultOptions(),
  ): WMSFeatureProviderOptions {
    const config: Partial<WMSFeatureProviderOptions> = super.toJSON(
      defaultOptions,
    );

    if (this.featureInfoResponseType !== defaultOptions.responseType) {
      config.responseType = this.featureInfoResponseType;
    }

    if (this.featureInfoFormat) {
      config.featureInfoFormat = this.featureInfoFormat;
    }

    if (this.wfsGMLFormat) {
      config.wfsGMLFormat = this.wfsGMLFormat;
    }

    if (this._formatOptions !== defaultOptions.formatOptions) {
      config.formatOptions = { ...this._formatOptions };
    }

    if (this.projection) {
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
      this._wmsSourceOptions.tileSize[0] !== defaultOptions?.tileSize?.[0] ||
      this._wmsSourceOptions.tileSize[1] !== defaultOptions?.tileSize?.[1]
    ) {
      config.tileSize = this._wmsSourceOptions.tileSize.slice();
    }
    if (this.extent) {
      config.extent = this.extent.toJSON();
    }
    if (this.htmlPositionFeatureTitle) {
      config.htmlPositionFeatureTitle = this.htmlPositionFeatureTitle;
    }
    if (this.headers) {
      config.headers = structuredClone(this.headers);
    }

    return config as WMSFeatureProviderOptions;
  }

  destroy(): void {
    this._wmsSource = undefined;
    this.featureFormat = null;
    this.projection = undefined;
    this._formatOptions = undefined;
    super.destroy();
  }
}

export default WMSFeatureProvider;
featureProviderClassRegistry.registerClass(
  WMSFeatureProvider.className,
  WMSFeatureProvider,
);
