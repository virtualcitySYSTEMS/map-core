import { parseBoolean } from '@vcsuite/parsers';
import deepEqual from 'fast-deep-equal';
import type { Size } from 'ol/size.js';
import type {
  RasterLayerImplementationOptions,
  RasterLayerOptions,
} from './rasterLayer.js';
import RasterLayer, { TilingScheme } from './rasterLayer.js';
import type VcsMap from '../map/vcsMap.js';
import BaseCesiumMap from '../map/baseCesiumMap.js';
import CesiumMap from '../map/cesiumMap.js';
import OpenlayersMap from '../map/openlayersMap.js';
import PanoramaMap from '../map/panoramaMap.js';
import OGCMapOpenlayersImpl from './openlayers/ogcMapOpenlayersImpl.js';
import OGCMapCesiumImpl from './cesium/ogcMapCesiumImpl.js';
import { layerClassRegistry } from '../classRegistry.js';
import type { OGCParameters } from './ogcHelpers.js';

export type OGCMapOptions = RasterLayerOptions & {
  tileSize?: Size;
  /** Use a single image in OpenLayers instead of tiles. */
  singleImage2d?: boolean;
  /** Style identifier to request from the OGC API - Maps service. */
  styleId?: string;
  /**
   * Query parameters to request, e.g. `datetime`, `collections`, `transparent` or `bgcolor`.
   */
  parameters?: OGCParameters;
};

export type OGCMapImplementationOptions = RasterLayerImplementationOptions & {
  tileSize: Size;
  singleImage2d: boolean;
  styleId?: string;
  parameters: OGCParameters;
};

/**
 * Displays map images from an OGC API - Maps service in 2D or 3D. The
 * url should point to a service resource with a `/map` endpoint; the layer appends
 * `/map` and requests images using `bbox`, `bbox-crs`, `crs`, `width`, and `height`.
 * The service must support the CRS selected by `tilingSchema` (CRS84 or EPSG:3857).
 * Further query parameters, such as `datetime`, `collections` or `bgcolor`, are passed
 * with `parameters` and require corresponding service support.
 * @group Layer
 */
class OGCMapLayer extends RasterLayer<OGCMapOpenlayersImpl | OGCMapCesiumImpl> {
  static get className(): string {
    return 'OGCMapLayer';
  }

  static getDefaultOptions(): OGCMapOptions {
    return {
      ...RasterLayer.getDefaultOptions(),
      tilingSchema: TilingScheme.MERCATOR,
      tileSize: [256, 256],
      singleImage2d: false,
      styleId: undefined,
      parameters: {},
    };
  }

  tileSize: Size;

  singleImage2d: boolean;

  private _styleId: string | undefined;

  private _parameters: OGCParameters;

  constructor(options: OGCMapOptions) {
    const defaultOptions = OGCMapLayer.getDefaultOptions();
    super({ ...defaultOptions, ...options });

    this._supportedMaps = [
      OpenlayersMap.className,
      CesiumMap.className,
      PanoramaMap.className,
    ];

    this.tileSize = Array.isArray(options.tileSize)
      ? options.tileSize.slice()
      : (defaultOptions.tileSize as Size);
    this.singleImage2d = parseBoolean(
      options.singleImage2d,
      defaultOptions.singleImage2d,
    );
    this._styleId = options.styleId;
    this._parameters = structuredClone(options.parameters ?? {});
  }

  get styleId(): string | undefined {
    return this._styleId;
  }

  set styleId(styleId: string | undefined) {
    if (this._styleId !== styleId) {
      const currentValue = this._styleId;
      this._styleId = styleId;
      this.reload().catch((err: unknown) => {
        this.getLogger().error('failed to reload after styleId setting', err);
        this._styleId = currentValue;
      });
    }
  }

  /**
   * A copy of the query parameters. Changing it has no effect, assign the changed copy to apply it:
   * `layer.parameters = { ...layer.parameters, datetime: '2026-04-12T12:00Z' }`
   */
  get parameters(): OGCParameters {
    return structuredClone(this._parameters);
  }

  set parameters(parameters: OGCParameters) {
    const newParameters = structuredClone(parameters);
    if (!deepEqual(this._parameters, newParameters)) {
      const currentValue = this._parameters;
      this._parameters = newParameters;
      this.reload().catch((err: unknown) => {
        this.getLogger().error(
          'failed to reload after parameters setting',
          err,
        );
        this._parameters = currentValue;
      });
    }
  }

  getImplementationOptions(): OGCMapImplementationOptions {
    return {
      ...super.getImplementationOptions(),
      tileSize: this.tileSize,
      singleImage2d: this.singleImage2d,
      styleId: this.styleId,
      parameters: this.parameters,
    };
  }

  createImplementationsForMap(
    map: VcsMap,
  ): (OGCMapOpenlayersImpl | OGCMapCesiumImpl)[] {
    if (map instanceof BaseCesiumMap) {
      return [new OGCMapCesiumImpl(map, this.getImplementationOptions())];
    }
    if (map instanceof OpenlayersMap) {
      return [new OGCMapOpenlayersImpl(map, this.getImplementationOptions())];
    }
    return [];
  }

  toJSON(defaultOptions = OGCMapLayer.getDefaultOptions()): OGCMapOptions {
    const config: OGCMapOptions = super.toJSON(defaultOptions);

    if (this.singleImage2d !== defaultOptions.singleImage2d) {
      config.singleImage2d = this.singleImage2d;
    }

    if (this.styleId !== defaultOptions.styleId) {
      config.styleId = this.styleId;
    }

    if (
      this.tileSize[0] !== defaultOptions.tileSize?.[0] ||
      this.tileSize[1] !== defaultOptions.tileSize?.[1]
    ) {
      config.tileSize = this.tileSize.slice();
    }

    if (Object.keys(this._parameters).length > 0) {
      config.parameters = structuredClone(this._parameters);
    }

    return config;
  }
}

layerClassRegistry.registerClass(OGCMapLayer.className, OGCMapLayer);
export default OGCMapLayer;
