import { parseInteger } from '@vcsuite/parsers';
import { getLogger } from '@vcsuite/logger';
import type LayerGroup from 'ol/layer/Group.js';
import { getCenter, buffer } from 'ol/extent.js';
import LRUCache from 'ol/structs/LRUCache.js';
import OLMap from 'ol/Map.js';
import { rectangleToMercatorExtent } from '../../util/math.js';
import VectorTileImageryProvider from './vectorTileImageryProvider.js';
import type { VectorTileImageryProviderOptions } from './vectorTileImageryProvider.js';

export type MapboxStyleImageryProviderOptions =
  VectorTileImageryProviderOptions & {
    styledMapboxLayerGroup: LayerGroup;
    minimumTerrainLevel?: number;
    maximumTerrainLevel?: number;
    tileCacheSize?: number;
  };

function getTileCacheKey(x: number, y: number, level: number): string {
  return `${x}-${y}-${level}`;
}

function getGutterSize(level: number): number {
  if (level < 12) {
    return 32;
  }
  if (level < 15) {
    return 48;
  }
  return 64;
}

/**
 * Implementation of Cesium ImageryProvider Interface for Mapbox Style Tiles
 */
class MapboxStyleImageryProvider extends VectorTileImageryProvider {
  static get className(): string {
    return 'MapboxStyleImageryProvider';
  }

  private _tileCacheByLevel: Map<number, LRUCache<HTMLCanvasElement>>;

  private _maxCacheSize: number;

  private _isRendering = false;

  private _renderMap = new OLMap({
    target: document.createElement('div'),
  });

  constructor(options: MapboxStyleImageryProviderOptions) {
    super(options);

    this._tileCacheByLevel = new Map();
    this._maxCacheSize = parseInteger(options.tileCacheSize, 100);
    this._renderMap.addLayer(options.styledMapboxLayerGroup);
  }

  requestImage(
    x: number,
    y: number,
    level: number,
  ): Promise<HTMLImageElement | HTMLCanvasElement> | undefined {
    const cacheKey = getTileCacheKey(x, y, level);
    const levelCache = this._getLevelCache(level);
    if (levelCache.containsKey(cacheKey)) {
      return Promise.resolve(levelCache.get(cacheKey));
    }
    if (this._isRendering) {
      return undefined;
    }
    return this._doRequestImage(x, y, level, cacheKey);
  }

  private async _doRequestImage(
    x: number,
    y: number,
    level: number,
    cacheKey: string,
  ): Promise<HTMLImageElement | HTMLCanvasElement> {
    const { tilingScheme } = this.tileProvider;
    const rectangle = tilingScheme.tileXYToRectangle(x, y, level);
    const extent = rectangleToMercatorExtent(rectangle);

    // Add gutters to prevent labels from being cut off
    const gutterSize = getGutterSize(level);
    const gutter = ((extent[2] - extent[0]) / this.tileWidth) * gutterSize;
    const expandedExtent = buffer(extent, gutter);

    const renderedTile = await this._renderTile(
      level,
      expandedExtent,
      gutterSize,
    );
    const levelCache = this._getLevelCache(level);
    levelCache.set(cacheKey, renderedTile);
    levelCache.expireCache();
    return renderedTile;
  }

  private _getLevelCache(level: number): LRUCache<HTMLCanvasElement> {
    const existing = this._tileCacheByLevel.get(level);
    if (existing) {
      return existing;
    }
    const cache = new LRUCache<HTMLCanvasElement>(this._maxCacheSize);
    this._tileCacheByLevel.set(level, cache);
    return cache;
  }

  private _renderTile(
    level: number,
    extent: number[],
    gutterSize: number,
  ): Promise<HTMLCanvasElement> {
    const TIMEOUT_MS = 2500;
    return new Promise((resolve) => {
      this._isRendering = true;
      let isFinished = false;
      const finish = (canvas: HTMLCanvasElement): void => {
        if (isFinished) {
          return;
        }
        isFinished = true;
        this._isRendering = false;
        resolve(canvas);
      };

      try {
        if (!this._renderMap) {
          finish(this.emptyCanvas);
          return;
        }

        const renderWidth = this.tileWidth + 2 * gutterSize;
        const renderHeight = this.tileHeight + 2 * gutterSize;

        const view = this._renderMap.getView();
        view.setCenter(getCenter(extent));
        view.setZoom(level);
        this._renderMap.setSize([renderWidth, renderHeight]);

        const handleRenderComplete = (): void => {
          this._renderMap?.un('rendercomplete', handleRenderComplete);

          const renderedCanvas = this._renderMap
            ?.getViewport()
            .querySelector('canvas');

          if (!renderedCanvas) {
            finish(this.emptyCanvas);
            return;
          }

          // Crop the canvas to extract the center portion (original tile size)
          const tileCanvas = document.createElement('canvas');
          tileCanvas.width = this.tileWidth;
          tileCanvas.height = this.tileHeight;
          const ctx = tileCanvas.getContext('2d');
          if (ctx) {
            const scaleX = renderedCanvas.width / renderWidth;
            const scaleY = renderedCanvas.height / renderHeight;
            ctx.drawImage(
              renderedCanvas,
              gutterSize * scaleX,
              gutterSize * scaleY,
              this.tileWidth * scaleX,
              this.tileHeight * scaleY,
              0,
              0,
              this.tileWidth,
              this.tileHeight,
            );
          }

          finish(tileCanvas);
        };

        const timeoutId = window.setTimeout(() => {
          this._renderMap?.un('rendercomplete', handleRenderComplete);
          getLogger('MapboxVectorTileImageryProvider').warning(
            'Tile render timed out; returning empty tile.',
          );
          finish(this.emptyCanvas);
        }, TIMEOUT_MS);

        const wrappedHandleRenderComplete = (): void => {
          window.clearTimeout(timeoutId);
          handleRenderComplete();
        };

        this._renderMap.once('rendercomplete', wrappedHandleRenderComplete);
        this._renderMap.render();
      } catch (e: unknown) {
        getLogger('MapboxVectorTileImageryProvider').error(
          `Error rendering tile: ${(e as Error).message}`,
        );
        finish(this.emptyCanvas);
      }
    });
  }

  destroy(): void {
    for (const cache of this._tileCacheByLevel.values()) {
      cache.clear();
    }
    this._tileCacheByLevel.clear();
    this._isRendering = false;
    this._renderMap?.setTarget(undefined);
    this._renderMap?.dispose();
  }
}

export default MapboxStyleImageryProvider;
