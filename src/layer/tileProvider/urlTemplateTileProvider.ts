import type { GeoJSONObject } from 'ol/format/GeoJSON.js';
import { Math as CesiumMath, Rectangle } from '@vcmap-cesium/engine';
import type { Feature } from 'ol/index.js';
import { parseGeoJSON } from '../geojsonHelpers.js';
import type { TileProviderOptions } from './tileProvider.js';
import TileProvider from './tileProvider.js';
import { getInitForUrl, requestJson } from '../../util/fetch.js';
import { tileProviderClassRegistry } from '../../classRegistry.js';

export type URLTemplateTileProviderOptions = TileProviderOptions & {
  /**
   * url Template in the form `http://myFeatureSource/layer/getFeatures?minx={minx}&miny={miny}&maxx={maxx}&maxy={maxy}` or `http://myFeatureSource/layer/getFeatures?x={x}&y={y}&level={z}`
   */
  url: string;
};

/**
 * replaces {x}, {y}, {z}  with the x, y, z tiling coordinates
 * replaces {minx}, {miny}, {maxx}, {maxy}  with extent of the tile if tilingExtent is provided
 * replaces {locale} with the given locale
 */
export function getURL(
  url: string,
  x: number,
  y: number,
  z: number,
  tilingExtent?: Rectangle,
  locale = 'en',
): string {
  let replacedURL = url;
  if (tilingExtent) {
    const southwest = Rectangle.southwest(tilingExtent);
    const northeast = Rectangle.northeast(tilingExtent);
    const minx = CesiumMath.toDegrees(southwest.longitude);
    const miny = CesiumMath.toDegrees(southwest.latitude);
    const maxx = CesiumMath.toDegrees(northeast.longitude);
    const maxy = CesiumMath.toDegrees(northeast.latitude);
    replacedURL = replacedURL
      .replace(/\{minx\}/, String(minx))
      .replace(/\{miny\}/, String(miny))
      .replace(/\{maxx\}/, String(maxx))
      .replace(/\{maxy\}/, String(maxy));
  }

  replacedURL = replacedURL
    .replace(/\{x\}/, String(x))
    .replace(/\{y\}/, String(y))
    .replace(/\{z\}/, String(z))
    .replace(/\{locale\}/, locale);
  return replacedURL;
}

/**
 * TileProvider loads GeojsonLayer from the provided URL. The URL has placeholders:
 * the extent in latitude/longitude via: {minx}, {miny}, {maxx}, {maxy}
 * tile Coordinates in x, y, z(level) via:  {x}, {y}, {z}
 * {locale} can be used to request locale aware content.
 *
 * @extends {TileProvider}
 */
class URLTemplateTileProvider extends TileProvider {
  static get className(): string {
    return 'URLTemplateTileProvider';
  }

  static getDefaultOptions(): URLTemplateTileProviderOptions {
    return {
      ...TileProvider.getDefaultOptions(),
      url: '',
    };
  }

  url: string;

  constructor(options: URLTemplateTileProviderOptions) {
    const defaultOptions = URLTemplateTileProvider.getDefaultOptions();
    super({ ...defaultOptions, ...options });
    this.url = options.url || defaultOptions.url;
  }

  get locale(): string {
    return super.locale;
  }

  /**
   * sets the locale and clears the Cache if the URL is a locale aware Object.
   */
  set locale(value: string) {
    if (this.locale !== value) {
      super.locale = value;
      if (this.url.includes('{locale}')) {
        // eslint-disable-next-line no-void
        void this.clearCache();
      }
    }
  }

  async loader(
    x: number,
    y: number,
    z: number,
    headers?: Record<string, string>,
  ): Promise<Feature[]> {
    const rectangle = this.tilingScheme.tileXYToRectangle(x, y, z);
    const url = getURL(this.url, x, y, z, rectangle, this.locale);

    const init = getInitForUrl(this.url, headers);
    const data = await requestJson<GeoJSONObject>(url, init);
    const { features } = parseGeoJSON(data, { dynamicStyle: true });
    return features;
  }

  toJSON(
    defaultOptions = URLTemplateTileProvider.getDefaultOptions(),
  ): URLTemplateTileProviderOptions {
    const config: Partial<URLTemplateTileProviderOptions> = super.toJSON(
      defaultOptions,
    );

    if (this.url) {
      config.url = this.url;
    }

    return config as URLTemplateTileProviderOptions;
  }
}

export default URLTemplateTileProvider;
tileProviderClassRegistry.registerClass(
  URLTemplateTileProvider.className,
  URLTemplateTileProvider,
);
