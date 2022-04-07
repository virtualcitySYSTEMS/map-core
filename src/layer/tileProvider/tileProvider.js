import { v4 as uuidv4 } from 'uuid';
import RBush from 'rbush';
import { Rectangle, Math as CesiumMath, WebMercatorTilingScheme, Cartographic } from '@vcmap/cesium';
import LRUCache from 'ol/structs/LRUCache.js';
import { buffer, createOrUpdateFromCoordinate } from 'ol/extent.js';
import { parseBoolean, parseInteger } from '@vcsuite/parsers';
import {
  mercatorProjection,
  mercatorToWgs84Transformer,
  wgs84Projection,
  wgs84ToMercatorTransformer,
} from '../../util/projection.js';
import VcsObject from '../../vcsObject.js';
import VcsEvent from '../../vcsEvent.js';
import { tileProviderClassRegistry } from '../../classRegistry.js';

/**
 * @typedef {Object} tileProviderRTreeEntry
 * @property {number} minX
 * @property {number} minY
 * @property {number} maxX
 * @property {number} maxY
 * @property {import("ol").Feature<import("ol/geom/Geometry").default>} value
 */

/**
 * resolutions to levels
 * @type {Array<number>}
 */
export const mercatorResolutionsToLevel = new Array(25);
for (let i = 0; i < mercatorResolutionsToLevel.length; i++) {
  mercatorResolutionsToLevel[i] = (20037508.3427892 * 2) / 256 / 2 ** (i + 1);
}

/**
 * transforms cesium geographic rectangle to mercator extent
 * @param {import("@vcmap/cesium").Rectangle} rectangle in wgs84 radians
 * @returns {import("ol/extent").Extent} extent in mercator
 */
