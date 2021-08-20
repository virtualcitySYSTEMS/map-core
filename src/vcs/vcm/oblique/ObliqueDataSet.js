import CesiumEvent from '@vcmap/cesium/Source/Core/Event.js';
import axios from 'axios';
import { createXYZ } from 'ol/tilegrid.js';
import { cartesian2DDistance, destroyCesiumEvent } from './helpers.js';
import { parseImageData, parseImageMeta, parseLegacyImageData, getVersionFromImageJson } from './parseImageJson.js';

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
   * @param {import("ol/proj/Projection").default} projection
   * @param {import("cesium").CesiumTerrainProvider=} terrainProvider
   */
  constructor(url, projection, terrainProvider) {
    /** @type {string} */
    this.url = url;
    if (!/\.json$/.test(this.url)) {
      this.url = this.url.replace(/\/?$/, '/image.json');
    }

    /** @type {string} */
    this.baseUrl = this.url.replace(/\/?([^/]+\.json)?$/, '');
    /** @type {import("ol/proj/Projection").default} */
    this.projection = projection;
    /** @type {import("cesium").CesiumTerrainProvider|undefined} */
    this.terrainProvider = terrainProvider;
    /**
     * @type {Array<ObliqueImageMeta>}
     * @private
     */
    this._imageMetas = [];
    /**
     * Event raised when images are loaded. Is passed an Array of ObliqueImages as the first argument and optionally
     * a string representing the tile coordinate ("z/x/y"), if the images where loaded for a tile.
     * @type {import("cesium").Event}
     * @api
     */
    this.imagesLoaded = new CesiumEvent();
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
     * @type {Array<ObliqueImage>}
     * @private
     */
    this._images = [];

    /**
     * @type {vcs.vcm.layer.CopyrightOptions|undefined}
     * @api
     */
    this.copyright = undefined;
  }

  /**
   * The loaded images of this DataSet
   * @api
   * @readonly
   * @type {Array<ObliqueImage>}
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
   * Loads the data set.
   * @returns {Promise<void>}
   * @api
   */
  load() {
    if (!this._loadingPromise) {
      this._state = DataState.LOADING;

      this._loadingPromise = axios.get(this.url)
        .then(({ data }) => {
          this._initialize(data);
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
        this.imagesLoaded.raiseEvent(images);
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
      const tileCoord = tile.split('/');
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
    const promise = axios
      .get(`${this.baseUrl}/${stringTileCoordinates}.json`)
      .then(({ data }) => {
        const images = parseImageData(data, this._imageMetas);
        if (images.length > 0) {
          this._images = this._images.concat(images);
          this.imagesLoaded.raiseEvent(images, stringTileCoordinates);
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
    destroyCesiumEvent(this.imagesLoaded);
    this._images = [];
    this._imageMetas = [];
    this._tiles.clear();
    this._loadingPromises.clear();
    this._tileGrid = null;
    this.terrainProvider = null;
  }
}

export default ObliqueDataSet;
