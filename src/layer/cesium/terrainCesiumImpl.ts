import type { CesiumTerrainProvider } from '@vcmap-cesium/engine';
import LayerImplementation from '../layerImplementation.js';
import { vcsLayerName } from '../layerSymbols.js';
import { getTerrainProviderForUrl } from '../terrainHelpers.js';
import CesiumMap from '../../map/cesiumMap.js';
import type { TerrainImplementationOptions } from '../terrainLayer.js';

/**
 * TerrainLayer implementation for {@link CesiumMap}
 */
class TerrainCesiumImpl extends LayerImplementation<CesiumMap> {
  static get className(): string {
    return 'TerrainCesiumImpl';
  }

  requestVertexNormals: boolean;

  requestWaterMask: boolean;

  terrainProvider: CesiumTerrainProvider | undefined = undefined;

  constructor(map: CesiumMap, options: TerrainImplementationOptions) {
    super(map, options);

    this.requestVertexNormals = options.requestVertexNormals;
    this.requestWaterMask = options.requestWaterMask;
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      this.terrainProvider = await getTerrainProviderForUrl(
        this.url!,
        {
          requestVertexNormals: this.requestVertexNormals,
          requestWaterMask: this.requestWaterMask,
        },
        this.headers,
      );
      this.terrainProvider[vcsLayerName] = this.name;
    }
    return super.initialize();
  }

  async activate(): Promise<void> {
    await super.activate();
    if (this.active && this.terrainProvider) {
      this.map.setTerrainProvider(this.terrainProvider);
    }
  }

  deactivate(): void {
    super.deactivate();
    if (this.terrainProvider) {
      this.map.unsetTerrainProvider(this.terrainProvider);
    }
  }

  destroy(): void {
    if (this.terrainProvider) {
      this.map.unsetTerrainProvider(this.terrainProvider);
    }
    this.terrainProvider = undefined;
    super.destroy();
  }
}

export default TerrainCesiumImpl;
