import { parseInteger, parseNumber } from '@vcsuite/parsers';
import RBush from 'rbush';
import knn from 'rbush-knn';
import { getTransform } from 'ol/proj.js';
import { createXYZ } from 'ol/tilegrid.js';
import Feature from 'ol/Feature.js';
import Polygon, { fromExtent } from 'ol/geom/Polygon.js';
import VectorSource from 'ol/source/Vector.js';
import {
  boundingExtent,
  buffer,
  containsCoordinate,
  getCenter,
  type Extent,
} from 'ol/extent.js';
import type { Coordinate } from 'ol/coordinate.js';
import type { Size } from 'ol/size.js';
import VcsEvent from '../vcsEvent.js';
import ObliqueDataSet, {
  DataState,
  getStateFromStatesArray,
  type ObliqueDataSetOptions,
} from './obliqueDataSet.js';
import { ObliqueViewDirection } from './obliqueViewDirection.js';
import { mercatorProjection } from '../util/projection.js';
import VcsObject, { VcsObjectOptions } from '../vcsObject.js';
import type { TerrainProviderOptions } from '../layer/terrainHelpers.js';
import type ObliqueImage from './obliqueImage.js';
import type { ObliqueViewOptions } from './obliqueView.js';

export type ObliqueCameraOptions = {
  name: string;
  'principal-point': Coordinate;
  'pixel-size'?: Coordinate;
  'radial-distorsion-expected-2-found'?: number[];
  'radial-distorsion-found-2-expected'?: number[];
  size?: Size;
};

type ObliqueGeneralImageInfo = {
  width: number;
  height: number;
  'tile-resolution': number[];
  'tile-width': number;
  'tile-height': number;
  cameraParameter?:
    | ObliqueCameraOptions[]
    | Record<string, Omit<ObliqueCameraOptions, 'name'>>;
  crs: string;
};

export type ObliqueImageJson = {
  generalImageInfo: ObliqueGeneralImageInfo;
  tileLevel?: number;
  images?: Array<unknown[]>;
  availableTiles?: string[];
  version?: string;
};

export type ObliqueVersion = {
  version: number;
  buildNumber: number;
};

export type ObliqueDataSetTerrainProviderOptions = TerrainProviderOptions & {
  url: string;
  headers?: Record<string, string>;
};

export type ObliqueCollectionOptions = VcsObjectOptions & {
  dataSets?: (ObliqueDataSet | ObliqueDataSetOptions)[];
  maxZoom?: number;
  minZoom?: number;
  scaleFactor?: number;
  hideLevels?: number;
  datasourceId?: string;
};

export type ObliqueImageRbushItem = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  name: string;
};

function getImageFeatures(images: ObliqueImage[]): Feature[] {
  return images.map((image) => {
    const transform = getTransform(
      image.meta.projection.proj,
      mercatorProjection.proj,
    );
    const feature = new Feature({
      // error in TransformFunction type definition, remove undefined after openlayer fixed the type
      geometry: new Polygon([
        image.groundCoordinates.map((c) =>
          transform(c.slice(0, 2), undefined, undefined),
        ),
      ]),
      viewDirection: image.viewDirection,
    });
    feature.setId(image.name);
    return feature;
  });
}

function getTileFeatures(tiles: Record<string, DataState>): Feature[] {
  const tileGrid = createXYZ();
  return Object.entries(tiles).map(([stringTileCoord, state]) => {
    const tileCoord = stringTileCoord
      .split('/')
      .map((tc) => Number.parseInt(tc, 10));

    const extent = tileGrid.getTileCoordExtent(tileCoord);
    const feature = new Feature({
      geometry: fromExtent(extent),
      state,
    });
    feature.setId(stringTileCoord);
    return feature;
  });
}

class ObliqueCollection extends VcsObject {
  static get className(): string {
    return 'ObliqueCollection';
  }

