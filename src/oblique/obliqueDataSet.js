import { createXYZ } from 'ol/tilegrid.js';
import { cartesian2DDistance } from '../util/math.js';
import { parseImageData, parseImageMeta, parseLegacyImageData, getVersionFromImageJson } from './parseImageJson.js';
import VcsEvent from '../vcsEvent.js';
import { getTerrainProviderForUrl } from '../layer/terrainHelpers.js';
import Projection from '../util/projection.js';
import { requestJson } from '../util/fetch.js';

/**
 * @typedef {Object} ObliqueDataSetImagesLoaded
 * @property {Array<import("@vcmap/core").ObliqueImage>} images - the loaded images
 * @property {string} [tileCoordinate] - an optional tile coordinate
 */

/**
 * Enumeration of data set states
 * @enum {number}
 * @property {number} PENDING
 * @property {number} LOADING
 * @property {number} READY
 * @export
 * @api
 */
export const DataState = {
  PENDING: 1,
  LOADING: 2,
  READY: 3,
};

/**
 * @param {Array<DataState>} states
 * @returns {DataState}
 */
export function getStateFromStatesArray(states) {
  if (states.some(s => s === DataState.PENDING)) {
    return DataState.PENDING;
  }

  if (states.some(s => s === DataState.LOADING)) {
    return DataState.LOADING;
  }

  return DataState.READY;
}

/**
 * @class
 * @export
 */
class ObliqueDataSet {
  /**
   * @param {string} url
   * @param {import("@vcmap/core").Projection|ProjectionOptions=} projection
   * @param {TerrainProviderOptions=} terrainProviderOptions
   */
  constructor(url, projection, terrainProviderOptions) {
    /** @type {string} */
    this.url = url;
    if (!/\.json$/.test(this.url)) {
      this.url = this.url.replace(/\/?$/, '/image.json');
    }

    /** @type {string} */
    this.baseUrl = this.url.replace(/\/?([^/]+\.json)?$/, '');

    let projectionObject = projection;
    if (projectionObject && !(projectionObject instanceof Projection)) {
      projectionObject = new Projection(projectionObject);
    }
    /** @type {import("@vcmap/core").Projection} */
    this.projection = /** @type {import("@vcmap/core").Projection} */ (projectionObject);
    /**
     * @type {TerrainProviderOptions}
     * @private
     */
    this._terrainProviderOptions = terrainProviderOptions ? { ...terrainProviderOptions } : undefined;
    /**
     * @type {import("@vcmap/cesium").CesiumTerrainProvider|undefined}
     * @private
     */
    this._terrainProvider = this._terrainProviderOptions ?
      getTerrainProviderForUrl(this._terrainProviderOptions) :
      undefined;
    /**
     * @type {Array<import("@vcmap/core").ObliqueImageMeta>}
     * @private
     */
    this._imageMetas = [];
    /**
     * Event raised when images are loaded.
     * @type {import("@vcmap/core").VcsEvent<ObliqueDataSetImagesLoaded>}
     * @api
     */
    this.imagesLoaded = new VcsEvent();
    /** @type {Map<string, DataState>} */
    this._tiles = new Map();
    /** @type {Map<string, Promise<void>>} */
    this._loadingPromises = new Map();
    this._state = DataState.PENDING;
    /**
     * @type {number|null}
     * @private
     */
    this._tileLevel = null;
    /** @type {import("ol/tilegrid/TileGrid").default} */
    this._tileGrid = createXYZ();

    /**
     * @type {Array<import("@vcmap/core").ObliqueImage>}
     * @private
     */
    this._images = [];

    /**
     * @type {CopyrightOptions|undefined}
     * @api
     */
    this.copyright = undefined;
  }

  /**
   * The loaded images of this DataSet
   * @api
   * @readonly
   * @type {Array<import("@vcmap/core").ObliqueImage>}
   */
  get images() {
    return this._images.slice();
  }

