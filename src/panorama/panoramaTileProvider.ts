import type { Matrix4 } from '@vcmap-cesium/engine';
import { getLogger } from '@vcsuite/logger';
import type { GeoTIFFImage } from 'geotiff';
import { Pool } from 'geotiff';
import type { Size } from 'ol/size.js';
import type { PanoramaTile } from './panoramaTile.js';
import { createPanoramaTile } from './panoramaTile.js';
import VcsEvent from '../vcsEvent.js';
import { addTileToCache, PanoramaTileCache } from './panoramaTileCache.js';
import {
  tileCoordinateFromImageCoordinate,
  type PanoramaTileCoordinate,
  getTileSphericalExtent,
} from './panoramaTileCoordinate.js';
import type {
  DepthGDALMetadata,
  PanoramaFileDirectoryMetadata,
} from './panoramaImage.js';

export type PanoramaResourceType = 'rgb' | 'intensity' | 'depth';
export type PanoramaResourceData<T extends PanoramaResourceType> =
  T extends 'rgb'
    ? ImageBitmap
    : T extends 'intensity'
      ? ImageBitmap
      : T extends 'depth'
        ? Float32Array
        : never;

export type PanoramaTileLoadError = {
  tileCoordinate: PanoramaTileCoordinate;
  error: Error;
  type: PanoramaResourceType;
};

type PanoramaResourceProvider = {
  destroy(): void;
  /**
   * Sets the currently visible tiles and creates or updates the queue for loading resources.
   */
  setVisibleTiles(panoramaTiles: PanoramaTile[]): void;
  /**
   * Loads the resource for the given tile and type. If the resource is already loaded, it returns a resolved promise.
   * If the resource is currently loading, it returns the promise of that loading operation. Mainly used to request depth.
   * @param tile - The panorama tile to load the resource for.
   * @param type - The type of resource to load.
   */
  loadResource(tile: PanoramaTile, type: PanoramaResourceType): Promise<void>;
  showIntensity: boolean;
  readonly loading: boolean;
  loadingStateChanged: VcsEvent<boolean>;
  tileError: VcsEvent<PanoramaTileLoadError>;
};

export type PanoramaImageDecoder = {
  decode(
    fileDirectory: { vcsPanorama: PanoramaFileDirectoryMetadata },
    buffer: ArrayBuffer,
  ): Promise<PanoramaResourceData<PanoramaResourceType>>;
};

type PanoramaResource<T extends PanoramaResourceType> = {
  type: T;
  levelImages: GeoTIFFImage[];
} & (T extends 'depth'
  ? {
      metadata: DepthGDALMetadata;
    }
  : {
      metadata?: never;
    });

type TileResourceRequest<T extends PanoramaResourceType> = {
  tile: PanoramaTile;
  resource: PanoramaResource<T>;
};

type ResourceOptions = {
  rgb: PanoramaResource<'rgb'>;
  intensity?: PanoramaResource<'intensity'>;
  depth?: PanoramaResource<'depth'>;
};

export type PanoramaTileProvider = {
  /**
   * Creates or the visible tiles for the given tile coordinates or retrieves them from the cache.
   */
  createVisibleTiles(tileCoordinates: PanoramaTileCoordinate[]): PanoramaTile[];
  /**
   * Gets the depth at the given image coordinate for the current level.
   */
  getDepthAtImageCoordinate(
    imageCoordinate: [number, number],
  ): Promise<number | undefined>;
  /**
   * Gets the depth at the given image coordinate for the most detailed level.
   */
  getDepthAtImageCoordinateMostDetailed(
    imageCoordinate: [number, number],
  ): Promise<number | undefined>;
  /**
   * The promise that resolves when the intensity images are loaded and ready to be used.
   */
  intensityReady: Promise<void>;
  /**
   * Load & show intensity images.
   */
  showIntensity: boolean;
  /**
   * The current level of the panorama tile provider. This is set by the panorama viewer and is used to determine which depth tiles to query.
   */
  currentLevel: number;
  readonly loading: boolean;
  /**
   * Raised with true, if we start loading new data. raised with false, if all tiles are loaded.
   */
  loadingStateChanged: VcsEvent<boolean>;
  tileError: VcsEvent<PanoramaTileLoadError>;
  destroy(): void;
};

