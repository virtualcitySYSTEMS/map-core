import type { Coordinate } from 'ol/coordinate.js';
import type { Feature } from 'ol/index.js';
import AbstractFeatureProvider, {
  type AbstractFeatureProviderOptions,
} from './abstractFeatureProvider.js';
import { featureProviderClassRegistry } from '../classRegistry.js';
import type TileProvider from '../layer/tileProvider/tileProvider.js';

export type TileProviderFeatureProviderOptions =
  AbstractFeatureProviderOptions & {
    tileProvider: TileProvider;
  };

class TileProviderFeatureProvider extends AbstractFeatureProvider {
  static get className(): string {
    return 'TileProviderFeatureProvider';
  }

  tileProvider: TileProvider;

  /**
   * @param  layerName
   * @param  options
   */
  constructor(layerName: string, options: TileProviderFeatureProviderOptions) {
    super(layerName, options);

    this.mapTypes = ['CesiumMap'];
    this.tileProvider = options.tileProvider;
  }

  async getFeaturesByCoordinate(
    coordinate: Coordinate,
    resolution: number,
  ): Promise<Feature[]> {
    const features = await this.tileProvider.getFeaturesByCoordinate(
      coordinate,
      resolution,
    );
    const checkShow = (feature: Feature): boolean =>
      this.style ? !!this.style.cesiumStyle.show.evaluate(feature) : true;
    return features.filter((feature) => {
      return (
        this.vectorProperties.getAllowPicking(feature) && checkShow(feature)
      );
    });
  }

  destroy(): void {
    this.tileProvider.destroy();
    super.destroy();
  }
}

export default TileProviderFeatureProvider;
featureProviderClassRegistry.registerClass(
  TileProviderFeatureProvider.className,
  TileProviderFeatureProvider,
);