  static getDefaultOptions(): ObliqueCollectionOptions {
    return {
      maxZoom: 0,
      minZoom: 0,
      scaleFactor: 4,
      dataSets: undefined,
      hideLevels: 0,
      datasourceId: undefined,
    };
  }

  /**
   * Maps each direction to an RTree
   */
  private _directionTrees: Map<
    ObliqueViewDirection,
    RBush<ObliqueImageRbushItem>
  > = new Map();

  /**
   * Maps image name to image
   */
  private _images: Map<string, ObliqueImage> = new Map();

  /**
   * Maps urls to general infos & cameras
   */
  private _dataSets: ObliqueDataSet[] = [];

  viewOptions: ObliqueViewOptions;

  private _loaded = false;

  /**
   * Event raised when images are loaded. Is passed an Array of ObliqueImages as its only argument.
   */
  imagesLoaded: VcsEvent<Array<ObliqueImage>> = new VcsEvent();

  private _tileFeatureSource: VectorSource | null = null;

  private _imageFeatureSource: VectorSource | null = null;

  private _destroyed = new VcsEvent<void>();

  private _loadingPromise: Promise<void> | undefined = undefined;

  /**
   * Optional Id to synchronize with the vcPublisher Datasources. This can also be used to track a connection
   * to other sources of data.
   */
  datasourceId?: string;

  /**
   * @param  options
   */
  constructor(options: ObliqueCollectionOptions) {
    super(options);
    const defaultOptions = ObliqueCollection.getDefaultOptions();

    this.viewOptions = {
      maxZoom: parseInteger(options.maxZoom, defaultOptions.maxZoom),
      minZoom: parseInteger(options.minZoom, defaultOptions.minZoom),
      scaleFactor: parseNumber(options.scaleFactor, defaultOptions.scaleFactor),
      hideLevels: parseInteger(options.hideLevels, defaultOptions.hideLevels),
    };

    if (Array.isArray(options.dataSets)) {
      options.dataSets.forEach((dataSet) => {
        this._addDataSet(dataSet);
      });
    }

    this.datasourceId = options.datasourceId || defaultOptions.datasourceId;
  }

  get dataSets(): ObliqueDataSet[] {
    return this._dataSets.slice();
  }

  /**
   * Indicates, that this collection has been loaded
   */
  get loaded(): boolean {
    return this._loaded;
  }

  get destroyed(): VcsEvent<void> {
    return this._destroyed;
  }

  /**
   * A vector source of all tiles available to this collection in mercator. The feature have a "state" property,
   * the id is the string tile coordinate "z/x/y" of the tile
   */
  get tileFeatureSource(): VectorSource {
    if (!this._tileFeatureSource) {
      this._tileFeatureSource = this._createTileFeatureSource();
    }
    return this._tileFeatureSource;
  }

  /**
   * A vector source of all image currently loaded for this collection in mercator.
   * The id is the image name. The feature has a "viewDirection" property.
   */
  get imageFeatureSource(): VectorSource {
    if (!this._imageFeatureSource) {
      this._imageFeatureSource = this._createImageFeatureSource();
    }
    return this._imageFeatureSource;
  }

  /**
   * All currently loaded images
   */
  get images(): ObliqueImage[] {
    return [...this._images.values()];
  }

  private _createTileFeatureSource(): VectorSource {
    const features = getTileFeatures(this.getTiles());
    const source = new VectorSource();
    source.addFeatures(features);
    return source;
  }

  private _createImageFeatureSource(): VectorSource {
    const features = getImageFeatures([...this._images.values()]);
    const source = new VectorSource();
    source.addFeatures(features);
    return source;
  }

  private async _loadDataSet(dataSet: ObliqueDataSet): Promise<void> {
    await dataSet.load();
    if (this._tileFeatureSource) {
      const features = getTileFeatures(dataSet.getTiles());
      this._tileFeatureSource.addFeatures(features);
    }
  }

