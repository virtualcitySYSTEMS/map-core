import type { TilingScheme } from '@vcmap-cesium/engine';
import OLMap from 'ol/Map.js';
import LRUCache from 'ol/structs/LRUCache.js';
import { buffer, type Extent, getCenter } from 'ol/extent.js';
import { getLogger } from '@vcsuite/logger';
import { parseInteger } from '@vcsuite/parsers';
import { rectangleToMercatorExtent } from '../../../util/math.js';

export type OLImageRenderer = {
  readonly isRendering: boolean;
  readonly map: OLMap;
  requestImage(
    x: number,
    y: number,
    level: number,
  ): Promise<HTMLImageElement | HTMLCanvasElement> | undefined;
  destroy(): void;
};

export type OLImageRendererOptions = {
  tilingScheme: TilingScheme;
  tileWidth: number;
  tileHeight: number;
  emptyCanvas: HTMLCanvasElement;
  tileCacheSize?: number;
  fetchFeatures?: (
    x: number,
    y: number,
    level: number,
    extent: Extent,
  ) => Promise<void>;
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

export function createOLImageRenderer(
  options: OLImageRendererOptions,
): OLImageRenderer {
  const maxCacheSize = parseInteger(options.tileCacheSize, 100);
  const { tilingScheme, tileWidth, tileHeight, emptyCanvas, fetchFeatures } =
    options;
  const renderMap = new OLMap({
    target: document.createElement('div'),
  });
  const tileCacheByLevel = new Map<number, LRUCache<HTMLCanvasElement>>();

  let isRendering = false;

  function getLevelCache(level: number): LRUCache<HTMLCanvasElement> {
    const existing = tileCacheByLevel.get(level);
    if (existing) {
      return existing;
    }
    const cache = new LRUCache<HTMLCanvasElement>(maxCacheSize);
    tileCacheByLevel.set(level, cache);
    return cache;
  }

  function renderTile(
    level: number,
    extent: Extent,
    gutterSize: number,
  ): Promise<HTMLCanvasElement> {
    const TIMEOUT_MS = 2500;
    return new Promise((resolve) => {
      let isFinished = false;
      const finish = (canvas: HTMLCanvasElement): void => {
        if (isFinished) {
          return;
        }
        isFinished = true;
        resolve(canvas);
      };

      try {
        if (!renderMap) {
          finish(emptyCanvas);
          return;
        }

        const renderWidth = tileWidth + 2 * gutterSize;
        const renderHeight = tileHeight + 2 * gutterSize;

        const view = renderMap.getView();
        view.setCenter(getCenter(extent));
        view.setZoom(level);
        renderMap.setSize([renderWidth, renderHeight]);

        const handleRenderComplete = (): void => {
          renderMap?.un('rendercomplete', handleRenderComplete);

          const renderedCanvas = renderMap
            ?.getViewport()
            .querySelector('canvas');

          if (!renderedCanvas) {
            finish(emptyCanvas);
            return;
          }

          // Crop the canvas to extract the center portion (original tile size)
          const tileCanvas = document.createElement('canvas');
          tileCanvas.width = tileWidth;
          tileCanvas.height = tileHeight;
          const ctx = tileCanvas.getContext('2d');
          if (ctx) {
            const scaleX = renderedCanvas.width / renderWidth;
            const scaleY = renderedCanvas.height / renderHeight;
            ctx.drawImage(
              renderedCanvas,
              gutterSize * scaleX,
              gutterSize * scaleY,
              tileWidth * scaleX,
              tileHeight * scaleY,
              0,
              0,
              tileWidth,
              tileHeight,
            );
          }

          finish(tileCanvas);
        };

        const timeoutId = window.setTimeout(() => {
          renderMap?.un('rendercomplete', handleRenderComplete);
          getLogger('MapboxVectorTileImageryProvider').warning(
            'Tile render timed out; returning empty tile.',
          );
          finish(emptyCanvas);
        }, TIMEOUT_MS);

        const wrappedHandleRenderComplete = (): void => {
          window.clearTimeout(timeoutId);
          handleRenderComplete();
        };

        renderMap.once('rendercomplete', wrappedHandleRenderComplete);
        renderMap.render();
      } catch (e: unknown) {
        getLogger('MapboxVectorTileImageryProvider').error(
          `Error rendering tile: ${(e as Error).message}`,
        );
        finish(emptyCanvas);
      }
    });
  }

  async function doRequestImage(
    x: number,
    y: number,
    level: number,
    cacheKey: string,
  ): Promise<HTMLImageElement | HTMLCanvasElement> {
    const rectangle = tilingScheme.tileXYToRectangle(x, y, level);
    const extent = rectangleToMercatorExtent(rectangle);

    // Add gutters to prevent labels from being cut off
    const gutterSize = getGutterSize(level);
    const gutter = ((extent[2] - extent[0]) / tileWidth) * gutterSize;
    const expandedExtent = buffer(extent, gutter);

    isRendering = true;
    if (fetchFeatures) {
      await fetchFeatures(x, y, level, expandedExtent);
    }
    const renderedTile = await renderTile(level, expandedExtent, gutterSize);
    isRendering = false;
    const levelCache = getLevelCache(level);
    levelCache.set(cacheKey, renderedTile);
    levelCache.expireCache();
    return renderedTile;
  }

  return {
    get map(): OLMap {
      return renderMap;
    },
    get isRendering(): boolean {
      return isRendering;
    },
    requestImage(
      x: number,
      y: number,
      level: number,
    ): Promise<HTMLImageElement | HTMLCanvasElement> | undefined {
      const cacheKey = getTileCacheKey(x, y, level);
      const levelCache = getLevelCache(level);
      if (levelCache.containsKey(cacheKey)) {
        return Promise.resolve(levelCache.get(cacheKey));
      }
      if (isRendering) {
        return undefined;
      }
      return doRequestImage(x, y, level, cacheKey);
    },
    destroy(): void {
      for (const cache of tileCacheByLevel.values()) {
        cache.clear();
      }
      tileCacheByLevel.clear();
      isRendering = false;
      renderMap.setTarget(undefined);
      renderMap.dispose();
    },
  };
}
