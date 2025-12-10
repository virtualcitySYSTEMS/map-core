import MVT from 'ol/format/MVT.js';
import Feature from 'ol/Feature.js';
import { getCenter } from 'ol/extent.js';
import type { Geometry } from 'ol/geom.js';
import type { TileProviderOptions } from './tileProvider.js';
import TileProvider from './tileProvider.js';
import { getURL } from './urlTemplateTileProvider.js';
import { getInitForUrl, requestArrayBuffer } from '../../util/fetch.js';
import { tileProviderClassRegistry } from '../../classRegistry.js';
import { rectangleToMercatorExtent } from '../../util/math.js';

export type MVTTileProviderOptions = TileProviderOptions & {
  /**
   * url to pbf tiled datasource {x}, {y}, {z} are placeholders for x, y, zoom
   */
  url: string;
};

/**
 * Loads the pbf tiles
 */
class MVTTileProvider extends TileProvider {
  static get className(): string {
    return 'MVTTileProvider';
  }

  static getDefaultOptions(): MVTTileProviderOptions {
    return {
      ...TileProvider.getDefaultOptions(),
      url: '',
    };
  }

  url: string;

  private _mvtFormat = new MVT<Feature>({ featureClass: Feature });

  constructor(options: MVTTileProviderOptions) {
    const defaultOptions = MVTTileProvider.getDefaultOptions();
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
    const extent = rectangleToMercatorExtent(rectangle);
    const center = getCenter(extent);
    const init = getInitForUrl(this.url, headers);
    const data = await requestArrayBuffer(url, init);
    const features = this._mvtFormat.readFeatures(data);
    const sx = (extent[2] - extent[0]) / 4096;
    const sy = -((extent[3] - extent[1]) / 4096);
    features.forEach((feature) => {
      const geom = feature.getGeometry() as Geometry;
      const flatCoordinates = geom.getFlatCoordinates();
      const flatCoordinatesLength = flatCoordinates.length;
      for (let i = 0; i < flatCoordinatesLength; i++) {
        if (i % 2) {
          flatCoordinates[i] = (flatCoordinates[i] - 2048) * sy;
          flatCoordinates[i] += center[1];
        } else {
          flatCoordinates[i] = (flatCoordinates[i] - 2048) * sx;
          flatCoordinates[i] += center[0];
        }
      }
    });
    return features;
  }

  toJSON(
    defaultOptions = MVTTileProvider.getDefaultOptions(),
  ): MVTTileProviderOptions {
    const config: Partial<MVTTileProviderOptions> = super.toJSON(
      defaultOptions,
    );

    if (this.url) {
      config.url = this.url;
    }
    return config as MVTTileProviderOptions;
  }
}

export default MVTTileProvider;
tileProviderClassRegistry.registerClass(
  MVTTileProvider.className,
  MVTTileProvider,
);
