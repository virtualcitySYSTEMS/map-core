import type { Matrix4 } from '@vcmap-cesium/engine';
import { getLogger } from '@vcsuite/logger';
import type { GeoTIFFImage } from 'geotiff';
import { Pool } from 'geotiff';
import type { PanoramaTile, TileCoordinate, TileSize } from './panoramaTile.js';
import {
  createPanoramaTile,
  createTileCoordinateFromKey,
} from './panoramaTile.js';
import VcsEvent from '../vcsEvent.js';
import { addTileToCache, PanoramaTileCache } from './panoramaTileCache.js';

export type TileLoadError = { tileCoordinate: TileCoordinate; error: Error };

export type PanoramaTileProvider = {
  destroy(): void;
  /**
   * Sets the currently visible tiles. Currently not visible tiles will be loaded.
   * Last coordinates in the provided array get loaded first (FILO). If the provided array is already visible,
   * no tiles will be loaded.
   * @param tileCoordinates
   */
  setVisibleTiles(tileCoordinates: TileCoordinate[]): void;
  /**
   * Returns the currently visible tiles. This is not the same as the tiles that are currently loaded,
   * some visible tiles may still be loading.
   */
  getVisibleTiles(): TileCoordinate[];
  readonly loading: boolean;
  tileLoaded: VcsEvent<PanoramaTile>;
  tileError: VcsEvent<TileLoadError>;
  /**
   * Raised with true, if we start loading new data. raised with false, if all tiles are loaded.
   */
  loadingStateChanged: VcsEvent<boolean>;
};

type ImageBitmapDecoder = {
  decode(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fileDirectory: any,
    buffer: ArrayBuffer,
  ): Promise<ImageBitmap>;
};

let defaultPool: Pool | undefined;
function getDefaultPool(): Pool {
  if (!defaultPool) {
    let workerUrl: URL;
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
  let loading = false;

  const tileLoaded = new VcsEvent<PanoramaTile>();
  const tileError = new VcsEvent<{
    tileCoordinate: TileCoordinate;
    error: Error;
  }>();
  const loadingStateChanged = new VcsEvent<boolean>();

  const destroy = (): void => {
    cache.clear();
  };

  const loadTile = async (
    tileCoordinate: TileCoordinate,
  ): Promise<PanoramaTile | null | Error> => {
    const levelImage = levelImages[tileCoordinate.level - minLevel];
    if (levelImage) {
      try {
        const tile = await levelImage.getTileOrStrip(
          tileCoordinate.x,
          tileCoordinate.y,
          levelImage.getSamplesPerPixel(),
          poolOrDecoder,
        );

        return createPanoramaTile(
          tileCoordinate,
          tile.data as unknown as ImageBitmap,
          modelMatrix,
          tileSize,
        );
      } catch (error) {
        return error as Error;
      }
    }
    return null;
  };

  let currentQueue: TileCoordinate[] = [];
  const loadTilesQueue = (tileCoordinates: TileCoordinate[]): void => {
    currentQueue = tileCoordinates.slice();
    async function* loadNextTileGenerator(): AsyncGenerator<
      PanoramaTile | TileLoadError
    > {
      while (currentQueue?.length) {
        const tileCoordinate = currentQueue.pop()!;
        if (cache.containsKey(tileCoordinate.key)) {
          yield cache.get(tileCoordinate.key);
        } else {
          // eslint-disable-next-line no-await-in-loop
          const result = await loadTile(tileCoordinate);
          if (result instanceof Error) {
            yield { tileCoordinate, error: result };
          } else if (result) {
            addTileToCache(result, cache, currentlyVisibleTiles);
            yield result;
          }
        }
      }
    }

    // we create N generators. thus, AT MOST N web requests are made in parallel.
    // this allows us to not abort web request and still keep the queue dynamic
    const generators = Array.from({ length: concurrency }, () =>
      loadNextTileGenerator(),
    );

    const promises = generators.map(async (gen) => {
      for await (const result of gen) {
        if ((result as TileLoadError).error) {
          tileError.raiseEvent(result as TileLoadError);
        } else if (result) {
          tileLoaded.raiseEvent(result as PanoramaTile);
        }
      }
    });

    Promise.all(promises)
      .then(() => {
        loading = false;
        loadingStateChanged.raiseEvent(false);
      })
      .catch((e: unknown) => {
        getLogger('PanoramaTileProvider').warning('Error loading tiles');
        getLogger('PanoramaTileProvider').warning(String(e));
      });
  };

  return {
    setVisibleTiles(tileCoordinates: TileCoordinate[]): void {
      const newTileCoordinates = tileCoordinates.filter(
        (tc) =>
          !currentlyVisibleTiles[tc.key] ||
          currentQueue.find((c) => tc.key === c.key),
      );

      currentlyVisibleTiles = Object.fromEntries(
        tileCoordinates.map((tile) => [tile.key, true]),
      );

      if (newTileCoordinates.length > 0) {
        if (currentQueue?.length) {
          currentQueue.splice(0, currentQueue.length, ...newTileCoordinates);
        } else {
          loading = true;
          loadingStateChanged.raiseEvent(true);
          loadTilesQueue(newTileCoordinates);
        }
      }
    },
    getVisibleTiles(): TileCoordinate[] {
      return Object.keys(currentlyVisibleTiles).map(
        createTileCoordinateFromKey,
      );
    },
    get loading(): boolean {
      return loading;
    },
    tileLoaded,
    tileError,
    loadingStateChanged,
    destroy,
  };
}