  /**
   * Adds an oblique data set to this collection.
   */
  private _addDataSet(
    dataSetOptions: ObliqueDataSet | ObliqueDataSetOptions,
  ): void {
    let dataSet;
    if (dataSetOptions instanceof ObliqueDataSet) {
      dataSet = dataSetOptions;
    } else {
      dataSet = new ObliqueDataSet(
        dataSetOptions.url,
        dataSetOptions.projection,
        dataSetOptions.terrainProvider,
        dataSetOptions.headers,
      );
    }
    dataSet.imagesLoaded.addEventListener(({ images, tileCoordinate }) => {
      this._loadImages(images, tileCoordinate);
    });
    this._loadImages(dataSet.images);
    this._dataSets.push(dataSet);
  }

  /**
   * Adds an oblique data set to this collection.
   */
  async addDataSet(dataSet: ObliqueDataSet): Promise<void> {
    // XXX check for dataset here?
    if (this._loadingPromise) {
      await this._loadingPromise;
      await this._loadDataSet(dataSet);
    }
    this._addDataSet(dataSet);
  }

  /**
   * Loads all meta data associated with this collection
   */
  async load(): Promise<void> {
    if (!this._loadingPromise) {
      this._loadingPromise = Promise.all(
        this._dataSets.map((i) => this._loadDataSet(i)),
      ).then(() => {});
      await this._loadingPromise;
      this._loaded = true;
    }

    await this._loadingPromise;
  }

  private _loadImages(images: ObliqueImage[], tileCoordinate?: string): void {
    if (tileCoordinate && this._tileFeatureSource) {
      const tileFeature =
        this._tileFeatureSource.getFeatureById(tileCoordinate);
      if (tileFeature) {
        tileFeature.set('state', DataState.READY);
      }
    }

    const directions: Map<ObliqueViewDirection, ObliqueImageRbushItem[]> =
      new Map();
    images.forEach((image) => {
      this._images.set(image.name, image);
      if (!directions.has(image.viewDirection)) {
        directions.set(image.viewDirection, []);
      }

      const transform = getTransform(
        image.meta.projection.proj,
        mercatorProjection.proj,
      );
      const coord = image.centerPointOnGround.slice(0, 2);
      // error in TransformFunction type definition, remove undefined after openlayer fixed the type
      transform(coord, coord, undefined);
      directions.get(image.viewDirection)!.push({
        minX: coord[0],
        minY: coord[1],
        maxX: coord[0],
        maxY: coord[1],
        name: image.name,
      });
    });

    directions.forEach((imageItems, direction) => {
      if (!this._directionTrees.get(direction)) {
        this._directionTrees.set(direction, new RBush());
      }
      this._directionTrees.get(direction)!.load(imageItems);
    });

    if (this._imageFeatureSource) {
      const features = getImageFeatures(images);
      this._imageFeatureSource.addFeatures(features);
    }
    this.imagesLoaded.raiseEvent(images);
  }

  /**
   * Gets all available tile coordinates across all data sets, including their loaded state. Return value is
   * an object, where the key is the tile coordinate in z/x/y and the value is the data state
   */
  getTiles(): Record<string, DataState> {
    const tiles: Record<string, DataState> = {};
    this._dataSets.forEach((dataSet) => {
      Object.entries(dataSet.getTiles()).forEach(([tileCoord, state]) => {
        if (tiles[tileCoord]) {
          tiles[tileCoord] = getStateFromStatesArray([state, tiles[tileCoord]]);
        } else {
          tiles[tileCoord] = state;
        }
      });
    });

    return tiles;
  }

  /**
   * Returns an image by its name, if it has been loaded
   */
  getImageByName(name: string): ObliqueImage | undefined {
    return this._images.get(name);
  }

  /**
   * Returns a list of viewDirections which a currently available in this collection
   */
  getAvailableViewDirections(): ObliqueViewDirection[] {
    return [...this._directionTrees.keys()];
  }

