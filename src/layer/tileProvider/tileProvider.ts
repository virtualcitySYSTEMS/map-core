import { v4 as uuidv4 } from 'uuid';
import RBush from 'rbush';
import { check } from '@vcsuite/check';
import {
  Rectangle,
  Math as CesiumMath,
  WebMercatorTilingScheme,
  Cartographic,
} from '@vcmap-cesium/engine';
import LRUCache from 'ol/structs/LRUCache.js';
import {
  buffer,
  createOrUpdateFromCoordinate,
  type Extent as OLExtent,
} from 'ol/extent.js';
import type { Feature } from 'ol/index.js';
import type { Coordinate } from 'ol/coordinate.js';
import { parseBoolean, parseInteger } from '@vcsuite/parsers';
import {
  mercatorProjection,
  mercatorToWgs84Transformer,
  wgs84Projection,
  wgs84ToMercatorTransformer,
} from '../../util/projection.js';
import VcsObject, { VcsObjectOptions } from '../../vcsObject.js';
import VcsEvent from '../../vcsEvent.js';
import { tileProviderClassRegistry } from '../../classRegistry.js';
import type Extent from '../../util/extent.js';

export type TileProviderRTreeEntry = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  value: Feature;
};

export type TileProviderRtree = RBush<TileProviderRTreeEntry>;

/**
 * resolutions to levels
 */
export const mercatorResolutionsToLevel = new Array(25);
for (let i = 0; i < mercatorResolutionsToLevel.length; i++) {
  mercatorResolutionsToLevel[i] = (20037508.3427892 * 2) / 256 / 2 ** (i + 1);
}

/**
 * transforms cesium geographic rectangle to mercator extent
 * @param  rectangle in wgs84 radians
 * @returns  extent in mercator
 */
export function rectangleToExtent(rectangle: Rectangle): OLExtent {
  const baseSouthWestLevel = Rectangle.southwest(rectangle);
  const baseNorthEastLevel = Rectangle.northeast(rectangle);
  const baseSouthWestWGS84 = [
    CesiumMath.toDegrees(baseSouthWestLevel.longitude),
    CesiumMath.toDegrees(baseSouthWestLevel.latitude),
  ];
  const baseNorthEastWGS84 = [
    CesiumMath.toDegrees(baseNorthEastLevel.longitude),
    CesiumMath.toDegrees(baseNorthEastLevel.latitude),
  ];
  const baseSouthWestMercator = wgs84ToMercatorTransformer(baseSouthWestWGS84);
  const baseNorthEastMercator = wgs84ToMercatorTransformer(baseNorthEastWGS84);
  return [...baseSouthWestMercator, ...baseNorthEastMercator];
}

export type TileProviderOptions = VcsObjectOptions & {
  /**
   * size of the LRU (least recently used) tileCache per baseLevel
   * @default 50
   */
  tileCacheSize?: number;
  /**
   * baseLevels (these levels will be requested by the loader, all other child levels will be interpolated
   * @default 15
   */
  baseLevels?: number[];
  /**
   * tracks in which tile each feature exists. (features without an ID will be ignored). Better performance if deactivated, but does not allow for featureVisibility. Should be set to false if not unique featureID is provided.
   */
  trackFeaturesToTiles?: boolean;
  /**
   * allows aggregation of tiles if requested minLevel is lower than provided baseLevels ( if true, allows for aggregating up to two levels (16 child tiles) into a tile)
   */
  allowTileAggregation?: boolean;
};

export type TileLoadedEvent = {
  /**
   * id of the tile
   */
  tileId: string;
  /**
   * rbush rTree with the features, use rtree.all().map(item => item.value);
   */
  rtree: TileProviderRtree;
};

class TileProvider extends VcsObject {
  static get className(): string {
    return 'TileProvider';
  }

  static getDefaultOptions(): TileProviderOptions {
    return {
      tileCacheSize: 50,
      baseLevels: [15],
      trackFeaturesToTiles: true,
      allowTileAggregation: true,
    };
  }