  /**
   * Gets the state of the meta data information. For tiled data sets, this does not
   * reflect the state of loaded tiles.
   * @type {DataState}
   * @api
   * @readonly
   */
  get state() {
    return this._state;
  }

  /**
   * @type {import("@vcmap/cesium").CesiumTerrainProvider|undefined}
   * @readonly
   */
  get terrainProvider() {
    return this._terrainProvider;
  }

  /**
   * Loads the data set.
   * @returns {Promise<void>}
   * @api
   */
  load() {
    if (!this._loadingPromise) {
      this._state = DataState.LOADING;

      this._loadingPromise = requestJson(this.url)
        .then(data => this._initialize(data))
        .catch((err) => {
          return Promise.reject(err);
        });
    }
    return this._loadingPromise;
  }

  /**
   * Returns all tiles of this data set, including its DataState
   * @returns {Object<string, DataState>}
   * @api
   */
  getTiles() {
    /** @type {Object<string, DataState>} */
    const tiles = {};
    this._tiles.forEach((state, tile) => {
      tiles[tile] = state;
    });
    return tiles;
  }

  /**
   * initialize the DataSet with an existing Object.
   * DataSets cannot be initialized more then once.
   * @param {ObliqueImageJson} json
   * @api
   */
  initialize(json) {
    if (this._state !== DataState.PENDING) {
      throw new Error('DataSet has already been loaded');
    }
    this._loadingPromise = Promise.resolve();
    this._initialize(json);
  }

  /**
   * @param {ObliqueImageJson} json
   * @private
   */
  _initialize(json) {
    this._parseMetaData(json);
    this._state = DataState.READY;
  }

  /**
   * @param {ObliqueImageJson} json
   * @private
   */
  _parseMetaData(json) {
    this._imageMetas = parseImageMeta(json, this.baseUrl, this.projection, this.terrainProvider);
    const { version, buildNumber } = getVersionFromImageJson(json);

    if (json.tileLevel) {
      this._tileLevel = json.tileLevel;
      json.availableTiles.forEach((tile) => {
        this._tiles.set(tile, DataState.PENDING);
      });
    } else {
      let images = [];
      if (version >= 3.5 || (version === 3.4 && buildNumber > 36)) {
        images = parseImageData(json, this._imageMetas);
      } else if (version >= 3.1 || version === null) {
        images = parseLegacyImageData(json, this._imageMetas);
      }
      if (images.length > 0) {
        this._images = images;
        this.imagesLoaded.raiseEvent({ images });
      }
    }
  }

  /**
   * @param {import("ol/coordinate").Coordinate} mercatorCoordinate
   * @returns {import("ol/tilecoord").TileCoord|null}
   * @private
   */
  _getClosestTileCoordinate(mercatorCoordinate) {
    if (!this._tileLevel) {
      return null;
    }
    const actualTile = this._tileGrid.getTileCoordForCoordAndZ(mercatorCoordinate, this._tileLevel);
    if (this._tiles.has(actualTile.join('/'))) {
      return actualTile;
    }

    let minDistance = Infinity;
    let minTile = null;
    [...this._tiles.keys()].forEach((tile) => {
      const tileCoord = tile.split('/').map(Number);
      const dist = cartesian2DDistance([actualTile[1], actualTile[2]], [tileCoord[1], tileCoord[2]]);
      if (dist < minDistance) {
        minDistance = dist;
        minTile = tileCoord;
      }
    });
    return minTile || actualTile;
  }

  /**
   * @param {import("ol/extent").Extent} extent
   * @returns {Array<string>}
   * @private
   */
  _getTileCoordinatesForExtent(extent) {
    const topLeft = this._tileGrid.getTileCoordForCoordAndZ([extent[0], extent[3]], this._tileLevel);
    const bottomRight = this._tileGrid.getTileCoordForCoordAndZ([extent[2], extent[1]], this._tileLevel);
    const tileCoordinates = [];
    for (let x = topLeft[1]; x <= bottomRight[1]; x++) {
      for (let y = topLeft[2]; y <= bottomRight[2]; y++) {
        tileCoordinates.push([this._tileLevel, x, y]);
      }
    }

    return tileCoordinates
      .map(tc => tc.join('/'))
      .filter((tc) => {
        const state = this._tiles.get(tc);
        return state && state !== DataState.READY;
      });
  }

