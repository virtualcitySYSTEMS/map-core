import type { GeoJSONObject } from 'ol/format/GeoJSON.js';
import type { Feature } from 'ol/index.js';
import { parseGeoJSON } from '../geojsonHelpers.js';
import TileProvider, { TileProviderOptions } from './tileProvider.js';
import { getInitForUrl, requestJson } from '../../util/fetch.js';
import { tileProviderClassRegistry } from '../../classRegistry.js';

export type StaticGeoJSONTileProviderOptions = TileProviderOptions & {
  url: string;
};

/**
 * Loads the provided geojson url and tiles the content in memory, data is only requested once
 */
class StaticGeoJSONTileProvider extends TileProvider {
  static get className(): string {
    return 'StaticGeoJSONTileProvider';
  }

  static getDefaultOptions(): StaticGeoJSONTileProviderOptions {
    return {
      ...TileProvider.getDefaultOptions(),
      url: '',
      baseLevels: [0],
    };
  }

  url: string;

  constructor(options: StaticGeoJSONTileProviderOptions) {
    const defaultOptions = StaticGeoJSONTileProvider.getDefaultOptions();
    super({ ...options, baseLevels: defaultOptions.baseLevels });

    this.url = options.url || defaultOptions.url;
  }

  // eslint-disable-next-line no-unused-vars
  async loader(
    _x: number,
    _y: number,
    _z: number,
    headers?: Record<string, string>,
  ): Promise<Feature[]> {
    const init = getInitForUrl(this.url, headers);
    const data = await requestJson<GeoJSONObject>(this.url, init);
    const { features } = parseGeoJSON(data, { dynamicStyle: true });
    return features;
  }

  toJSON(): StaticGeoJSONTileProviderOptions {
    const config: Partial<StaticGeoJSONTileProviderOptions> = super.toJSON();
    delete config.baseLevels;

    if (this.url) {
      config.url = this.url;
    }
    return config as StaticGeoJSONTileProviderOptions;
  }
}

export default StaticGeoJSONTileProvider;
tileProviderClassRegistry.registerClass(
  StaticGeoJSONTileProvider.className,
  StaticGeoJSONTileProvider,
);