  /**
   * Cesium Webmercator TilingScheme
   */
  readonly tilingScheme = new WebMercatorTilingScheme();

  /**
   * sorted baseLevels, maximumLevel first example: [18,17,16]
   */
  readonly baseLevels: number[];

  private _tileCacheSize: number;

  /**
   * cache of tiles for each baseLevel
   */
  cache: Map<number, LRUCache<Promise<TileProviderRtree>>> = new Map();

  /**
   * Caches the loaded rTrees for quick Access to all features.
   */
  rtreeCache: Map<string, TileProviderRtree> = new Map();

  readonly trackFeaturesToTiles: boolean;

  allowTileAggregation: boolean;

  /**
   * set of currently loaded featureIds with the corresponding tileIds
   */
  readonly featureIdToTileIds: Map<string, Set<string>> = new Map();

  readonly tileLoadedEvent: VcsEvent<TileLoadedEvent> = new VcsEvent();

  private _locale = 'en';

  constructor(options: TileProviderOptions) {
    super(options);
    const defaultOptions = TileProvider.getDefaultOptions();

    this._tileCacheSize = parseInteger(
      options.tileCacheSize,
      defaultOptions.tileCacheSize,
    );

    const baseLevels = Array.isArray(options.baseLevels)
      ? options.baseLevels.slice()
      : defaultOptions.baseLevels?.slice() || [];
    baseLevels.sort((a, b) => {
      return b - a;
    });

    this.baseLevels = [...new Set(baseLevels)];
    this.baseLevels.forEach((baseLevel) => {
      this.cache.set(baseLevel, new LRUCache(this.tileCacheSize));
    });

    this.trackFeaturesToTiles = parseBoolean(
      options.trackFeaturesToTiles,
      defaultOptions.trackFeaturesToTiles,
    );
    this.allowTileAggregation = parseBoolean(
      options.allowTileAggregation,
      defaultOptions.allowTileAggregation,
    );
  }

  /**
   * use setTileCacheSize to change
   */
  get tileCacheSize(): number {
    return this._tileCacheSize;
  }

  get locale(): string {
    return this._locale;
  }

  /**
   * sets the locale and reloads the layer the if the URL is a locale aware Object.
   */
  set locale(value: string) {
    check(value, String);
    if (this._locale !== value) {
      this._locale = value;
    }
  }

  async setTileCacheSize(value: number): Promise<void> {
    const promises: (Promise<void> | undefined)[] = [];
    this._tileCacheSize = value;
    this.cache.forEach((lru, baseLevel) => {
      lru.setSize(this._tileCacheSize);
      while (lru.canExpireCache()) {
        promises.push(this._removeLastTileFromCache(baseLevel));
      }
    });
    await Promise.all(promises);
  }

  /**
   * tracks Features if the features have ids.
   */
  private _trackFeatures(features: Feature[], tileId: string): void {
    if (this.trackFeaturesToTiles) {
      features.forEach((f) => {
        const featureId = f.getId();
        if (featureId) {
          if (!this.featureIdToTileIds.has(String(featureId))) {
            this.featureIdToTileIds.set(String(featureId), new Set());
          }
          this.featureIdToTileIds.get(String(featureId))!.add(tileId);
        }
      });
    }
  }

  /**
   * untracks Features
   */
  private _unTrackFeatures(features: Feature[], tileId: string): void {
    if (this.trackFeaturesToTiles) {
      features.forEach((f) => {
        const featureId = f.getId();
        if (featureId) {
          if (this.featureIdToTileIds.has(String(featureId))) {
            const tileIdSet = this.featureIdToTileIds.get(
              String(featureId),
            ) as Set<string>;
            tileIdSet.delete(tileId);
            if (tileIdSet.size === 0) {
              this.featureIdToTileIds.delete(String(featureId));
            }
          }
        }
      });
    }
  }