let defaultImagePool: Pool | undefined;
function getDefaultImagePool(): Pool {
  if (!defaultImagePool) {
    let workerUrl: URL;
    if (window.vcs.workerBase) {
      workerUrl = new URL(
        `${window.vcs.workerBase}/panoramaImageWorker.js`,
        window.location.href,
      );
    } else {
      workerUrl = new URL('../workers/panoramaImageWorker.js', import.meta.url);
    }

    defaultImagePool = new Pool(undefined, () => {
      return new Worker(workerUrl, {
        type: 'module',
      });
    });
  }
  return defaultImagePool;
}

/**
 * The priority order in which the panorama resources are loaded.
 */
const typeOrder: Record<PanoramaResourceType, number> = {
  rgb: 0,
  intensity: 1,
  depth: 2,
} as const;

function createPanoramaResourceProvider(
  resources: ResourceOptions,
  minLevel: number,
  poolOrDecoder: Pool | PanoramaImageDecoder,
  concurrency = 6,
): PanoramaResourceProvider {
  let currentlyVisibleTiles: PanoramaTile[] = [];
  let loading = false;
  let showIntensity = false;

  const tileError = new VcsEvent<PanoramaTileLoadError>();
  const loadingStateChanged = new VcsEvent<boolean>();

  const loadResource = async (
    request: TileResourceRequest<PanoramaResourceType>,
  ): Promise<void> => {
    const { tile, resource } = request;
    const { type } = resource;
    if (!tile.material.hasTexture(type)) {
      const { levelImages } = resource;
      const { tileCoordinate } = tile;
      const levelImage = levelImages[tileCoordinate.level - minLevel];
      if (levelImage) {
        try {
          const resourceData = await levelImage.getTileOrStrip(
            tileCoordinate.x,
            tileCoordinate.y,
            levelImage.getSamplesPerPixel(),
            poolOrDecoder,
          );

          tile.material.setTexture(
            type,
            resourceData.data as unknown as PanoramaResourceData<PanoramaResourceType>,
          );
        } catch (error) {
          tileError.raiseEvent({
            tileCoordinate,
            error: error as Error,
            type,
          });
        }
      }
    }
  };

  let currentQueue: TileResourceRequest<PanoramaResourceType>[] = [];
  const loadingTiles = new Map<
    PanoramaTile,
    Record<PanoramaResourceType, Promise<void> | undefined>
  >();

  const startQueue = (): void => {
    async function* loadNextTileGenerator(): AsyncGenerator<void> {
      while (currentQueue?.length) {
        const currentTile = currentQueue.pop()!;
        if (!loadingTiles.has(currentTile.tile)) {
          loadingTiles.set(currentTile.tile, {
            rgb: undefined,
            intensity: undefined,
            depth: undefined,
          });
        }
        const currentTileTypes = loadingTiles.get(currentTile.tile)!;
        const promise = loadResource(currentTile);
        currentTileTypes[currentTile.resource.type] = promise;
        // eslint-disable-next-line no-await-in-loop
        await promise;
        currentTileTypes[currentTile.resource.type] = undefined;
        if (
          !currentTileTypes.rgb &&
          !currentTileTypes.depth &&
          !currentTileTypes.intensity
        ) {
          loadingTiles.delete(currentTile.tile);
        }
        yield;
      }
    }

    // we create N generators. thus, AT MOST N web requests are made in parallel.
    // this allows us to not abort web request and still keep the queue dynamic
    const generators = Array.from({ length: concurrency }, () =>
      loadNextTileGenerator(),
    );

    const promises = generators.map(async (gen) => {
      // eslint-disable-next-line @typescript-eslint/naming-convention,@typescript-eslint/no-unused-vars
      for await (const _ of gen) {
        // just iterating
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

  const createOrUpdateQueue = (panoramaTile: PanoramaTile[]): void => {
    const newResources = panoramaTile.flatMap((tile) => {
      const resourceRequests: TileResourceRequest<PanoramaResourceType>[] = [];
      if (!tile.material.hasTexture('rgb') && !loadingTiles.get(tile)?.rgb) {
        resourceRequests.push({
          tile,
          resource: resources.rgb,
        });
      }
      if (resources.depth) {
        if (
          !tile.material.hasTexture('depth') &&
          !loadingTiles.get(tile)?.depth
        ) {
          resourceRequests.push({
            tile,
            resource: resources.depth,
          });
        }
      }
      if (showIntensity && resources.intensity) {
        if (
          !tile.material.hasTexture('intensity') &&
          !loadingTiles.get(tile)?.intensity
        ) {
          resourceRequests.push({
            tile,
            resource: resources.intensity,
          });
        }
      }

      return resourceRequests;
    });

    if (newResources.length === 0) {
      return;
    }

    newResources.sort(
      (a, b) => typeOrder[b.resource.type] - typeOrder[a.resource.type],
    );

    if (currentQueue.length > 0) {
      currentQueue.splice(0, currentQueue.length, ...newResources);
    } else {
      loading = true;
      loadingStateChanged.raiseEvent(true);
      currentQueue = newResources;
      startQueue();
    }
  };

  return {
    setVisibleTiles(panoramaTiles: PanoramaTile[]): void {
      currentlyVisibleTiles = panoramaTiles.slice();
      createOrUpdateQueue(currentlyVisibleTiles);
    },
    get showIntensity(): boolean {
      return showIntensity;
    },
    set showIntensity(value: boolean) {
      showIntensity = value;
      if (value && resources.intensity) {
        createOrUpdateQueue(currentlyVisibleTiles);
      }
    },
    loadResource(
      tile: PanoramaTile,
      type: PanoramaResourceType,
    ): Promise<void> {
      if (!resources[type]) {
        throw new Error(`Resource type ${type} not found`);
      }

      if (tile.material.hasTexture(type)) {
        return Promise.resolve();
      }

      if (loadingTiles.has(tile) && loadingTiles.get(tile)?.[type]) {
        return loadingTiles.get(tile)![type]!;
      }

      return loadResource({ tile, resource: resources[type] });
    },
    get loading(): boolean {
      return loading;
    },
    tileError,
    loadingStateChanged,
    destroy(): void {
      currentQueue = [];
      tileError.destroy();
    },
  };
}

function interpolateDepth(
  value: number,
  min: number,
  max: number,
  minValue = 1 / 65535,
  maxValue = 1,
): number {
  return min + ((value - minValue) / (maxValue - minValue)) * (max - min);
}

/**
 * Creates a panorama tile provider for the given images.
 * @param rgbImages - the images ordered by level. lowest level (smallest overview) first. that level is given by minLevel. all other levels must be consecutive.
 * @param modelMatrix - the model matrix of the image
 * @param tileSize - the size of the tile in pixels
 * @param minLevel - the minimum level of the images
 * @param maxCacheSize - the cache size for the number of tiles to cache. (LRU cache in use)
 * @param concurrency - the number of concurrent web requests to load tiles with
 * @param poolOrDecoder - an optional pool to decode directly to image bitmaps. most scenarios will use the default, mainly used for headless testing
 */
export function createPanoramaTileProvider(
  rgbImages: GeoTIFFImage[],
  modelMatrix: Matrix4,
  tileSize: Size,
  minLevel: number,
  maxLevel: number,
  getIntensityImages?: () => Promise<GeoTIFFImage[]>,
  depth?: { levelImages: GeoTIFFImage[]; metadata: DepthGDALMetadata },
  maxCacheSize?: number,
  concurrency = 6,
  poolOrDecoder: Pool | PanoramaImageDecoder = getDefaultImagePool(),
): PanoramaTileProvider {
  const cache = new PanoramaTileCache(maxCacheSize);
  const resources: ResourceOptions = {
    rgb: {
      type: 'rgb',
      levelImages: rgbImages,
    },
  };

  if (depth) {
    resources.depth = {
      ...depth,
      type: 'depth',
    };
  }

  const resourceProvider = createPanoramaResourceProvider(
    resources,
    minLevel,
    poolOrDecoder,
    concurrency,
  );
  let showIntensity = false;

  const destroy = (): void => {
    cache.clear();
    resourceProvider.destroy();
  };

  let currentlyVisibleTileCoordinates: Record<string, boolean> = {};
  const createTile = (tileCoordinate: PanoramaTileCoordinate): PanoramaTile => {
    if (cache.containsKey(tileCoordinate.key)) {
      return cache.get(tileCoordinate.key);
    }
    const newTile = createPanoramaTile(tileCoordinate, modelMatrix, tileSize);
    addTileToCache(newTile, cache, currentlyVisibleTileCoordinates);
    return newTile;
  };

  const getDepthAtImageCoordinate = async (
    imageCoordinate: [number, number],
    level: number,
  ): Promise<number | undefined> => {
    if (!resources.depth) {
      return undefined;
    }

    const tileCoordinate = tileCoordinateFromImageCoordinate(
      imageCoordinate,
      level,
    );
    const tile = createTile(tileCoordinate);
    await resourceProvider.loadResource(tile, 'depth');

    const [minPhi, minTheta, maxPhi, maxTheta] =
      getTileSphericalExtent(tileCoordinate);
    const offsetX = imageCoordinate[0] - minPhi;
    const offsetY = imageCoordinate[1] - minTheta;

    const width = maxPhi - minPhi;
    const height = maxTheta - minTheta;

    const x = tileSize[0] - Math.floor((offsetX / width) * tileSize[0]);
    const y = Math.floor((offsetY / height) * tileSize[1]);

    const depthValue = tile.material.getDepthAtPixel(x, y);
    if (depthValue) {
      return interpolateDepth(
        depthValue,
        depth?.metadata?.min ?? 0,
        depth?.metadata?.max ?? 50,
      );
    }
    return depthValue;
  };

  let resolveIntensity: () => void;
  let rejectIntensity: (reason?: unknown) => void;
  const intensityReady = new Promise<void>((resolve, reject) => {
    resolveIntensity = resolve;
    rejectIntensity = reject;
  });

  const loadIntensityImages = (): void => {
    if (!resources.intensity && getIntensityImages) {
      getIntensityImages()
        .then((intensityImages) => {
          resources.intensity = {
            type: 'intensity',
            levelImages: intensityImages,
          };
          if (showIntensity) {
            resourceProvider.showIntensity = true;
          }
          resolveIntensity();
        })
        .catch((e: unknown) => {
          getLogger('PanoramaTileProvider').warning(
            'Error loading intensity images',
          );
          getLogger('PanoramaTileProvider').warning(String(e));
          rejectIntensity(e);
        });
    }
  };

  return {
    createVisibleTiles(
      tileCoordinates: PanoramaTileCoordinate[],
    ): PanoramaTile[] {
      currentlyVisibleTileCoordinates = Object.fromEntries(
        tileCoordinates.map((tile) => [tile.key, true]),
      );

      const panoramaTiles = tileCoordinates.map(createTile);
      resourceProvider.setVisibleTiles(panoramaTiles.slice());
      return panoramaTiles;
    },
    currentLevel: minLevel,
    get loading(): boolean {
      return resourceProvider.loading;
    },
    get intensityReady(): Promise<void> {
      return intensityReady;
    },
    get showIntensity(): boolean {
      return showIntensity;
    },
    set showIntensity(value: boolean) {
      showIntensity = value;
      // XXX this entire thing is a mess
      if (resources.intensity) {
        resourceProvider.showIntensity = value;
      } else if (value) {
        loadIntensityImages();
      }
    },
    getDepthAtImageCoordinateMostDetailed(
      imageCoordinate: [number, number],
    ): Promise<number | undefined> {
      return getDepthAtImageCoordinate(imageCoordinate, maxLevel);
    },
    getDepthAtImageCoordinate(
      imageCoordinate: [number, number],
    ): Promise<number | undefined> {
      return getDepthAtImageCoordinate(imageCoordinate, this.currentLevel);
    },
    tileError: resourceProvider.tileError,
    loadingStateChanged: resourceProvider.loadingStateChanged,
    destroy,
  };
}
