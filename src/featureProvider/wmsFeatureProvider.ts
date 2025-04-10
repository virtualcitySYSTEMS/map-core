import GML2 from 'ol/format/GML2.js';
import type { Options as GMLOptions } from 'ol/format/GMLBase.js';
import WFS from 'ol/format/WFS.js';
import GeoJSON, { type Options as GeoJSONOptions } from 'ol/format/GeoJSON.js';
import GML3 from 'ol/format/GML3.js';
import Point from 'ol/geom/Point.js';
import { getTransform, type Projection as OLProjection } from 'ol/proj.js';
import type { Size } from 'ol/size.js';
import type { Feature } from 'ol/index.js';
import type { Coordinate } from 'ol/coordinate.js';
import type { TileWMS } from 'ol/source.js';
import type FeatureFormat from 'ol/format/Feature.js';
import { parseInteger } from '@vcsuite/parsers';
import type { AbstractFeatureProviderOptions } from './abstractFeatureProvider.js';
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

export type FormatOptions = GeoJSONOptions &
  GMLOptions &
  Record<string, unknown> & { gmlFormat?: keyof typeof gmlFormats };

export type WMSFeatureProviderOptions = AbstractFeatureProviderOptions & {
  /**
   * the response type for the feature info
   * @default 'text/xml'
   */
  responseType?: string;
  /**
   * format options for the GeojsonLayer, WfsLayer or GML format. To overwrite the gmlFormat option in WfsLayer format, use 'GML', 'GML2' or 'GML3' as string
   */
  formatOptions?: FormatOptions;
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
};

const gmlFormats = {
  GML: GML3,
  GML2,
  GML3,
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
): null | FeatureFormat {
  if (responseType === 'text/xml') {
    const gmlFormat: GML3 | GML2 = options.gmlFormat
      ? new gmlFormats[options.gmlFormat]()
      : new GML2();
    return new WFS({ ...options, gmlFormat });
  }
  if (geojsonFormats.includes(responseType)) {
    return new GeoJSON(options);
  }
  if (responseType === 'application/vnd.ogc.gml') {
    return new GML2(options);
  }
  if (
    responseType === 'application/vnd.ogc.gml/3.1.1' ||
    responseType === 'text/xml; subtype=gml/3.1.1'
  ) {
    return new GML3(options);
  }
  return null;
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

  private _formatOptions: FormatOptions | undefined;

  /**
   * The feature response format determined by the response type. Use formatOptions to configure the underlying ol.format.Feature
   */
  featureFormat: FeatureFormat | null;

  /**
   * The feature response projection, if not present in the response format.
   */
  projection: Projection | undefined;

  constructor(layerName: string, options: WMSFeatureProviderOptions) {
    super(layerName, options);
    const defaultOptions = WMSFeatureProvider.getDefaultOptions();

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

    this._formatOptions = options.formatOptions || defaultOptions.formatOptions;
    this.featureFormat = getFormat(
      this.featureInfoResponseType,
      options.formatOptions,
    );
    this.projection = options.projection
      ? new Projection(options.projection)
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
    let features: Feature[];

    try {
      features = this.featureFormat!.readFeatures(data, {
        dataProjection: this.projection ? this.projection.proj : undefined,
        featureProjection: mercatorProjection.proj,
      });
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
    headers?: Record<string, string>,
  ): Promise<Feature[]> {
    const projection = this.wmsSource.getProjection() as OLProjection;
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
      const init = getInitForUrl(url, headers);
      let data: string;
      try {
        const response = await requestUrl(url, init);
        data = await response.text();
      } catch (ex) {
        this.getLogger().error(`Failed fetching WMS FeatureInfo ${url}`);
        return [];
      }
      return this.featureResponseCallback(data, coordinate).map((f) =>
        this.getProviderFeature(f),
      );
    }
    return [];
  }

  toJSON(): WMSFeatureProviderOptions {
    const config: Partial<WMSFeatureProviderOptions> = super.toJSON();
    const defaultOptions = WMSFeatureProvider.getDefaultOptions();
    if (this.featureInfoResponseType !== defaultOptions.responseType) {
      config.responseType = this.featureInfoResponseType;
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