  private async _addTilePromiseToCache(
    featuresPromise: Promise<Feature[]>,
    baseLevel: number,
    tileId: string,
  ): Promise<void> {
    const rtreePromise: Promise<TileProviderRtree> = featuresPromise
      .then((features) => {
        features.forEach((feature) => {
          if (!feature.getId()) {
            feature.setId(uuidv4());
          }
        });
        const rtree: TileProviderRtree = new RBush(features.length);
        rtree.load(
          features
            .map((feature) => {
              const geometry = feature.getGeometry();
              if (geometry) {
                const extent = geometry.getExtent();
                const item = {
                  minX: extent[0],
                  minY: extent[1],
                  maxX: extent[2],
                  maxY: extent[3],
                  value: feature,
                };
                return item;
              }
              return null;
            })
            .filter((item) => item) as TileProviderRTreeEntry[],
        );
        this.tileLoadedEvent.raiseEvent({ tileId, rtree });
        this._trackFeatures(features, tileId);
        this.rtreeCache.set(tileId, rtree);
        return rtree;
      })
      .catch(() => {
        // Discussion, do we want to go on on tileLoadFailure ?
        this.getLogger().warning(`Could not load Tile ${tileId}`);
        const rtree: TileProviderRtree = new RBush();
        this.rtreeCache.set(tileId, rtree);
        return rtree;
      });

    this.cache.get(baseLevel)!.set(tileId, rtreePromise);
    if (this.cache.get(baseLevel)!.canExpireCache()) {
      await Promise.all([
        rtreePromise,
        this._removeLastTileFromCache(baseLevel),
      ]);
    }
    await rtreePromise;
  }

  private _removeLastTileFromCache(
    baseLevel: number,
  ): Promise<void> | undefined {
    const tileIdToRemove = this.cache.get(baseLevel)!.peekLastKey();
    const rtreePromise = this.cache.get(baseLevel)?.pop();
    if (rtreePromise) {
      return rtreePromise.then((rtree) => {
        if (rtree) {
          this.rtreeCache.delete(tileIdToRemove);
          setTimeout(() => {
            this._unTrackFeatures(
              rtree.all().map((item) => item.value),
              tileIdToRemove,
            );
            rtree.clear();
          }, 0);
        }
      });
    }
    return undefined;
  }

  /**
   * returns the closest baseLevel for the given resolution
   * @param  latitude in radians
   */
  getBaseLevelForResolution(resolution: number, latitude: number): number {
    const scaledResolution = resolution / Math.cos(latitude);
    let currentLevel = 0;
    for (let i = 0; i < mercatorResolutionsToLevel.length; i++) {
      currentLevel = i;
      if (scaledResolution >= mercatorResolutionsToLevel[i]) {
        break;
      }
    }
    const baseLevel = this.getBaseLevel(currentLevel);
    return baseLevel === undefined
      ? this.baseLevels[this.baseLevels.length - 1]
      : baseLevel;
  }

  /**
   * returns the nearest parent BaseLevel or undefined if no parent baseLevel is found
   */
  getBaseLevel(level: number): number | undefined {
    return this.baseLevels.find((baseLevel) => {
      return level >= baseLevel;
    });
  }

  // eslint-disable-next-line class-methods-use-this
  getCacheKey(x: number, y: number, level: number): string {
    return `${level}/${x}/${y}`;
  }

  private async _getRtreeForBaseTile(
    baseLevel: number,
    tileCenter: Cartographic,
    headers?: Record<string, string>,
  ): Promise<TileProviderRtree | null> {
    const baseTile = this.tilingScheme.positionToTileXY(tileCenter, baseLevel);
    const baseTileCacheKey = this.getCacheKey(
      baseTile.x,
      baseTile.y,
      baseLevel,
    );
    if (this.cache.has(baseLevel)) {
      if (!this.cache.get(baseLevel)!.containsKey(baseTileCacheKey)) {
        const featuresPromise = this.loader(
          baseTile.x,
          baseTile.y,
          baseLevel,
          headers,
        );
        // eslint-disable-next-line no-void
        void this._addTilePromiseToCache(
          featuresPromise,
          baseLevel,
          baseTileCacheKey,
        );
      }
      return this.cache.get(baseLevel)!.get(baseTileCacheKey);
    }
    return null;
  }

