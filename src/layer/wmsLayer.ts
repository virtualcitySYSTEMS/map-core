import { check, oneOf } from '@vcsuite/check';
import { parseBoolean } from '@vcsuite/parsers';
import type { Size } from 'ol/size.js';

import type {
  RasterLayerImplementationOptions,
  RasterLayerOptions,
} from './rasterLayer.js';
import RasterLayer from './rasterLayer.js';
import type { WMSFeatureProviderOptions } from '../featureProvider/wmsFeatureProvider.js';
import WMSFeatureProvider from '../featureProvider/wmsFeatureProvider.js';
import CesiumMap from '../map/cesiumMap.js';
import WmsCesiumImpl from './cesium/wmsCesiumImpl.js';
import OpenlayersMap from '../map/openlayersMap.js';
import WmsOpenlayersImpl from './openlayers/wmsOpenlayersImpl.js';
import Extent from '../util/extent.js';
import { layerClassRegistry } from '../classRegistry.js';
import type VcsMap from '../map/vcsMap.js';

export type WMSImplementationOptions = RasterLayerImplementationOptions & {
  parameters: Record<string, string>;
  highResolution: boolean;
  tileSize: Size;
  version: string;
  singleImage2d: boolean;
};

export type WMSOptions = RasterLayerOptions & {
  /**
   *  string with comma separated names of the layers to display
   */
  layers?: string;
  /**
   * WMS version (either 1.1.1 (default) or 1.3.0)
   * @default '1.1.1'
   */
  version?: string;
  /**
   * key value pair of additional WMS parameters, url query notation possible
   */
  parameters?: Record<string, string> | string;

  /**
   * whether this layer should send getFeatureInfo requests to the service when objects are clicked.
   */
  featureInfo?: Partial<WMSFeatureProviderOptions>;
  /**
   * @default [256, 256]
   */
  tileSize?: Size;
  /**
   * use higher resolution images (sofar only in 3D)
   */
  highResolution?: boolean;
  /**
   * Use a single image in 2D
   */
  singleImage2d?: boolean;
};

/**
 * WmsLayer layer for Cesium and OpenlayersMap
 * @group Layer
 */
class WMSLayer extends RasterLayer<WmsCesiumImpl | WmsOpenlayersImpl> {
  static get className(): string {
    return 'WMSLayer';
  }

  static getDefaultOptions(): WMSOptions {
    return {
      ...RasterLayer.getDefaultOptions(),
      version: '1.1.1',
      parameters: undefined,
      featureInfo: undefined,
      tileSize: [256, 256],
      highResolution: false,
      layers: '',
      singleImage2d: false,
    };
  }

  version: string;

  parameters: Record<string, string>;

  tileSize: Size;

  highResolution: boolean;

  singleImage2d: boolean;

  private _featureInfoOptions: Partial<WMSFeatureProviderOptions> | undefined;

  /**
   * @param  options
   */
  constructor(options: WMSOptions) {
    super(options);
    const defaultOptions = WMSLayer.getDefaultOptions();

    this.version = options.version || (defaultOptions.version as string);

    this.parameters = {};
    if (options.parameters) {
      let parsedParameters: Record<string, string> = {};
      if (typeof options.parameters === 'string') {
        parsedParameters = Object.fromEntries(
          new URLSearchParams(options.parameters),
        );
      } else if (options.parameters instanceof Object) {
        parsedParameters = options.parameters;
      }
      Object.keys(parsedParameters).forEach((key) => {
        this.parameters[key.toUpperCase()] = parsedParameters[key];
      });
    }

    if (this.parameters.TRANSPARENT == null) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.parameters.TRANSPARENT = false;
    }
    if (this.version) {
      this.parameters.VERSION = this.version;
    }
    this.parameters.LAYERS =
      options.layers || (defaultOptions.layers as string);

    this.tileSize = options.tileSize || (defaultOptions.tileSize as Size);
    this.highResolution = parseBoolean(
      options.highResolution,
      defaultOptions.highResolution,
    );

