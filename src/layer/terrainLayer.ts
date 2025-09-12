import { parseBoolean } from '@vcsuite/parsers';
import type { Coordinate } from 'ol/coordinate.js';
import type { LayerImplementationOptions, LayerOptions } from './layer.js';
import Layer from './layer.js';
import {
  getHeightFromTerrainProvider,
  getTerrainProviderForUrl,
} from './terrainHelpers.js';
import CesiumMap from '../map/cesiumMap.js';
import TerrainCesiumImpl from './cesium/terrainCesiumImpl.js';
import { layerClassRegistry } from '../classRegistry.js';
import type VcsMap from '../map/vcsMap.js';

export type TerrainOptions = LayerOptions & {
  requestVertexNormals?: boolean;
  requestWaterMask?: boolean;
};

export type TerrainImplementationOptions = LayerImplementationOptions & {
  requestVertexNormals: boolean;
  requestWaterMask: boolean;
};

/**
 * @group Layer
 */
class TerrainLayer extends Layer<TerrainCesiumImpl> {
  static get className(): string {
    return 'TerrainLayer';
  }

  static getDefaultOptions(): TerrainOptions {
    return {
      ...Layer.getDefaultOptions(),
      ignoreMapLayerTypes: true,
      requestVertexNormals: true,
      requestWaterMask: false,
    };
  }

  protected _supportedMaps = [CesiumMap.className];

  requestVertexNormals: boolean;

  requestWaterMask: boolean;

  constructor(options: TerrainOptions) {
    const defaultOptions = TerrainLayer.getDefaultOptions();
    super({ ...defaultOptions, ...options });

    this.requestVertexNormals = parseBoolean(
      options.requestVertexNormals,
      defaultOptions.requestVertexNormals,
    );
    this.requestWaterMask = parseBoolean(
      options.requestWaterMask,
      defaultOptions.requestWaterMask,
    );
  }

  getImplementationOptions(): TerrainImplementationOptions {
    return {
      ...super.getImplementationOptions(),
      requestVertexNormals: this.requestVertexNormals,
      requestWaterMask: this.requestWaterMask,
    };
  }

  createImplementationsForMap(map: VcsMap): TerrainCesiumImpl[] {
    if (map instanceof CesiumMap) {
      return [new TerrainCesiumImpl(map, this.getImplementationOptions())];
    }
    return [];
  }

  /**
   * getHeight for coordinates
   * @param  coords - the height is added to the coordinates in place
   */
  async getHeightForWGS84Coordinates(
    coords: Coordinate[],
  ): Promise<Coordinate[]> {
    const terrainProvider = await getTerrainProviderForUrl(
      this.url,
      {
        requestVertexNormals: this.requestVertexNormals,
        requestWaterMask: this.requestWaterMask,
      },
      this.headers,
    );
    return getHeightFromTerrainProvider(
      terrainProvider,
      coords,
      undefined,
      coords,
    );
  }

  toJSON(defaultOptions = TerrainLayer.getDefaultOptions()): TerrainOptions {
    const config: TerrainOptions = super.toJSON(defaultOptions);

    if (this.requestVertexNormals !== defaultOptions.requestVertexNormals) {
      config.requestVertexNormals = this.requestVertexNormals;
    }

    if (this.requestWaterMask !== defaultOptions.requestWaterMask) {
      config.requestWaterMask = this.requestWaterMask;
    }
    return config;
  }
}

layerClassRegistry.registerClass(TerrainLayer.className, TerrainLayer);
export default TerrainLayer;
