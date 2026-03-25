import type LayerGroup from 'ol/layer/Group.js';
import type { VectorTileImageryProviderOptions } from './vectorTileImageryProvider.js';
import {
  createOLImageRenderer,
  type OLImageRenderer,
} from './olImageRenderer.js';
import AbstractVcsImageryProvider from './abstractVcsImageryProvider.js';
import type TileProvider from '../../tileProvider/tileProvider.js';

export type MapboxStyleImageryProviderOptions =
  VectorTileImageryProviderOptions & {
    styledMapboxLayerGroup: LayerGroup;
    minimumTerrainLevel?: number;
    maximumTerrainLevel?: number;
    tileCacheSize?: number;
  };

/**
 * Implementation of Cesium ImageryProvider Interface for Mapbox Style Tiles
 */
class MapboxStyleImageryProvider extends AbstractVcsImageryProvider {
  static get className(): string {
    return 'MapboxStyleImageryProvider';
  }

  tileProvider: TileProvider;

  private _olImageRenderer: OLImageRenderer;

  constructor(options: MapboxStyleImageryProviderOptions) {
    super({
      tilingScheme: options.tileProvider.tilingScheme,
      tileSize: options.tileSize,
      minLevel: 0,
      maxLevel: 26,
    });

    this.tileProvider = options.tileProvider;

    this._olImageRenderer = createOLImageRenderer({
      tilingScheme: this.tileProvider.tilingScheme,
      tileWidth: this.tileWidth,
      tileHeight: this.tileHeight,
      tileCacheSize: options.tileCacheSize,
      emptyCanvas: this.emptyCanvas,
    });
    this._olImageRenderer.map.addLayer(options.styledMapboxLayerGroup);
  }

  requestImage(
    x: number,
    y: number,
    level: number,
  ): Promise<HTMLImageElement | HTMLCanvasElement> | undefined {
    return this._olImageRenderer.requestImage(x, y, level);
  }

  destroy(): void {
    this._olImageRenderer.destroy();
  }
}

export default MapboxStyleImageryProvider;
