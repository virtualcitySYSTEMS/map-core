import type { Matrix4 } from '@vcmap-cesium/engine';
import { getLogger } from '@vcsuite/logger';
import { BaseDecoder, GeoTIFFImage, Pool } from 'geotiff';
import type { PanoramaTile } from './panoramaTile.js';
import { createPanoramaTile } from './panoramaTile.js';
import VcsEvent from '../vcsEvent.js';
import { addTileToCache, PanoramaTileCache } from './panoramaTileCache.js';
import {
  tileCoordinateFromImageCoordinate,
  type TileCoordinate,
  type TileSize,
  getTileSphericalExtent,
} from './tileCoordinate.js';
import type { DepthGDALMetadata } from './panoramaImage.js';
import WorkerPool from '../util/workerPool.js';
import type { DepthProcessingMessage } from '../workers/panoramaDepthKernel.js';

export type PanoramaResourceType = 'rgb' | 'intensity' | 'depth';
export type PanoramaResourceData<T extends PanoramaResourceType> =
  T extends 'rgb'
    ? ImageBitmap
    : T extends 'intensity'
      ? ImageBitmap
      : T extends 'depth'
        ? Float32Array
        : never;

export type TileLoadError = {
  tileCoordinate: TileCoordinate;
  error: Error;
  type: PanoramaResourceType;
};

type PanoramaResourceProvider = {
  destroy(): void;
  setVisibleTiles(tileCoordinates: PanoramaTile[]): void;
  loadResource(tile: PanoramaTile, type: PanoramaResourceType): Promise<void>;
  showIntensity: boolean;
  readonly loading: boolean;
  loadingStateChanged: VcsEvent<boolean>;
  tileError: VcsEvent<TileLoadError>;
};

export type ImageBitmapDecoder = {
  decode(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fileDirectory: any,
    buffer: ArrayBuffer,
  ): Promise<ImageBitmap>;
};

type PanoramaResource<T extends PanoramaResourceType> = {
  type: T;
  levelImages: GeoTIFFImage[];
  poolOrDecoder: T extends 'rgb'
    ? Pool | ImageBitmapDecoder
    : T extends 'intensity'
      ? Pool | ImageBitmapDecoder
      : T extends 'depth'
        ? Pool | BaseDecoder
        : never;
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
  destroy(): void;
  createVisibleTiles(tileCoordinates: TileCoordinate[]): PanoramaTile[];
  loadIntensityImages(): void;
  getDepthAtImageCoordinate(
    imageCoordinate: [number, number],
  ): Promise<number | undefined>;
  getDepthAtImageCoordinateMostDetailed(
    imageCoordinate: [number, number],
  ): Promise<number | undefined>;
  showIntensity: boolean;
  currentLevel: number;
  readonly loading: boolean;
  tileError: VcsEvent<TileLoadError>;
  /**
   * Raised with true, if we start loading new data. raised with false, if all tiles are loaded.
   */
  loadingStateChanged: VcsEvent<boolean>;
};

let defaultImagePool: Pool | undefined;
function getDefaultImagePool(): Pool {
  if (!defaultImagePool) {
    let workerUrl: URL;
    if (window.vcs.workerBase) {
      workerUrl = new URL(
        `${window.vcs.workerBase}/webp.js`,
        window.location.href,
      );
    } else {
      workerUrl = new URL('../workers/webp.js', import.meta.url);
    }

    defaultImagePool = new Pool(undefined, () => {
      return new Worker(workerUrl, {
        type: 'module',
      });
    });
  }
  return defaultImagePool;
}

let defaultDepthPool: Pool | undefined;
function getDefaultDepthPool(): Pool {
  if (!defaultDepthPool) {
    defaultDepthPool = new Pool();
  }
  return defaultDepthPool;
}

let defaultDepthKernelPool: WorkerPool<DepthProcessingMessage> | undefined;
export function getDefaultDepthKernelPool(): WorkerPool<DepthProcessingMessage> {
  if (!defaultDepthKernelPool) {
    let workerUrl: URL;
    if (window.vcs.workerBase) {
      workerUrl = new URL(
        `${window.vcs.workerBase}/panoramaDepthKernel.js`,
        window.location.href,
      );
    } else {
      workerUrl = new URL('../workers/panoramaDepthKernel.js', import.meta.url);
    }

    defaultDepthKernelPool = new WorkerPool(workerUrl);
  }
  return defaultDepthKernelPool;
}

const typeOrder: Record<PanoramaResourceType, number> = {
  rgb: 0,
  intensity: 1,
  depth: 2,
} as const;

