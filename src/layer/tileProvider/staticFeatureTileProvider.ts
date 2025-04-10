import type { Feature } from 'ol';
import type { TileProviderOptions } from './tileProvider.js';
import TileProvider from './tileProvider.js';

export type StaticFeatureTileProviderOptions = Omit<
  TileProviderOptions,
  'baseLevels'
> & {
  features: Feature[];
};

export default class StaticFeatureTileProvider extends TileProvider {
  static get className(): string {
    return 'StaticFeatureTileProvider';
  }

  static getDefaultOptions(): StaticFeatureTileProviderOptions {
    return {
      ...TileProvider.getDefaultOptions(),
      features: [],
    };
  }

  private _features: Feature[];

  constructor(options: StaticFeatureTileProviderOptions) {
    const defaultOptions = StaticFeatureTileProvider.getDefaultOptions();
    super({ ...options, baseLevels: [0] });
    this._features = options.features || defaultOptions.features;
  }

  loader(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _x: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _y: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _z: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _headers?: Record<string, string>,
  ): Promise<Feature[]> {
    return Promise.resolve(this._features);
  }

  toJSON(): StaticFeatureTileProviderOptions {
    const config: TileProviderOptions = super.toJSON();

    delete config.baseLevels;
    const staticFeatureConfig: StaticFeatureTileProviderOptions = {
      ...structuredClone(config),
      features: this._features,
    };

    return staticFeatureConfig;
  }

  destroy(): void {
    this._features = [];
    super.destroy();
  }
}
