import type { Size } from 'ol/size.js';
import type {
  RasterLayerImplementationOptions,
  RasterLayerOptions,
} from './rasterLayer.js';
import RasterLayer, { TilingScheme } from './rasterLayer.js';
import OpenlayersMap from '../map/openlayersMap.js';
import CesiumMap from '../map/cesiumMap.js';
import TmsOpenlayersImpl from './openlayers/tmsOpenlayersImpl.js';
import TmsCesiumImpl from './cesium/tmsCesiumImpl.js';
import { layerClassRegistry } from '../classRegistry.js';
import type VcsMap from '../map/vcsMap.js';

export type TMSOptions = RasterLayerOptions & {
  format?: string;
  tileSize?: Size;
};

export type TMSImplementationOptions = RasterLayerImplementationOptions & {
  format: string;
  tileSize: Size;
};

/**
 * @group Layer
 */
class TMSLayer extends RasterLayer<TmsCesiumImpl | TmsOpenlayersImpl> {
  static get className(): string {
    return 'TMSLayer';
  }

  static getDefaultOptions(): TMSOptions {
    return {
      ...RasterLayer.getDefaultOptions(),
      tilingSchema: TilingScheme.MERCATOR,
      format: 'jpeg',
      tileSize: [256, 256],
    };
  }

  format: string;

  tileSize: Size;

  constructor(options: TMSOptions) {
    const defaultOptions = TMSLayer.getDefaultOptions();
    super({ ...defaultOptions, ...options });

    this._supportedMaps = [OpenlayersMap.className, CesiumMap.className];

    this.format = options.format || (defaultOptions.format as string);
    this.tileSize = Array.isArray(options.tileSize)
      ? options.tileSize.slice()
      : (defaultOptions.tileSize as Size);
  }

  getImplementationOptions(): TMSImplementationOptions {
    return {
      ...super.getImplementationOptions(),
      format: this.format,
      tileSize: this.tileSize,
    };
  }

  createImplementationsForMap(
    map: VcsMap,
  ): (TmsOpenlayersImpl | TmsCesiumImpl)[] {
    if (map instanceof OpenlayersMap) {
      return [new TmsOpenlayersImpl(map, this.getImplementationOptions())];
    }

    if (map instanceof CesiumMap) {
      return [new TmsCesiumImpl(map, this.getImplementationOptions())];
    }
    return [];
  }

  toJSON(defaultOptions = TMSLayer.getDefaultOptions()): TMSOptions {
    const config: TMSOptions = super.toJSON(defaultOptions);

    if (this.format !== defaultOptions.format) {
      config.format = this.format;
    }

    if (
      this.tileSize[0] !== defaultOptions?.tileSize?.[0] ||
      this.tileSize[1] !== defaultOptions.tileSize[1]
    ) {
      config.tileSize = this.tileSize.slice();
    }

    return config;
  }
}

layerClassRegistry.registerClass(TMSLayer.className, TMSLayer);
export default TMSLayer;