export function rectangleToExtent(rectangle) {
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

/**
 * @typedef {VcsObjectOptions} TileProviderOptions
 * @property {number} [tileCacheSize=50] size of the LRU (least recently used) tileCache per baseLevel
 * @property {Array<number>} [baseLevels=[15]] baseLevels (these levels will be requested by the loader, all other child levels will be interpolated
 * @property {boolean} [trackFeaturesToTiles=true] tracks in which tile each feature exists. (features without an ID will be ignored). Better performance if deactivated, but does not allow for featureVisibility. Should be set to false if not unique featureID is provided.
 * @property {boolean} [allowTileAggregation=true] allows aggregation of tiles if requested minLevel is lower than provided baseLevels ( if true, allows for aggregating up to two levels (16 child tiles) into a tile)
 * @api
 */

/**
 * @typedef {Object} TileLoadedEvent
 * @property {string} tileId id of the tile
 * @property {import("rbush").default<tileProviderRTreeEntry>} rtree rbush rTree with the features, use rtree.all().map(item => item.value);
 * @api
 */


/**
 * TileProvider class
 *
 * @class
 * @extends {VcsObject}
 * @export
 * @api
 */
class TileProvider extends VcsObject {
  /**
   * @readonly
   * @returns {string}
   */
  static get className() { return 'TileProvider'; }

  /**
   * @returns {TileProviderOptions}
   */
  static getDefaultOptions() {
    return {
      tileCacheSize: 50,
      baseLevels: [15],
      trackFeaturesToTiles: true,
      allowTileAggregation: true,
    };
  }

  /**
   * @param {TileProviderOptions} options
   */
  constructor(options) {
    super(options);
    const defaultOptions = TileProvider.getDefaultOptions();

    /**
     * Cesium Webmercator TilingScheme
     * @type {import("@vcmap/cesium").WebMercatorTilingScheme}
     * @api
     * @readonly
     */
    this.tilingScheme = new WebMercatorTilingScheme();

    /**
     * @type {number}
     * @private
     */
    this._tileCacheSize = parseInteger(options.tileCacheSize, defaultOptions.tileCacheSize);


    const baseLevels = Array.isArray(options.baseLevels) ?
      options.baseLevels.slice() :
      defaultOptions.baseLevels.slice();
    baseLevels.sort((a, b) => { return b - a; });

    /**
     * sorted baseLevels, maximumLevel first example: [18,17,16]
     * @type {Array<number>}
     * @api
     * @readonly
     */
    this.baseLevels = [...new Set(baseLevels)];

    /**
     * cache of tiles for each baseLevel
     * @type {Map<number, LRUCache<Promise<import("rbush").default<tileProviderRTreeEntry>>>>}
     * @api
     */
    this.cache = new Map();

    this.baseLevels.forEach((baseLevel) => {
      this.cache.set(baseLevel, new LRUCache(this.tileCacheSize));
    });

    /**
     * Caches the loaded rTrees for quick Access to all features.
     * @type {Map<string, import("rbush").default<tileProviderRTreeEntry>>}
     * @api
     */
    this.rtreeCache = new Map();

    /**
     * @type {boolean}
     * @api
     * @readonly
     */
    this.trackFeaturesToTiles = parseBoolean(options.trackFeaturesToTiles, defaultOptions.trackFeaturesToTiles);

    /**
     * @type {boolean}
     * @api
     */
    this.allowTileAggregation = parseBoolean(options.allowTileAggregation, defaultOptions.allowTileAggregation);

    /**
     * set of currently loaded featureIds with the corresponding tileIds
     * @type {Map<string, Set<string>>}
     * @api
     * @readonly
     */
    this.featureIdToTileIds = new Map();

    /**
     * is raised for each loaded Tile; has the tileId and a rtree as parameters
     * @type {VcsEvent<TileLoadedEvent>}
     * @api
     */
    this.tileLoadedEvent = new VcsEvent();
  }

  /**
   * use setTileCacheSize to change
   * @type {number}
   * @api
   * @readonly
   */
  get tileCacheSize() {
    return this._tileCacheSize;
  }

  /**
   * @param {number} value
   * @returns {Promise<*>}
   */
  setTileCacheSize(value) {
    const promises = [];
    this._tileCacheSize = value;
    this.cache.forEach((lru, baseLevel) => {
      lru.setSize(this._tileCacheSize);
      while (lru.canExpireCache()) {
        promises.push(this._removeLastTileFromCache(baseLevel));
      }
    });
    return Promise.all(promises);
  }

  /**
   * tracks Features if the features have ids.
   * @param {Array<import("ol").Feature<import("ol/geom/Geometry").default>>} features
   * @param {string} tileId
   * @private
   */
  _trackFeatures(features, tileId) {
    if (this.trackFeaturesToTiles) {
      features.forEach((f) => {
        const featureId = f.getId();
        if (featureId) {
          if (!this.featureIdToTileIds.has(String(featureId))) {
            this.featureIdToTileIds.set(String(featureId), new Set());
          }
          this.featureIdToTileIds.get(String(featureId)).add(tileId);
        }
      });
    }
  }

  /**
   * untracks Features
   * @param {Array<import("ol").Feature<import("ol/geom/Geometry").default>>} features
   * @param {string} tileId
   * @private
   */
  _unTrackFeatures(features, tileId) {
    if (this.trackFeaturesToTiles) {
      features.forEach((f) => {
        const featureId = f.getId();
        if (featureId) {
          if (this.featureIdToTileIds.has(String(featureId))) {
            const tileIdSet = this.featureIdToTileIds.get(String(featureId));
            tileIdSet.delete(tileId);
            if (tileIdSet.size === 0) {
              this.featureIdToTileIds.delete(String(featureId));
            }
          }
        }
      });
    }
  }

  /**
   * @param {Promise<Array<import("ol").Feature<import("ol/geom/Geometry").default>>>} featuresPromise
   * @param {number} baseLevel
   * @param {string} tileId
   * @returns {Promise<*>}
   * @private
   */
  _addTilePromiseToCache(featuresPromise, baseLevel, tileId) {
    const rtreePromise = featuresPromise.then((features) => {
      features.forEach((feature) => {
        if (!feature.getId()) {
          feature.setId(uuidv4());
        }
      });
      const rtree = new RBush(features.length);
      rtree.load(features.map((feature) => {
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
      }).filter(item => item));
      this.tileLoadedEvent.raiseEvent({ tileId, rtree });
      this._trackFeatures(features, tileId);
      this.rtreeCache.set(tileId, rtree);
      return rtree;
    }).catch(() => {
      // Discussion, do we want to go on on tileLoadFailure ?
      this.getLogger().warning(`Could not load Tile ${tileId}`);
      const rtree = new RBush();
      this.rtreeCache.set(tileId, rtree);
      return rtree;
    });

    this.cache.get(baseLevel).set(tileId, rtreePromise);
    if (this.cache.get(baseLevel).canExpireCache()) {
      return Promise.all([rtreePromise, this._removeLastTileFromCache(baseLevel)]);
    }
    return rtreePromise;
  }

  /**
   * @param {number} baseLevel
   * @returns {Promise<*>|undefined}
   * @private
   */
  _removeLastTileFromCache(baseLevel) {
    const tileIdToRemove = this.cache.get(baseLevel).peekLastKey();
    const rtreePromise = this.cache.get(baseLevel).pop();
    if (rtreePromise) {
      return rtreePromise.then((rtree) => {
        if (rtree) {
          this.rtreeCache.delete(tileIdToRemove);
          setTimeout(() => {
            this._unTrackFeatures(rtree.all().map(item => item.value), tileIdToRemove);
            rtree.clear();
          }, 0);
        }
      });
    }
    return undefined;
  }

  /**
   * returns the closest baseLevel for the given resolution
   * @param {number} resolution
   * @param {number} latitude in radians
   * @returns {number}
   * @api
   */
  getBaseLevelForResolution(resolution, latitude) {
    const scaledResolution = resolution / Math.cos(latitude);
    let currentLevel = 0;
    for (let i = 0; i < mercatorResolutionsToLevel.length; i++) {
      currentLevel = i;
      if (scaledResolution >= mercatorResolutionsToLevel[i]) {
        break;
      }
    }
    const baseLevel = this.getBaseLevel(currentLevel);
    return baseLevel === undefined ? this.baseLevels[this.baseLevels.length - 1] : baseLevel;
  }

  /**
   * returns the nearest parent BaseLevel or undefined if no parent baseLevel is found
   * @param {number} level
   * @returns {number|undefined}
   * @api
   */
  getBaseLevel(level) {
    return this.baseLevels.find((baseLevel) => {
      return level >= baseLevel;
    });
  }

  /**
   *
   * @param {number} x
   * @param {number} y
   * @param {number} level
   * @returns {string}
   * @api
   */
  // eslint-disable-next-line class-methods-use-this
  getCacheKey(x, y, level) {
    return `${level}/${x}/${y}`;
  }

  /**
   * @param {number} baseLevel
   * @param {import("@vcmap/cesium").Cartographic} tileCenter
   * @returns {Promise<import("rbush").default<tileProviderRTreeEntry>|null>}
   * @private
   */
  async _getRtreeForBaseTile(baseLevel, tileCenter) {
    const baseTile = this.tilingScheme.positionToTileXY(tileCenter, baseLevel);
    const baseTileCacheKey = this.getCacheKey(baseTile.x, baseTile.y, baseLevel);
    if (this.cache.has(baseLevel)) {
      if (!this.cache.get(baseLevel).containsKey(baseTileCacheKey)) {
        const featuresPromise = this.loader(baseTile.x, baseTile.y, baseLevel);
        this._addTilePromiseToCache(featuresPromise, baseLevel, baseTileCacheKey);
      }
      return this.cache.get(baseLevel).get(baseTileCacheKey);
    }
    return null;
  }

  /**
   * returns the features intersecting this coordinate. Depending on the resolution a buffer around the coordinate is requested.
   * The Buffer has the size of the resolution.
   * @param {import("ol/coordinate").Coordinate} coordinate in mercator
   * @param {number} resolution in m per pixel
   * @returns {Promise<Array<import("ol").Feature<import("ol/geom/Geometry").default>>>}
   * @api
   */
  async getFeaturesByCoordinate(coordinate, resolution) {
    const extent = createOrUpdateFromCoordinate(coordinate);
    buffer(extent, resolution, extent);
    const wgs84Coordinate = mercatorToWgs84Transformer(coordinate);
    const cartographic = Cartographic.fromDegrees(wgs84Coordinate[0], wgs84Coordinate[1]);
    const baseLevel = this.getBaseLevelForResolution(resolution, cartographic.latitude);
    const rtree = await this._getRtreeForBaseTile(baseLevel, cartographic);
    if (rtree) {
      const features = rtree.search({
        minX: extent[0],
        minY: extent[1],
        maxX: extent[2],
        maxY: extent[3],
      }).map(item => item.value);
      return features;
    }
    return [];
  }

  /**
   * returns features for the requested Tile.
   * @param {number} x
   * @param {number} y
   * @param {number} level - if the level is not a base level, will use the closest match
   * @returns {Promise<Array<import("ol").Feature<import("ol/geom/Geometry").default>>>}
   * @api
   */
  async getFeaturesForTile(x, y, level) {
    const rectangle = this.tilingScheme.tileXYToRectangle(x, y, level);
    const tileCenter = Rectangle.center(rectangle);
    const baseLevel = this.getBaseLevel(level);
    if (baseLevel != null) {
      const rtree = await this._getRtreeForBaseTile(baseLevel, tileCenter);
      if (rtree) {
        if (level === baseLevel) {
          return rtree.all().map(item => item.value);
        } else {
          const extent = rectangleToExtent(rectangle);
          const features = rtree.search({
            minX: extent[0],
            minY: extent[1],
            maxX: extent[2],
            maxY: extent[3],
          }).map(item => item.value);
          return features;
        }
      }
    } else if (this.allowTileAggregation && (this.baseLevels[this.baseLevels.length - 1] - level) <= 2) {
      // tile aggregation, only allowed for 2 levels
      const childLevel = level + 1;
      const childNorth = x * 2;
      const childWest = y * 2;
      return [
        ...await this.getFeaturesForTile(childNorth, childWest, childLevel),
        ...await this.getFeaturesForTile(childNorth + 1, childWest, childLevel),
        ...await this.getFeaturesForTile(childNorth + 1, childWest + 1, childLevel),
        ...await this.getFeaturesForTile(childNorth, childWest + 1, childLevel),
      ];
    }
    return [];
  }

  /**
   * Retrieves all features which intersect the given extent. Will load all intersecting tiles.
   * @param {import("@vcmap/core").Extent} extent
   * @param {number=} level - Optional level to request. Will use highest level if omitted. If the provided level is not a base level, will use the closest match.
   * @returns {Promise<Array<import("ol").Feature<import("ol/geom/Geometry").default>>>}
   * @api
   */
  async getFeaturesForExtent(extent, level) {
    let usedLevel = level != null ? level : this.baseLevels[0];
    usedLevel = this.getBaseLevel(usedLevel);
    const [minx, miny, maxx, maxy] = extent.getCoordinatesInProjection(wgs84Projection);
    const topLeft = this.tilingScheme.positionToTileXY(Cartographic.fromDegrees(minx, maxy), usedLevel);
    const bottomRight = this.tilingScheme.positionToTileXY(Cartographic.fromDegrees(maxx, miny), usedLevel);
    const tileCoordinates = [];
    for (let { x } = topLeft; x <= bottomRight.x; x++) {
      for (let { y } = topLeft; y <= bottomRight.y; y++) {
        tileCoordinates.push([x, y]);
      }
    }

    const features = await Promise.all(tileCoordinates.map(([x, y]) => this.getFeaturesForTile(x, y, usedLevel)));
    const mercatorExtent = extent.getCoordinatesInProjection(mercatorProjection);
    return features
      .flat()
      .filter((f) => {
        const geometry = f.getGeometry();
        return geometry && geometry.intersectsExtent(mercatorExtent);
      });
  }

  /**
   * calls the given Function for Each feature currently in the cache
   * @param {function(import("ol").Feature<import("ol/geom/Geometry").default>): void} callback
   * @api
   */
  forEachFeature(callback) {
    this.rtreeCache.forEach((rtree) => {
      rtree.all().map(item => item.value).forEach(callback);
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
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {Promise<Array<import("ol").Feature<import("ol/geom/Geometry").default>>>}
   */
  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  async loader(x, y, z) {
    return [];
  }

  /**
   * @inheritDoc
   * @returns {TileProviderOptions}
   * @api
   */
  toJSON() {
    const config = /** @type {TileProviderOptions} */ (super.toJSON());
    const defaultOptions = TileProvider.getDefaultOptions();

    if (defaultOptions.tileCacheSize !== this.tileCacheSize) {
      config.tileCacheSize = this.tileCacheSize;
    }

    if (!(
      this.baseLevels.length === defaultOptions.baseLevels.length &&
      this.baseLevels.every(level => defaultOptions.baseLevels.includes(level))
    )) {
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
   * @api
   */
  async clearCache() {
    const rtreePromises = [];
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

  /**
   * @inheritDoc
   * @api
   */
  destroy() {
    super.destroy();
    this.clearCache();
    this.cache.clear();
    this.isDestroyed = true;
    this.tileLoadedEvent.destroy();
  }
}

export default TileProvider;
tileProviderClassRegistry.registerClass(TileProvider.className, TileProvider);