function resourceIsDepth(
  resource: PanoramaResource<PanoramaResourceType>,
): resource is PanoramaResource<'depth'> {
  return resource.type === 'depth';
}

function createPanoramaResourceProvider(
  resources: ResourceOptions,
  minLevel: number,
  tileSize: TileSize,
  concurrency = 6,
): PanoramaResourceProvider {
  let currentlyVisibleTiles: PanoramaTile[] = [];
  let loading = false;
  let showIntensity = false;

  const tileError = new VcsEvent<TileLoadError>();
  const loadingStateChanged = new VcsEvent<boolean>();

  const loadResource = async (
    request: TileResourceRequest<PanoramaResourceType>,
  ): Promise<void> => {
    const { tile, resource } = request;
    const { type } = resource;
    if (!tile.hasTexture(type)) {
      const { levelImages, poolOrDecoder } = resource;
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
          if (resourceIsDepth(resource)) {
            const { data } = resourceData;
            const result = await getDefaultDepthKernelPool().process(
              {
                data,
                width: tileSize[0],
                height: tileSize[1],
              },
              [data],
            );

            if (result.success) {
              tile.setTexture('depth', new Float32Array(result.data));
            }
          } else {
            tile.setTexture(type, resourceData.data as unknown as ImageBitmap);
          }
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
        currentTileTypes[currentTile.resource.type] = loadResource(currentTile);
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
      if (!tile.hasTexture('rgb') && !loadingTiles.get(tile)?.rgb) {
        resourceRequests.push({
          tile,
          resource: resources.rgb,
        });
      }
      if (resources.depth) {
        if (!tile.hasTexture('depth') && !loadingTiles.get(tile)?.depth) {
          resourceRequests.push({
            tile,
            resource: resources.depth,
          });
        }
      }
      if (showIntensity && resources.intensity) {
        if (
          !tile.hasTexture('intensity') &&
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
      (a, b) => typeOrder[a.resource.type] - typeOrder[b.resource.type],
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
      const newTiles = panoramaTiles.filter(
        (tile) =>
          !currentlyVisibleTiles.includes(tile) && !loadingTiles.has(tile),
      );
      currentlyVisibleTiles = panoramaTiles.slice();

      if (newTiles.length > 0) {
        createOrUpdateQueue(newTiles);
      }
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

      if (tile.hasTexture(type)) {
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
  tileSize: TileSize,
  minLevel: number,
  maxLevel: number,
  getIntensityImages?: () => Promise<GeoTIFFImage[]>,
  depth?: { levelImages: GeoTIFFImage[]; metadata: DepthGDALMetadata },
  maxCacheSize?: number,
  concurrency = 6,
  imagePoolOrDecoder: Pool | ImageBitmapDecoder = getDefaultImagePool(),
  depthPoolOrDecoder: Pool | BaseDecoder = getDefaultDepthPool(),
): PanoramaTileProvider {
  const cache = new PanoramaTileCache(maxCacheSize);
  const resources: ResourceOptions = {
    rgb: {
      type: 'rgb',
      levelImages: rgbImages,
      poolOrDecoder: imagePoolOrDecoder,
    },
  };

  if (depth) {
    resources.depth = {
      ...depth,
      type: 'depth',
      poolOrDecoder: depthPoolOrDecoder,
    };
  }

  const resourceProvider = createPanoramaResourceProvider(
    resources,
    minLevel,
    tileSize,
    concurrency,
  );
  let showIntensity = false;

  const destroy = (): void => {
    cache.clear();
    resourceProvider.destroy();
  };

  let currentlyVisibleTileCoordinates: Record<string, boolean> = {};
  const createTile = (tileCoordinate: TileCoordinate): PanoramaTile => {
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

    const depthValue = tile.getDepthAtPixel(x, y);
    if (depthValue) {
      return depthValue * resources.depth.metadata.max;
    }
    return depthValue;
  };

  return {
    createVisibleTiles(tileCoordinates: TileCoordinate[]): PanoramaTile[] {
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
    loadIntensityImages(): void {
      if (!resources.intensity && getIntensityImages) {
        getIntensityImages()
          .then((intensityImages) => {
            resources.intensity = {
              type: 'intensity',
              levelImages: intensityImages,
              poolOrDecoder: imagePoolOrDecoder,
            };
            if (showIntensity) {
              resourceProvider.showIntensity = true;
            }
          })
          .catch((e: unknown) => {
            getLogger('PanoramaTileProvider').warning(
              'Error loading intensity images',
            );
            getLogger('PanoramaTileProvider').warning(String(e));
          });
      }
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
        this.loadIntensityImages();
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