  /**
   * returns the features intersecting this coordinate. Depending on the resolution a buffer around the coordinate is requested.
   * The Buffer has the size of the resolution.
   * @param coordinate in mercator
   * @param resolution in m per pixel
   * @param headers optional request headers to be sent with the server request
   */
  async getFeaturesByCoordinate(
    coordinate: Coordinate,
    resolution: number,
    headers?: Record<string, string>,
  ): Promise<Feature[]> {
    const extent = createOrUpdateFromCoordinate(coordinate);
    buffer(extent, resolution, extent);
    const wgs84Coordinate = mercatorToWgs84Transformer(coordinate);
    const cartographic = Cartographic.fromDegrees(
      wgs84Coordinate[0],
      wgs84Coordinate[1],
    );
    const baseLevel = this.getBaseLevelForResolution(
      resolution,
      cartographic.latitude,
    );
    const rtree = await this._getRtreeForBaseTile(
      baseLevel,
      cartographic,
      headers,
    );
    if (rtree) {
      const features = rtree
        .search({
          minX: extent[0],
          minY: extent[1],
          maxX: extent[2],
          maxY: extent[3],
        })
        .map((item) => item.value);
      return features;
    }
    return [];
  }

  /**
   * returns features for the requested Tile.
   * @param x
   * @param y
   * @param level - if the level is not a base level, will use the closest match
   * @param headers optional request headers to be sent with the server request
   */
  async getFeaturesForTile(
    x: number,
    y: number,
    level: number,
    headers?: Record<string, string>,
  ): Promise<Feature[]> {
    const rectangle = this.tilingScheme.tileXYToRectangle(x, y, level);
    const tileCenter = Rectangle.center(rectangle);
    const baseLevel = this.getBaseLevel(level);
    if (baseLevel != null) {
      const rtree = await this._getRtreeForBaseTile(
        baseLevel,
        tileCenter,
        headers,
      );
      if (rtree) {
        if (level === baseLevel) {
          return rtree.all().map((item) => item.value);
        } else {
          const extent = rectangleToExtent(rectangle);
          const features = rtree
            .search({
              minX: extent[0],
              minY: extent[1],
              maxX: extent[2],
              maxY: extent[3],
            })
            .map((item) => item.value);
          return features;
        }
      }
    } else if (
      this.allowTileAggregation &&
      this.baseLevels[this.baseLevels.length - 1] - level <= 2
    ) {
      // tile aggregation, only allowed for 2 levels
      const childLevel = level + 1;
      const childNorth = x * 2;
      const childWest = y * 2;
      return [
        ...(await this.getFeaturesForTile(
          childNorth,
          childWest,
          childLevel,
          headers,
        )),
        ...(await this.getFeaturesForTile(
          childNorth + 1,
          childWest,
          childLevel,
          headers,
        )),
        ...(await this.getFeaturesForTile(
          childNorth + 1,
          childWest + 1,
          childLevel,
          headers,
        )),
        ...(await this.getFeaturesForTile(
          childNorth,
          childWest + 1,
          childLevel,
          headers,
        )),
      ];
    }
    return [];
  }

  /**
   * Retrieves all features which intersect the given extent. Will load all intersecting tiles.
   * @param extent
   * @param level - Optional level to request. Will use highest level if omitted. If the provided level is not a base level, will use the closest match.
   * @param headers Optional request headers to be sent with the server request
   */
  async getFeaturesForExtent(
    extent: Extent,
    level?: number,
    headers?: Record<string, string>,
  ): Promise<Feature[]> {
    let usedLevel = level != null ? level : this.baseLevels[0];
    usedLevel = this.getBaseLevel(usedLevel) as number;
    const [minx, miny, maxx, maxy] =
      extent.getCoordinatesInProjection(wgs84Projection);
    const topLeft = this.tilingScheme.positionToTileXY(
      Cartographic.fromDegrees(minx, maxy),
      usedLevel,
    );
    const bottomRight = this.tilingScheme.positionToTileXY(
      Cartographic.fromDegrees(maxx, miny),
      usedLevel,
    );
    const tileCoordinates = [];
    for (let { x } = topLeft; x <= bottomRight.x; x++) {
      for (let { y } = topLeft; y <= bottomRight.y; y++) {
        tileCoordinates.push([x, y]);
      }
    }

    const features = await Promise.all(
      tileCoordinates.map(([x, y]) =>
        this.getFeaturesForTile(x, y, usedLevel, headers),
      ),
    );
    const mercatorExtent =
      extent.getCoordinatesInProjection(mercatorProjection);
    return features.flat().filter((f) => {
      const geometry = f.getGeometry();
      return geometry && geometry.intersectsExtent(mercatorExtent);
    });
  }

