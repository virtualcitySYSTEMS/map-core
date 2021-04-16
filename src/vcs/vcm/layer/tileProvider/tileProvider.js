import Rectangle from 'cesium/Source/Core/Rectangle.js';
import CesiumMath from 'cesium/Source/Core/Math.js';
import VectorSource from 'ol/source/Vector.js';
import WebMercatorTilingScheme from 'cesium/Source/Core/WebMercatorTilingScheme.js';
import LRUCache from 'ol/structs/LRUCache.js';
import { buffer, createOrUpdateFromCoordinate } from 'ol/extent.js';
import Cartographic from 'cesium/Source/Core/Cartographic.js';
import { parseBoolean, parseInteger } from '@vcsuite/parsers';
import { mercatorToWgs84Transformer, wgs84ToMercatorTransformer } from '../../util/projection.js';
import VcsObject from '../../object.js';
import VcsEvent from '../../event/vcsEvent.js';

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
 * @param {Cesium/Rectangle} rectangle in wgs84 radians
 * @returns {ol/Extent} extent in mercator
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
 * @typedef {vcs.vcm.VcsObject.Options} vcs.vcm.layer.tileProvider.TileProvider.Options
 * @property {number} [tileCacheSize=50] size of the LRU (least recently used) tileCache per baseLevel
 * @property {Array<number>} [baseLevels=[15]] baseLevels (these levels will be requested by the loader, all other child levels will be interpolated
 * @property {boolean} [trackFeaturesToTiles=true] tracks in which tile each feature exists. (features without an ID will be ignored). Better performance if deactivated, but does not allow for featureVisibility. Should be set to false if not unique featureID is provided.
 * @property {boolean} [allowTileAggregation=true] allows aggregation of tiles if requested minLevel is lower than provided baseLevels ( if true, allows for aggregating up to two levels (16 child tiles) into a tile)
 * @property {boolean} [useSpatialIndex=true] uses spatial indices for tile cache. Can be deactivated if baseLevels fit directly to increase performance. Also if deactivated the order of the features will be kept.
 * @api
 */

/**
 * @typedef {Object} vcs.vcm.layer.tileProvider.TileProvider.tileLoadedEvent
 * @property {string} tileId id of the tile
 * @property {ol/source/Vector} source vectorSource with the features.
 * @api
 */


/**
 * TileProvider class
 *
 * @class
 * @memberOf vcs.vcm.layer.tileProvider
 * @extends {vcs.vcm.VcsObject}
 * @export
 * @api
 */
class TileProvider extends VcsObject {
  /**
   * @readonly
   * @returns {string}
   */
  static get className() { return 'vcs.vcm.layer.tileProvider.TileProvider'; }

  /**
   * @returns {vcs.vcm.layer.tileProvider.TileProvider.Options}
   */
  static getDefaultOptions() {
    return {
      tileCacheSize: 50,
      baseLevels: [15],
      trackFeaturesToTiles: true,
      allowTileAggregation: true,
      useSpatialIndex: true,
    };
  }

  /**
   * @param {vcs.vcm.layer.tileProvider.TileProvider.Options} options
   */
  constructor(options) {
    super(options);
    const defaultOptions = TileProvider.getDefaultOptions();

    /**
     * Cesium Webmercator TilingScheme
     * @type {Cesium/WebMercatorTilingScheme}
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
     * @type {Map<number, ol/structs/LRUCache<Promise<ol/source/Vector>>>}
     * @api
     */
    this.cache = new Map();

    this.baseLevels.forEach((baseLevel) => {
      this.cache.set(baseLevel, new LRUCache(this.tileCacheSize));
    });

    /**
     * Caches the loaded sources for quick Access to all features.
     * @type {Map<string, ol/source/Vector>}
     * @api
     */
    this.sourceCache = new Map();

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
     * @type {boolean}
     * @api
     */
    this.useSpatialIndex = parseBoolean(options.useSpatialIndex, defaultOptions.useSpatialIndex);

    /**
     * set of currently loaded featureIds with the corresponding tileIds
     * @type {Map<string, Set<string>>}
     * @api
     * @readonly
     */
    this.featureIdToTileIds = new Map();

    /**
     * is raised for each loaded Tile; has the tileId and a ol/vector/Source as parameters
     * @type {vcs.vcm.event.VcsEvent<vcs.vcm.layer.tileProvider.TileProvider.tileLoadedEvent>}
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
   * @param {Array<ol/Feature>} features
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
   * @param {Array<ol/Feature>} features
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
   * @param {Promise<Array<ol/Feature>>} featuresPromise
   * @param {number} baseLevel
   * @param {string} tileId
   * @returns {Promise<*>}
   * @private
   */
  _addTilePromiseToCache(featuresPromise, baseLevel, tileId) {
    const sourcePromise = featuresPromise.then((features) => {
      const tileSource = new VectorSource({ features, useSpatialIndex: this.useSpatialIndex });
      this.tileLoadedEvent.raiseEvent({ tileId, source: tileSource });
      this._trackFeatures(features, tileId);
      this.sourceCache.set(tileId, tileSource);
      return tileSource;
    }).catch(() => {
      // Discussion, do we want to go on on tileLoadFailure ?
      this.getLogger().warning(`Could not load Tile ${tileId}`);
      const tileSource = new VectorSource({ features: [] });
      this.sourceCache.set(tileId, tileSource);
      return tileSource;
    });

    this.cache.get(baseLevel).set(tileId, sourcePromise);
    if (this.cache.get(baseLevel).canExpireCache()) {
      return Promise.all([sourcePromise, this._removeLastTileFromCache(baseLevel)]);
    }
    return sourcePromise;
  }

  /**
   * @param {number} baseLevel
   * @returns {Promise<*>|undefined}
   * @private
   */
  _removeLastTileFromCache(baseLevel) {
    const tileIdToRemove = this.cache.get(baseLevel).peekLastKey();
    const sourcePromise = this.cache.get(baseLevel).pop();
    if (sourcePromise) {
      return sourcePromise.then((source) => {
        if (source) {
          this._unTrackFeatures(source.getFeatures(), tileIdToRemove);
          this.sourceCache.delete(tileIdToRemove);
          source.clear(true);
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
   * @param {Cesium/Cartographic} tileCenter
   * @returns {Promise<ol/source/Vector>|null}
   * @private
   */
  async _getSourceForBaseTile(baseLevel, tileCenter) {
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
   * @param {ol/Coordinate} coordinate in mercator
   * @param {number} resolution in m per pixel
   * @returns {Promise<Array<ol/Feature>>}
   * @api
   */
  async getFeaturesByCoordinate(coordinate, resolution) {
    const extent = createOrUpdateFromCoordinate(coordinate);
    buffer(extent, resolution, extent);
    const wgs84Coordinate = mercatorToWgs84Transformer(coordinate);
    const cartographic = Cartographic.fromDegrees(wgs84Coordinate[0], wgs84Coordinate[1]);
    const baseLevel = this.getBaseLevelForResolution(resolution, cartographic.latitude);
    const source = await this._getSourceForBaseTile(baseLevel, cartographic);
    if (source) {
      const features = [];
      source.forEachFeatureIntersectingExtent(extent, (feature) => {
        features.push(feature);
      });
      return features;
    }
    return [];
  }

  /**
   * returns features for the requested Tile.
   * @param {number} x
   * @param {number} y
   * @param {number} level
   * @returns {Promise<Array<ol/Feature>>}
   * @api
   */
  async getFeaturesForTile(x, y, level) {
    const rectangle = this.tilingScheme.tileXYToRectangle(x, y, level);
    const tileCenter = Rectangle.center(rectangle);
    const baseLevel = this.getBaseLevel(level);
    if (baseLevel != null) {
      const source = await this._getSourceForBaseTile(baseLevel, tileCenter);
      if (source) {
        if (level === baseLevel) {
          return source.getFeatures();
        } else {
          const extent = rectangleToExtent(rectangle);
          return source.getFeaturesInExtent(extent);
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
   * calls the given Function for Each feature currently in the cache
   * @param {function(ol/Feature): void} callback
   * @api
   */
  forEachFeature(callback) {
    this.sourceCache.forEach((source) => {
      source.forEachFeature(callback);
    });
  }

  /**
   * Public API to load features from a source (for example a rest API, or WFS)
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
   *     const { features } = vcs.vcm.layer.GeoJSON.parseGeoJSON(data.data, { dynamicStyle: true });
   *     return features;
   *   });
   *
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {Promise<Array<ol/Feature>>}
   */
  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  async loader(x, y, z) {
    return [];
  }

  /**
   * @inheritDoc
   * @returns {vcs.vcm.layer.tileProvider.TileProvider.Options}
   * @api
   */
  getConfigObject() {
    const config = /** @type {vcs.vcm.layer.tileProvider.TileProvider.Options} */ (super.getConfigObject());
    const defaultOptions = TileProvider.getDefaultOptions();

    if (defaultOptions.tileCacheSize !== this.tileCacheSize) {
      config.tileCacheSize = this.tileCacheSize;
    }

    if (defaultOptions.baseLevels !== this.baseLevels) {
      config.baseLevels = this.baseLevels.slice();
    }

    if (defaultOptions.trackFeaturesToTiles !== this.trackFeaturesToTiles) {
      config.trackFeaturesToTiles = this.trackFeaturesToTiles;
    }
    return config;
  }

  /**
   * clears the cache and removes all entries
   * @api
   */
  async clearCache() {
    const sourcePromises = [];
    this.cache.forEach((lruCache) => {
      lruCache.forEach((sourcePromise) => {
        sourcePromises.push(sourcePromise);
      });
      lruCache.clear();
    });
    await Promise.all(sourcePromises);
    this.sourceCache.forEach((source) => {
      source.clear(true);
    });
    this.sourceCache.clear();
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
