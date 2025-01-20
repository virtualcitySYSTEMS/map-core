import LRUCache from 'ol/structs/LRUCache.js';
import { Cartesian3 } from '@vcmap-cesium/engine';
import { getLogger } from '@vcsuite/logger';
import {
  createPanoramaTile,
  PanoramaTile,
  TileCoordinate,
  TileSize,
} from './panoramaTile.js';
import VcsEvent from '../vcsEvent.js';

export type PanoramaTileProviderStrategy = 'static' | 'cog';

type TileLoadStrategy = (
  tileCoordinate: TileCoordinate,
  abort: AbortSignal,
) => Promise<PanoramaTile | null | Error>;

export type PanoramaTileProvider = {
  destroy(): void;
  loadTiles(tileCoordinate: TileCoordinate[]): void;
  readonly loading: boolean;
  readonly tileSize: TileSize;
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

function createStaticLoadingStrategy(
  rootUrl: string,
  origin: Cartesian3,
  tileSize: TileSize,
): TileLoadStrategy {
  return async (
    tileCoordinate: TileCoordinate,
    abort: AbortSignal,
  ): Promise<PanoramaTile | null | Error> => {
    const src = `${rootUrl}/${tileCoordinate.key}.jpg`;
    try {
      const response = await fetch(src, { signal: abort });
      if (!response.ok) {
        getLogger('StaticPanoramaTileProvider').warning(
          `Failed to load tile: ${src}`,
        );
      }
      const blob = await response.blob();
      const image = await createImageBitmap(blob);
      return createPanoramaTile(tileCoordinate, image, origin, tileSize);
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') {
        return null;
      }
      return e as Error;
    }
  };
}

export function createPanoramaTileProvider(
  strategy: PanoramaTileProviderStrategy,
  rootUrl: string,
  origin: Cartesian3,
  tileSize: TileSize,
  maxCacheSize?: number,
  concurrency = 6,
): PanoramaTileProvider {
  const cache = new PanoramaTileCache(maxCacheSize);
  let currentlyVisibleTiles: Record<string, boolean> = {};
  let strategyFunction: TileLoadStrategy;
  if (strategy === 'static') {
    strategyFunction = createStaticLoadingStrategy(rootUrl, origin, tileSize);
  } else {
    throw new Error(`Unknown strategy: ${strategy}`);
  }
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
          const result = await strategyFunction(tileCoordinate, abortSignal);
          if (result instanceof Error) {
            tileError.raiseEvent({ tileCoordinate, error: result });
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
        getLogger('PanoramaTileProvider').warning('Error loading tiles');
        getLogger('PanoramaTileProvider').warning(String(e));
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
    get tileSize(): TileSize {
      return tileSize;
    },
    tileLoaded,
    tileError,
    allTilesLoaded,
    destroy,
  };
}
