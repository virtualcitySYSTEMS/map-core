import type { CesiumTerrainProvider } from '@vcmap-cesium/engine';
import { createXYZ } from 'ol/tilegrid.js';
import type { Coordinate } from 'ol/coordinate.js';
import type { TileCoord } from 'ol/tilecoord.js';
import type { Extent } from 'ol/extent.js';
import { cartesian2DDistanceSquared } from '../util/math.js';
import {
  parseImageData,
  parseImageMeta,
  parseLegacyImageData,
  getVersionFromImageJson,
} from './parseImageJson.js';
import VcsEvent from '../vcsEvent.js';
import { getTerrainProviderForUrl } from '../layer/terrainHelpers.js';
import Projection, { ProjectionOptions } from '../util/projection.js';
import { getInitForUrl, requestJson } from '../util/fetch.js';
import type ObliqueImage from './obliqueImage.js';
import type {
  ObliqueDataSetTerrainProviderOptions,
  ObliqueImageJson,
} from './obliqueCollection.js';
import type ObliqueImageMeta from './obliqueImageMeta.js';
import type { CopyrightOptions } from '../layer/layer.js';

type ObliqueDataSetImagesLoaded = {
  images: ObliqueImage[];
  tileCoordinate?: string;
};

export type ObliqueDataSetOptions = {
  url: string;
  projection?: ProjectionOptions;
  terrainProvider?: ObliqueDataSetTerrainProviderOptions;
  headers?: Record<string, string>;
};

export enum DataState {
  PENDING = 1,
  LOADING = 2,
  READY = 3,
}

export function getStateFromStatesArray(states: DataState[]): DataState {
  if (states.some((s) => s === DataState.PENDING)) {
    return DataState.PENDING;
  }

  if (states.some((s) => s === DataState.LOADING)) {
    return DataState.LOADING;
  }

  return DataState.READY;
}

class ObliqueDataSet {
  url: string;

  baseUrl: string;

  projection: Projection;

  private _terrainProviderOptions:
    | ObliqueDataSetTerrainProviderOptions
    | undefined;

  private _terrainProvider: CesiumTerrainProvider | undefined = undefined;

  private _imageMetas: ObliqueImageMeta[] = [];

  /**
   * Event raised when images are loaded.
   */
  imagesLoaded = new VcsEvent<ObliqueDataSetImagesLoaded>();

  private _tiles: Map<string, DataState> = new Map();

  private _loadingPromises: Map<string, Promise<void>> = new Map();

  private _state = DataState.PENDING;

  private _tileLevel: number | undefined = undefined;

  private _tileGrid = createXYZ();

  private _images: ObliqueImage[] = [];

  private _loadingPromise: Promise<void> | undefined = undefined;

  private _headers?: Record<string, string>;

  copyright: CopyrightOptions | undefined = undefined;

  constructor(
    url: string,
    projection?: Projection | ProjectionOptions,
    terrainProviderOptions?: ObliqueDataSetTerrainProviderOptions,
    headers?: Record<string, string>,
  ) {
    this.url = url;
    if (!/\.json$/.test(this.url)) {
      this.url = this.url.replace(/\/?$/, '/image.json');
    }

    this.baseUrl = this.url.replace(/\/?([^/]+\.json)?$/, '');

    let projectionObject = projection;
    if (projectionObject && !(projectionObject instanceof Projection)) {
      projectionObject = new Projection(projectionObject);
    }
    this.projection = projectionObject as Projection;

    this._terrainProviderOptions = terrainProviderOptions
      ? { ...terrainProviderOptions }
      : undefined;

    this._headers = structuredClone(headers);
  }

  /**
   * The loaded images of this DataSet
   */
  get images(): ObliqueImage[] {
    return this._images.slice();
  }

  /**
   * Gets the state of the meta data information. For tiled data sets, this does not
   * reflect the state of loaded tiles.
   */
  get state(): DataState {
    return this._state;
  }

  /**
   * Loads the data set.
   */
  async load(): Promise<void> {
    if (!this._loadingPromise) {
      this._state = DataState.LOADING;
      const init = getInitForUrl(this.url, this._headers);
      this._loadingPromise = requestJson<ObliqueImageJson>(this.url, init)
        .then((data) => {
          return this._initialize(data);
        })
        .catch((err) => {
          return Promise.reject(err);
        });
    }
    return this._loadingPromise;
  }

  /**
   * Returns all tiles of this data set, including its DataState
   */
  getTiles(): Record<string, DataState> {
    const tiles: Record<string, DataState> = {};
    this._tiles.forEach((state, tile) => {
      tiles[tile] = state;
    });
    return tiles;
  }

  /**
   * initialize the DataSet with an existing Object.
   * DataSets cannot be initialized more then once.
   */
  async initialize(json: ObliqueImageJson): Promise<void> {
    if (this._state !== DataState.PENDING) {
      throw new Error('DataSet has already been loaded');
    }
    this._loadingPromise = Promise.resolve();
    await this._initialize(json);
  }

  private async _initialize(json: ObliqueImageJson): Promise<void> {
    if (this._terrainProviderOptions?.url) {
      const terrainProviderOptions = {
        requestVertexNormals: this._terrainProviderOptions.requestVertexNormals,
        requestWaterMask: this._terrainProviderOptions.requestWaterMask,
      };
      this._terrainProvider = await getTerrainProviderForUrl(
        this._terrainProviderOptions.url,
        terrainProviderOptions,
        this._terrainProviderOptions.headers,
      );
    }
    this._parseMetaData(json);
    this._state = DataState.READY;
  }