  /**
   * Returns the state of the data for a given location an all underlying data sources
   * @param  mercatorCoordinate - coordinate in web mercator
   */
  getDataStateForCoordinate(mercatorCoordinate: Coordinate): DataState {
    const states = this._dataSets.map((i) =>
      i.getDataStateForCoordinate(mercatorCoordinate),
    );
    return getStateFromStatesArray(states);
  }

  /**
   * Returns the state of the data for a given location an all underlying data sources
   * @param  extent - coordinate in web mercator
   */
  getDataStateForExtent(extent: Coordinate): DataState {
    const states = this._dataSets.map((i) => i.getDataStateForExtent(extent));
    return getStateFromStatesArray(states);
  }

  /**
   * Loads data for a given mercator Coordinate
   * @param  mercatorCoordinate - coordinate in web mercator
   */
  async loadDataForCoordinate(mercatorCoordinate: Coordinate): Promise<void> {
    await Promise.all(
      this._dataSets.map((i) => i.loadDataForCoordinate(mercatorCoordinate)),
    );
  }

  /**
   * Loads all data tiles in the given extent
   */
  async loadDataForExtent(extent: Extent): Promise<void> {
    await Promise.all(this._dataSets.map((i) => i.loadDataForExtent(extent)));
  }

  private _getNextImageForCoordinate(
    mercatorCoordinate: Coordinate,
    direction: ObliqueViewDirection,
  ): ObliqueImage | undefined {
    const tree = this._directionTrees.get(direction);
    if (tree) {
      const candidates = knn(
        tree,
        mercatorCoordinate[0],
        mercatorCoordinate[1],
        1,
      );
      if (candidates.length === 1 && candidates[0].name) {
        return this.getImageByName(candidates[0].name);
      }
    }
    return undefined;
  }

  /**
   * Returns the <i>closest</i> image for the given location and direction (location and image extent must not overlap).
   * Returns undefined, if there are no images for the given direction
   * @param  mercatorCoordinate - coordinate in web mercator
   * @param  direction - the preferred direction if no image in that direction can be found, other direction will be queried
   */
  getImageForCoordinate(
    mercatorCoordinate: Coordinate,
    direction: ObliqueViewDirection,
  ): ObliqueImage | undefined {
    const directions = [
      direction,
      ...Object.values(ObliqueViewDirection).filter((d) => d !== direction),
    ];
    for (let i = 0; i < directions.length; i++) {
      const image = this._getNextImageForCoordinate(
        mercatorCoordinate,
        directions[i] as ObliqueViewDirection,
      );
      if (image) {
        return image;
      }
    }
    return undefined;
  }

  /**
   * Loads all data for a location and then returns the <i>closest</i> image for the given location and direction (location and image extent must not overlap).
   * Returns undefined, if there are no images for the given direction
   * @param  mercatorCoordinate - coordinate in web mercator
   * @param  direction
   */
  async loadImageForCoordinate(
    mercatorCoordinate: Coordinate,
    direction: ObliqueViewDirection,
  ): Promise<ObliqueImage | undefined> {
    await this.loadDataForCoordinate(mercatorCoordinate);
    return this.getImageForCoordinate(mercatorCoordinate, direction);
  }

  /**
   * Checks, if an image exists for a given coordinated
   * @param  mercatorCoordinate - coordinate in web mercator
   * @param  direction
   */
  async hasImageAtCoordinate(
    mercatorCoordinate: Coordinate,
    direction: ObliqueViewDirection,
  ): Promise<boolean> {
    const image = await this.loadImageForCoordinate(
      mercatorCoordinate,
      direction,
    );
    if (image) {
      const transform = getTransform(
        mercatorProjection.proj,
        image.meta.projection.proj,
      );
      const internalCoordinates = mercatorCoordinate.slice(0, 2);
      // error in TransformFunction type definition, remove undefined after openlayer fixed the type
      transform(internalCoordinates, internalCoordinates, undefined);
      const extent = boundingExtent(image.groundCoordinates);
      return containsCoordinate(extent, internalCoordinates);
    }
    return false;
  }

