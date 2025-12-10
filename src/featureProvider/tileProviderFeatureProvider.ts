import type { Coordinate } from 'ol/coordinate.js';
import type { Feature } from 'ol/index.js';
import AbstractFeatureProvider, {
  type AbstractFeatureProviderOptions,
} from './abstractFeatureProvider.js';
import type TileProvider from '../layer/tileProvider/tileProvider.js';
import type Layer from '../layer/layer.js';

export type TileProviderFeatureProviderOptions =
  AbstractFeatureProviderOptions & {
    tileProvider: TileProvider;
  };

class TileProviderFeatureProvider extends AbstractFeatureProvider {
  static get className(): string {
    return 'TileProviderFeatureProvider';
  }

  tileProvider: TileProvider;

  constructor(options: TileProviderFeatureProviderOptions) {
    super({ ...options, mapTypes: ['CesiumMap'] });

    this.tileProvider = options.tileProvider;
  }

  async getFeaturesByCoordinate(
    coordinate: Coordinate,
    resolution: number,
    layer: Layer,
  ): Promise<Feature[]> {
    const features = await this.tileProvider.getFeaturesByCoordinate(
      coordinate,
      resolution,
      layer.headers,
    );
    const checkShow = (feature: Feature): boolean =>
      this.style ? !!this.style.cesiumStyle.show.evaluate(feature) : true;
    return features.filter((feature) => {
      return (
        this.vectorProperties.getAllowPicking(feature) && checkShow(feature)
      );
    });
  }

  toJSON(
    defaultOptions: AbstractFeatureProviderOptions = AbstractFeatureProvider.getDefaultOptions(),
  ): AbstractFeatureProviderOptions {
    const options = super.toJSON(defaultOptions);
    delete options.mapTypes;
    return options;
  }

  destroy(): void {
    this.tileProvider.destroy();
    super.destroy();
  }
}

export default TileProviderFeatureProvider;
