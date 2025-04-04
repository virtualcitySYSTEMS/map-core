import LRUCache from 'ol/structs/LRUCache.js';
import { Matrix4 } from '@vcmap-cesium/engine';
import { getLogger } from '@vcsuite/logger';
import type { GeoTIFFImage } from 'geotiff';
import { Pool } from 'geotiff';
import type { PanoramaTile, TileCoordinate, TileSize } from './panoramaTile.js';
import { createPanoramaTile } from './panoramaTile.js';
import VcsEvent from '../vcsEvent.js';

export type PanoramaTileProvider = {
  destroy(): void;
  /**
   * Load the tiles for the given tile coordinates. Last coordinates get loaded first, LIFO
   * @param tileCoordinate
   */
  loadTiles(tileCoordinate: TileCoordinate[]): void;
  readonly loading: boolean;
  tileLoaded: VcsEvent<PanoramaTile>;
  tileError: VcsEvent<{ tileCoordinate: TileCoordinate; error: Error }>;
  allTilesLoaded: VcsEvent<void>;
};

class PanoramaTileCache extends LRUCache<PanoramaTile> {
  deleteOldest(): void {
    const entry = this.pop();
    if (entry) {
      entry.destroy();
    }
  }

  expireCache(usedTiles: Record<string, boolean> = {}): void {
    while (this.canExpireCache()) {
      const tile = this.peekLast();
      if (usedTiles[tile.tileCoordinate.key]) {
        break;
      } else {
        this.pop().destroy();
      }
    }
  }
}

function addTileToCache(
  tile: PanoramaTile,
  cache: PanoramaTileCache,
  currentlyVisibleTileKeys: Record<string, boolean>,
): void {
  cache.set(tile.tileCoordinate.key, tile);
  cache.expireCache(currentlyVisibleTileKeys);
}

export type ImageBitmapDecoder = {
  decode(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fileDirectory: any,
    buffer: ArrayBuffer,
  ): Promise<ImageBitmap>;
};

let defaultPool: Pool | undefined;
function getDefaultPool(): Pool {
  if (!defaultPool) {
    let workerUrl: URL | string;
    if (window.vcs.workerBase) {
      workerUrl = new URL(
        `${window.vcs.workerBase}/webp.js`,
        window.location.href,
      );
    } else {
      workerUrl = new URL('../workers/webp.js', import.meta.url);
    }

    defaultPool = new Pool(undefined, () => {
      return new Worker(workerUrl, {
        type: 'module',
      });
    });
  }
  return defaultPool;
}

/**
 * Creates a panorama tile provider for the given images.
 * @param levelImages - the images ordered by level. lowest level (smallest overview) first. that level is given by minLevel. all other levels must be consecutive.
 * @param modelMatrix - the model matrix of the image
 * @param tileSize - the size of the tile in pixels
 * @param minLevel - the minimum level of the images
 * @param maxCacheSize - the cache size for the number of tiles to cache. (LRU cache in use)
 * @param concurrency - the number of concurrent web requests to load tiles with
 * @param poolOrDecoder - an optional pool to decode directly to image bitmaps. most scenarios will use the default, mainly used for headless testing
 */
export function createPanoramaTileProvider(
  levelImages: GeoTIFFImage[],
  modelMatrix: Matrix4,
  tileSize: TileSize,
  minLevel: number,
  maxCacheSize?: number,
  concurrency = 6,
  poolOrDecoder: Pool | ImageBitmapDecoder = getDefaultPool(),
): PanoramaTileProvider {
  const cache = new PanoramaTileCache(maxCacheSize);
  let currentlyVisibleTiles: Record<string, boolean> = {};
  let abortController: AbortController | null = null;
  let loading = false;

  const tileLoaded = new VcsEvent<PanoramaTile>();
  const tileError = new VcsEvent<{
    tileCoordinate: TileCoordinate;
    error: Error;
  }>();
  const allTilesLoaded = new VcsEvent<void>();

  const destroy = (): void => {
    cache.clear();
  };

  const loadTile = async (
    tileCoordinate: TileCoordinate,
    abort: AbortSignal,
  ): Promise<PanoramaTile | null | Error> => {
    const levelImage = levelImages[tileCoordinate.level - minLevel];
    if (levelImage) {
      const tile = await levelImage.getTileOrStrip(
        tileCoordinate.x,
        tileCoordinate.y,
        levelImage.getSamplesPerPixel(),
        poolOrDecoder,
        // {
        //   // @ts-ignore
        //   decode: (_fi, buff): Promise<ArrayBuffer> =>
        //     // @ts-ignore
        //     createImageBitmap(new Blob([buff]), 0, 0, tileSize[0], tileSize[1]),
        // },
        abort,
      );

      return createPanoramaTile(
        tileCoordinate,
        tile.data as unknown as ImageBitmap,
        modelMatrix,
        tileSize,
      );
    }
    return null;
  };

  const loadTilesQueue = (
    tileCoordinates: TileCoordinate[],
    abortSignal: AbortSignal,
  ): void => {
    let currentTileIndex = tileCoordinates.length - 1;
    async function* loadNextTileGenerator(): AsyncGenerator<void> {
      while (currentTileIndex >= 0 && !abortSignal.aborted) {
        const tileCoordinate = tileCoordinates[currentTileIndex];
        currentTileIndex -= 1;
        if (cache.containsKey(tileCoordinate.key)) {
          tileLoaded.raiseEvent(cache.get(tileCoordinate.key));
        } else {
          // eslint-disable-next-line no-await-in-loop
          const result = await loadTile(tileCoordinate, abortSignal);
          if (cache.containsKey(tileCoordinate.key)) {
            // cached in a previous iteration but got aborted too late.
            tileLoaded.raiseEvent(cache.get(tileCoordinate.key));
          } else if (result instanceof Error) {
            if (result.name !== 'AbortError') {
              tileError.raiseEvent({ tileCoordinate, error: result });
            }
          } else if (result) {
            addTileToCache(result, cache, currentlyVisibleTiles);
            tileLoaded.raiseEvent(result);
          }
        }
        yield;
      }
    }

    const generators = Array.from({ length: concurrency }, () =>
      loadNextTileGenerator(),
    );

    const promises = generators.map(async (gen) => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      for await (const _ of gen) {
        // Just iterating through the generator
      }
    });

    Promise.all(promises)
      .then(() => {
        if (!abortSignal.aborted) {
          allTilesLoaded.raiseEvent();
          loading = false;
        }
      })
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') {
          getLogger('PanoramaTileProvider').warning('Error loading tiles');
          getLogger('PanoramaTileProvider').warning(String(e));
        }
      });
  };

  return {
    loadTiles(tileCoordinates: TileCoordinate[]): void {
      loading = true;
      currentlyVisibleTiles = Object.fromEntries(
        tileCoordinates.map((tile) => [tile.key, true]),
      );
      abortController?.abort();
      abortController = new AbortController();
      loadTilesQueue(tileCoordinates, abortController.signal);
    },
    get loading(): boolean {
      return loading;
    },
    tileLoaded,
    tileError,
    allTilesLoaded,
    destroy,
  };
}