  /**
   * Loads the image adjacent to a given image in a certain direction from the provided image.
   * Returns undefined if there are no images in that direction or there are no images for the direction
   * of the provided image.
   * @param  image
   * @param  heading - 0 = east, PI / 2 = north, PI = west and PI * 1.5 = south
   * @param  [deviation=PI/4]
   */
  async loadAdjacentImage(
    image: ObliqueImage,
    heading: number,
    deviation = Math.PI / 4,
  ): Promise<ObliqueImage | undefined> {
    const tree = this._directionTrees.get(image.viewDirection);
    if (tree) {
      const transform = getTransform(
        image.meta.projection.proj,
        mercatorProjection.proj,
      );
      // error in TransformFunction type definition, remove undefined after openlayer fixed the type
      const coords = image.groundCoordinates.map((c) =>
        transform(c.slice(0, 2), undefined, undefined),
      );
      const extent = boundingExtent(coords);
      await this.loadDataForExtent(buffer(extent, 200));
      const center = getCenter(extent);
      const neighbors = knn(tree, center[0], center[1], 20);
      const found = neighbors.find((neighbour) => {
        if (neighbour.name !== image.name) {
          let angle = Math.atan2(
            neighbour.minY - center[1],
            neighbour.minX - center[0],
          );
          if (angle <= 0) {
            angle += Math.PI * 2;
          }
          let differenceAngle = angle - heading;
          if (differenceAngle > Math.PI) {
            differenceAngle -= Math.PI * 2;
          } else if (differenceAngle < -Math.PI) {
            differenceAngle += Math.PI * 2;
          }
          if (differenceAngle <= deviation && differenceAngle >= -deviation) {
            return neighbour;
          }
        }
        return false;
      });
      if (found) {
        return this.getImageByName(found.name);
      }
    }
    return undefined;
  }

  /**
   * Destroys all data sets and all images and any image/tile features for this collection
   */
  destroy(): void {
    this._dataSets.forEach((ds) => {
      ds.destroy();
    });
    this._dataSets = [];

    [...this._directionTrees.values()].forEach((tree) => {
      tree.clear();
    });
    this._directionTrees.clear();

    this._images.clear();

    if (this._tileFeatureSource) {
      this._tileFeatureSource.clear(true);
      this._tileFeatureSource = null;
    }

    if (this._imageFeatureSource) {
      this._imageFeatureSource.clear(true);
      this._imageFeatureSource = null;
    }
    this.imagesLoaded.destroy();
    super.destroy();
    this.destroyed.raiseEvent();
    this._destroyed.destroy();
  }

  toJSON(): ObliqueCollectionOptions {
    const config: ObliqueCollectionOptions = super.toJSON();
    const defaultOptions = ObliqueCollection.getDefaultOptions();
    if (this.viewOptions.maxZoom !== defaultOptions.maxZoom) {
      config.maxZoom = this.viewOptions.maxZoom;
    }
    if (this.viewOptions.minZoom !== defaultOptions.minZoom) {
      config.minZoom = this.viewOptions.minZoom;
    }
    if (this.viewOptions.scaleFactor !== defaultOptions.scaleFactor) {
      config.scaleFactor = this.viewOptions.scaleFactor;
    }
    if (this.viewOptions.hideLevels !== defaultOptions.hideLevels) {
      config.hideLevels = this.viewOptions.hideLevels;
    }
    if (this.datasourceId !== defaultOptions.datasourceId) {
      config.datasourceId = this.datasourceId;
    }

    if (this.dataSets.length > 0) {
      config.dataSets = this.dataSets.map((d) => d.toJSON());
    }
    return config;
  }
}

export default ObliqueCollection;