  /**
   * Requests the state of data at a certain location. No data is automatically READY.
   * @param {import("ol/coordinate").Coordinate} mercatorCoordinate - coordinate in web mercator
   * @returns {DataState}
   * @api
   */
  getDataStateForCoordinate(mercatorCoordinate) {
    if (this._state !== DataState.READY || this._tiles.size === 0) {
      return this._state;
    }

    const tileCoordinate = this._getClosestTileCoordinate(mercatorCoordinate).join('/');
    return this._tiles.has(tileCoordinate) ? this._tiles.get(tileCoordinate) : DataState.READY;
  }

  /**
   * Loads all the tiles for a given extent.
   * @param {import("ol/extent").Extent} extent
   * @returns {DataState}
   * @api
   */
  getDataStateForExtent(extent) {
    if (this._state !== DataState.READY || this._tiles.size === 0) {
      return this._state;
    }

    const tileCoordinates = this._getTileCoordinatesForExtent(extent);
    const states = tileCoordinates
      .map(tc => this._tiles.get(tc))
      .filter(s => s);
    return getStateFromStatesArray(states);
  }

  /**
   * @param {string} stringTileCoordinates
   * @returns {Promise<void>}
   * @private
   */
  _loadTile(stringTileCoordinates) {
    if (this._loadingPromises.has(stringTileCoordinates)) {
      return this._loadingPromises.get(stringTileCoordinates);
    }

    if (this._tiles.get(stringTileCoordinates) !== DataState.PENDING) {
      return Promise.resolve();
    }

    this._tiles.set(stringTileCoordinates, DataState.LOADING);
    const promise = requestJson(`${this.baseUrl}/${stringTileCoordinates}.json`)
      .then((data) => {
        const images = parseImageData(data, this._imageMetas);
        if (images.length > 0) {
          this._images = this._images.concat(images);
          this.imagesLoaded.raiseEvent({ images, tileCoordinate: stringTileCoordinates });
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error(err);
      })
      .finally(() => {
        this._tiles.set(stringTileCoordinates, DataState.READY);
        this._loadingPromises.delete(stringTileCoordinates);
      });

    this._loadingPromises.set(stringTileCoordinates, promise);
    return promise;
  }

  /**
   * Loads the closest data tile for a certain location. Resolves when all data for the location has been loaded.
   * @param {import("ol/coordinate").Coordinate} mercatorCoordinate - coordinate in web mercator
   * @returns {Promise<void>}
   * @api
   */
  async loadDataForCoordinate(mercatorCoordinate) {
    const tileCoordinate = this._getClosestTileCoordinate(mercatorCoordinate);
    if (tileCoordinate) {
      await this._loadTile(tileCoordinate.join('/'));
    }
  }

  /**
   * Loads all the tiles for a given extent.
   * @param {import("ol/extent").Extent} extent
   * @returns {Promise<void>}
   * @api
   */
  async loadDataForExtent(extent) {
    const tileCoordinates = this._getTileCoordinatesForExtent(extent);
    await Promise.all(tileCoordinates.map(tc => this._loadTile(tc)));
  }

  destroy() {
    this.imagesLoaded.destroy();
    this._images = [];
    this._imageMetas = [];
    this._tiles.clear();
    this._loadingPromises.clear();
    this._tileGrid = null;
    this._terrainProvider = null;
  }

  /**
   * @returns {ObliqueDataSetOptions}
   */
  toJSON() {
    const config = { url: this.url };
    if (this.projection) {
      config.projection = this.projection.toJSON();
    }
    if (this._terrainProviderOptions) {
      config.terrainProvider = { ...this._terrainProviderOptions };
    }
    return config;
  }
}

export default ObliqueDataSet;