  private _parseMetaData(json: ObliqueImageJson): void {
    this._imageMetas = parseImageMeta(
      json,
      this.baseUrl,
      this.projection,
      this._terrainProvider,
      this._headers,
    );
    const { version, buildNumber } = getVersionFromImageJson(json);

    if (json.tileLevel) {
      this._tileLevel = json.tileLevel;
      json.availableTiles!.forEach((tile) => {
        this._tiles.set(tile, DataState.PENDING);
      });
    } else {
      let images: ObliqueImage[] = [];
      if (version >= 3.5 || (version === 3.4 && buildNumber > 36)) {
        images = parseImageData(json, this._imageMetas);
      } else if (version >= 3.1 || version === undefined) {
        images = parseLegacyImageData(json, this._imageMetas);
      }
      if (images.length > 0) {
        this._images = images;
        this.imagesLoaded.raiseEvent({ images });
      }
    }
  }

  private _getClosestTileCoordinate(
    mercatorCoordinate: Coordinate,
  ): TileCoord | null {
    if (!this._tileLevel) {
      return null;
    }
    const actualTile = this._tileGrid.getTileCoordForCoordAndZ(
      mercatorCoordinate,
      this._tileLevel,
    );
    if (this._tiles.has(actualTile.join('/'))) {
      return actualTile;
    }

    let minDistance = Infinity;
    let minTile = null;
    [...this._tiles.keys()].forEach((tile) => {
      const tileCoord = tile.split('/').map(Number);
      const squaredDist = cartesian2DDistanceSquared(
        [actualTile[1], actualTile[2]],
        [tileCoord[1], tileCoord[2]],
      );
      if (squaredDist < minDistance) {
        minDistance = squaredDist;
        minTile = tileCoord;
      }
    });
    return minTile || actualTile;
  }

  private _getTileCoordinatesForExtent(extent: Extent): string[] {
    const topLeft = this._tileGrid.getTileCoordForCoordAndZ(
      [extent[0], extent[3]],
      this._tileLevel as number,
    );
    const bottomRight = this._tileGrid.getTileCoordForCoordAndZ(
      [extent[2], extent[1]],
      this._tileLevel as number,
    );
    const tileCoordinates = [];
    for (let x = topLeft[1]; x <= bottomRight[1]; x++) {
      for (let y = topLeft[2]; y <= bottomRight[2]; y++) {
        tileCoordinates.push([this._tileLevel, x, y]);
      }
    }

    return tileCoordinates
      .map((tc) => tc.join('/'))
      .filter((tc) => {
        const state = this._tiles.get(tc);
        return state && state !== DataState.READY;
      });
  }

  /**
   * Requests the state of data at a certain location. No data is automatically READY.
   * @param  mercatorCoordinate - coordinate in web mercator
   */
  getDataStateForCoordinate(mercatorCoordinate: Coordinate): DataState {
    if (this._state !== DataState.READY || this._tiles.size === 0) {
      return this._state;
    }

    const tileCoordinate =
      this._getClosestTileCoordinate(mercatorCoordinate)!.join('/');

    return this._tiles.has(tileCoordinate)
      ? (this._tiles.get(tileCoordinate) as DataState)
      : DataState.READY;
  }

  /**
   * Loads all the tiles for a given extent.
   */
  getDataStateForExtent(extent: Extent): DataState {
    if (this._state !== DataState.READY || this._tiles.size === 0) {
      return this._state;
    }

    const tileCoordinates = this._getTileCoordinatesForExtent(extent);
    const states = tileCoordinates
      .map((tc) => this._tiles.get(tc))
      .filter((s) => s) as DataState[];
    return getStateFromStatesArray(states);
  }

  private _loadTile(stringTileCoordinates: string): Promise<void> {
    if (this._loadingPromises.has(stringTileCoordinates)) {
      return this._loadingPromises.get(stringTileCoordinates) as Promise<void>;
    }

    if (this._tiles.get(stringTileCoordinates) !== DataState.PENDING) {
      return Promise.resolve();
    }

    this._tiles.set(stringTileCoordinates, DataState.LOADING);
    const init = getInitForUrl(this.url, this._headers);
    const promise = requestJson<ObliqueImageJson>(
      `${this.baseUrl}/${stringTileCoordinates}.json`,
      init,
    )
      .then((data) => {
        const images = parseImageData(data, this._imageMetas);
        if (images.length > 0) {
          this._images = this._images.concat(images);
          this.imagesLoaded.raiseEvent({
            images,
            tileCoordinate: stringTileCoordinates,
          });
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
   * @param  mercatorCoordinate - coordinate in web mercator
   */
  async loadDataForCoordinate(mercatorCoordinate: Coordinate): Promise<void> {
    const tileCoordinate = this._getClosestTileCoordinate(mercatorCoordinate);
    if (tileCoordinate) {
      await this._loadTile(tileCoordinate.join('/'));
    }
  }

  /**
   * Loads all the tiles for a given extent.
   */
  async loadDataForExtent(extent: Extent): Promise<void> {
    const tileCoordinates = this._getTileCoordinatesForExtent(extent);
    await Promise.all(tileCoordinates.map((tc) => this._loadTile(tc)));
  }

  destroy(): void {
    this.imagesLoaded.destroy();
    this._images = [];
    this._imageMetas = [];
    this._tiles.clear();
    this._loadingPromises.clear();
    this._terrainProvider = undefined;
  }

  toJSON(): ObliqueDataSetOptions {
    const config: ObliqueDataSetOptions = { url: this.url };
    if (this.projection) {
      config.projection = this.projection.toJSON();
    }
    if (this._terrainProviderOptions) {
      config.terrainProvider = { ...this._terrainProviderOptions };
    }
    if (this._headers) {
      config.headers = this._headers;
    }
    return config;
  }
}

export default ObliqueDataSet;