  /**
   * calls the given Function for Each feature currently in the cache
   * @param  callback
   */
  forEachFeature(callback: (f: Feature) => void): void {
    this.rtreeCache.forEach((rtree) => {
      rtree
        .all()
        .map((item) => item.value)
        .forEach(callback);
    });
  }

  /**
   * Public API to load features from a source (for example a rest API, or WfsLayer)
   *
   * Can be used to write custom TileProvider to provide an interface to a "feature Source"
   * Can also be used to manipulate the features, for example setting an ID Prefix or filter the features.
   *
   * @example to request Geojson from a rest API:
   * const rectangle = this.tilingScheme.tileXYToRectangle(x, y, z);
   * const southwest = Rectangle.southwest(rectangle);
   * const northeast = Rectangle.northeast(rectangle);
   * const minx = CesiumMath.toDegrees(southwest.longitude);
   * const miny = CesiumMath.toDegrees(southwest.latitude);
   * const maxx = CesiumMath.toDegrees(northeast.longitude);
   * const maxy = CesiumMath.toDegrees(northeast.latitude);
   * const url = `http://myFeatureSource/layer/getFeatures?minx=${minx}&miny=${miny}&maxx=${maxx}&maxy=${maxy}`
   *
   * return fetch.get(url)
   *  .then(response => response.json())
   *  .then((data) => {
   *     const { features } = GeoJSONparseGeoJSON(data.data, { dynamicStyle: true });
   *     return features;
   *   });
   */
  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  loader(
    _x: number,
    _y: number,
    _z: number,
    _headers?: Record<string, string>,
  ): Promise<Feature[]> {
    return Promise.resolve([]);
  }

  toJSON(): TileProviderOptions {
    const config: TileProviderOptions = super.toJSON();
    const defaultOptions = TileProvider.getDefaultOptions();

    if (defaultOptions.tileCacheSize !== this.tileCacheSize) {
      config.tileCacheSize = this.tileCacheSize;
    }

    if (
      !(
        this.baseLevels.length === defaultOptions.baseLevels?.length &&
        this.baseLevels.every(
          (level) => defaultOptions.baseLevels?.includes(level),
        )
      )
    ) {
      config.baseLevels = this.baseLevels.slice();
    }

    if (defaultOptions.trackFeaturesToTiles !== this.trackFeaturesToTiles) {
      config.trackFeaturesToTiles = this.trackFeaturesToTiles;
    }

    if (defaultOptions.allowTileAggregation !== this.allowTileAggregation) {
      config.allowTileAggregation = this.allowTileAggregation;
    }

    return config;
  }

  /**
   * clears the cache and removes all entries
   */
  async clearCache(): Promise<void> {
    const rtreePromises: Promise<unknown>[] = [];
    this.cache.forEach((lruCache) => {
      lruCache.forEach((rtreePromise) => {
        rtreePromises.push(rtreePromise);
      });
      lruCache.clear();
    });
    await Promise.all(rtreePromises);
    this.rtreeCache.forEach((rtree) => {
      rtree.clear();
    });
    this.rtreeCache.clear();
    this.featureIdToTileIds.clear();
  }

  destroy(): void {
    super.destroy();
    // eslint-disable-next-line no-void
    void this.clearCache();
    this.cache.clear();
    this.isDestroyed = true;
    this.tileLoadedEvent.destroy();
  }
}

export default TileProvider;
tileProviderClassRegistry.registerClass(TileProvider.className, TileProvider);
