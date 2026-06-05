import {
  ImageryLayer as CesiumImageryLayer,
  Rectangle,
} from '@vcmap-cesium/engine';
import type { Size } from 'ol/size.js';

import VectorTileImageryProvider from './imageryProvider/vectorTileImageryProvider.js';
import RasterLayerCesiumImpl from './rasterLayerCesiumImpl.js';
import { wgs84Projection } from '../../util/projection.js';
import type { VectorTileImplementationOptions } from '../vectorTileLayer.js';
import type CesiumMap from '../../map/cesiumMap.js';
import {
  type RasterLayerImplementationOptions,
  TilingScheme,
} from '../rasterLayer.js';
import type TileProvider from '../tileProvider/tileProvider.js';
import type StyleItem from '../../style/styleItem.js';
import type AbstractVcsImageryProvider from './imageryProvider/abstractVcsImageryProvider.js';

/**
 * represents a rasterized tiled vector layer implementation for cesium.
 */
class VectorRasterTileCesiumImpl extends RasterLayerCesiumImpl {
  static get className(): string {
    return 'VectorRasterTileCesiumImpl';
  }

  tileProvider: TileProvider;

  tileSize: Size;

  private _reloadTimeout: number | undefined = undefined;

  imageryProvider: undefined | AbstractVcsImageryProvider = undefined;

  constructor(map: CesiumMap, options: VectorTileImplementationOptions) {
    const minRenderingLevel = options.minLevel;
    const maxRenderingLevel = options.maxLevel;
    const rasterLayerOptions: RasterLayerImplementationOptions = {
      maxLevel: 25,
      minLevel: 0,
      ...options,
      minRenderingLevel,
      maxRenderingLevel,
      tilingSchema: TilingScheme.MERCATOR,
      opacity: 1,
    };
    super(map, rasterLayerOptions);
    this.tileProvider = options.tileProvider;
    this.tileSize = options.tileSize;
  }

  protected _getImageryProvider(): AbstractVcsImageryProvider {
    return new VectorTileImageryProvider({
      tileProvider: this.tileProvider,
      tileSize: this.tileSize,
      headers: this.headers,
    });
  }

  getCesiumLayer(): Promise<CesiumImageryLayer> {
    this.imageryProvider = this._getImageryProvider();

    const layerOptions = this.getCesiumLayerOptions();
    if (this.extent && this.extent.isValid()) {
      const extent = this.extent.getCoordinatesInProjection(wgs84Projection);
      layerOptions.rectangle = Rectangle.fromDegrees(
        extent[0],
        extent[1],
        extent[2],
        extent[3],
      );
    }
    return Promise.resolve(
      new CesiumImageryLayer(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.imageryProvider,
        layerOptions,
      ),
    );
  }

  /**
   * reloads the tiles
   */
  private _reloadTiles(): void {
    window.clearTimeout(this._reloadTimeout);
    // eslint-disable-next-line no-underscore-dangle
    if (this.imageryProvider && this.imageryProvider._reload) {
      this._reloadTimeout = window.setTimeout(() => {
        // todo find a way to reload specific tiles
        // eslint-disable-next-line no-underscore-dangle
        this.imageryProvider?._reload?.();
        this._reloadTimeout = undefined;
      });
    }
  }

  /**
   * rerenders the specified tiles
   * rendering happens async
   */
  updateTiles(tileIds: string[]): void {
    if (tileIds.length > 0) {
      this._reloadTiles();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateStyle(_style: StyleItem, _silent?: boolean): void {
    this._reloadTiles();
  }

  destroy(): void {
    this.imageryProvider?.destroy();
    super.destroy();
  }
}

export default VectorRasterTileCesiumImpl;