    this._featureInfoOptions =
      options.featureInfo || defaultOptions.featureInfo;
    this._supportedMaps = [CesiumMap.className, OpenlayersMap.className];
    this.singleImage2d = parseBoolean(
      options.singleImage2d,
      defaultOptions.singleImage2d,
    );
  }

  initialize(): Promise<void> {
    if (!this.initialized) {
      this._setFeatureProvider();
    }
    return super.initialize();
  }

  /**
   * Sets a FeatureProvider if provided with featureInfo options
   */
  private _setFeatureProvider(): void {
    if (this._featureInfoOptions) {
      const options: WMSFeatureProviderOptions = {
        url: this.url,
        tilingSchema: this.tilingSchema,
        maxLevel: this.maxLevel,
        minLevel: this.minLevel,
        tileSize: this.tileSize,
        extent: this.extent,
        parameters: this.parameters,
        version: this.version,
        ...this._featureInfoOptions,
      };
      this.featureProvider = new WMSFeatureProvider(this.name, options);
    }
  }

  async reload(): Promise<void> {
    if (this.featureProvider && this._featureInfoOptions) {
      this.featureProvider.destroy();
      this._setFeatureProvider();
    }
    return super.reload();
  }

  getImplementationOptions(): WMSImplementationOptions {
    return {
      ...super.getImplementationOptions(),
      version: this.version,
      parameters: this.parameters,
      highResolution: this.highResolution,
      tileSize: this.tileSize,
      singleImage2d: this.singleImage2d,
    };
  }

  createImplementationsForMap(
    map: VcsMap,
  ): (WmsCesiumImpl | WmsOpenlayersImpl)[] {
    if (map instanceof CesiumMap) {
      return [new WmsCesiumImpl(map, this.getImplementationOptions())];
    } else if (map instanceof OpenlayersMap) {
      return [new WmsOpenlayersImpl(map, this.getImplementationOptions())];
    }
    return [];
  }

  /**
   * Sets the layers to request from the WmsLayer
   * @param  layers - a layer name or an array of layer names
   */
  async setLayers(layers: string | string[]): Promise<void> {
    check(layers, oneOf(String, [String]));
    const layersArray = Array.isArray(layers) ? layers : [layers];
    this.parameters.LAYERS = layersArray.join(',');
    await this.forceRedraw();
  }

  /**
   * Returns the currently active layers
   */
  getLayers(): string[] {
    return this.parameters.LAYERS ? this.parameters.LAYERS.split(',') : [];
  }

  toJSON(): WMSOptions {
    const config: WMSOptions = super.toJSON();
    const defaultOptions = WMSLayer.getDefaultOptions();

    if (this.parameters.LAYERS) {
      config.layers = this.parameters.LAYERS;
    }

    if (this.version !== defaultOptions.version) {
      config.version = this.version;
    }

    const parameters = { ...this.parameters };
    delete parameters.VERSION;
    delete parameters.LAYERS;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (parameters.TRANSPARENT === false) {
      delete parameters.TRANSPARENT;
    }

    if (Object.keys(parameters).length > 0) {
      config.parameters = parameters;
    }

    if (this.version !== defaultOptions.version) {
      config.version = this.version;
    }

    if (this.highResolution !== defaultOptions.highResolution) {
      config.highResolution = this.highResolution;
    }

    if (
      this.tileSize[0] !== defaultOptions?.tileSize?.[0] ||
      this.tileSize[1] !== defaultOptions.tileSize[1]
    ) {
      config.tileSize = this.tileSize.slice();
    }

    if (this.singleImage2d !== defaultOptions.singleImage2d) {
      config.singleImage2d = this.singleImage2d;
    }

    if (
      this.featureProvider &&
      this.featureProvider instanceof WMSFeatureProvider
    ) {
      const featureInfoConfig: Partial<WMSFeatureProviderOptions> =
        this.featureProvider.toJSON();
      if (
        this.tileSize[0] === featureInfoConfig?.tileSize?.[0] ||
        this.tileSize[1] === featureInfoConfig?.tileSize?.[1]
      ) {
        delete featureInfoConfig.tileSize;
      }
      if (
        Object.entries(this.parameters).every(
          ([key, value]) => featureInfoConfig?.parameters?.[key] === value,
        )
      ) {
        delete featureInfoConfig.parameters;
      }
      if (
        featureInfoConfig.extent &&
        new Extent(featureInfoConfig.extent).equals(this.extent)
      ) {
        delete featureInfoConfig.extent;
      }
      if (this.url === featureInfoConfig.url) {
        delete featureInfoConfig.url;
      }
      if (this.tilingSchema === featureInfoConfig.tilingSchema) {
        delete featureInfoConfig.tilingSchema;
      }
      if (this.version === featureInfoConfig.version) {
        delete featureInfoConfig.version;
      }
      if (this.minLevel === featureInfoConfig.minLevel) {
        delete featureInfoConfig.minLevel;
      }
      if (this.maxLevel === featureInfoConfig.maxLevel) {
        delete featureInfoConfig.maxLevel;
      }
      config.featureInfo = featureInfoConfig;
    } else if (this._featureInfoOptions) {
      config.featureInfo = this._featureInfoOptions;
    }

    return config;
  }
}

layerClassRegistry.registerClass(WMSLayer.className, WMSLayer);
export default WMSLayer;
