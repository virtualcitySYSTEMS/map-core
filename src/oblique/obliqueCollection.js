import { parseBoolean, parseInteger, parseNumber } from '@vcsuite/parsers';
import RBush from 'rbush';
import knn from 'rbush-knn';
import { getTransform } from 'ol/proj.js';
import { createXYZ } from 'ol/tilegrid.js';
import Feature from 'ol/Feature.js';
import Polygon, { fromExtent } from 'ol/geom/Polygon.js';
import Vector from 'ol/source/Vector.js';
import { boundingExtent, buffer, containsCoordinate, getCenter } from 'ol/extent.js';
import VcsEvent from '../vcsEvent.js';
import ObliqueDataSet, { DataState, getStateFromStatesArray } from './obliqueDataSet.js';
import { ObliqueViewDirection } from './obliqueViewDirection.js';
import { mercatorProjection } from '../util/projection.js';
import VcsObject from '../vcsObject.js';

/**
 * @typedef {Object} ObliqueCameraOptions
 * @property {string} name
 * @property {!import("ol/coordinate").Coordinate} "principal-point"
 * @property {import("ol/coordinate").Coordinate|undefined} "pixel-size"
 * @property {Array<number>|undefined} "radial-distorsion-expected-2-found"
 * @property {Array<number>|undefined} "radial-distorsion-found-2-expected"
 * @property {import("ol/size").Size|undefined} size
 * @api
 */

/**
 * @typedef {Object} ObliqueGeneralImageInfo
 * @property {number} width
 * @property {number} height
 * @property {Array<number>} "tile-resolution"
 * @property {number} "tile-width"
 * @property {number} "tile-height"
 * @property {Array<ObliqueCameraOptions>|undefined} cameraParameter
 * @property {string} crs
 * @api
 */

/**
 * The data within an image.json
 * @typedef {Object} ObliqueImageJson
 * @property {ObliqueGeneralImageInfo} generalImageInfo
 * @property {number|undefined} tileLevel
 * @property {Array<Array<*>>|undefined} images
 * @property {Array<string>|undefined} availableTiles
 * @api
 */

/**
 * @typedef {Object} ObliqueVersion
 * @property {number} version
 * @property {number} buildNumber
 * @api
 */

/**
 * @typedef {Object} ObliqueDataSetOptions
 * @property {string} url
 * @property {ProjectionOptions} [projection]
 * @property {TerrainProviderOptions} [terrainProvider]
 */

/**
 * @typedef {VcsObjectOptions} ObliqueCollectionOptions
 * @property {Array<import("@vcmap/core").ObliqueDataSet|ObliqueDataSetOptions>} [dataSets]
 * @property {number|undefined} [maxZoom]
 * @property {number|undefined} [minZoom]
 * @property {number|undefined} [scaleFactor=4]
 * @property {number|undefined} [hideLevels]
 * @property {boolean|undefined} [activeOnStartup=false]
 * @api
 */

/**
 * @param {Array<import("@vcmap/core").ObliqueImage>} images
 * @returns {Array<import("ol").Feature<import("ol/geom/Geometry").default>>}
 */
function getImageFeatures(images) {
  return images.map((image) => {
    const transform = getTransform(image.meta.projection.proj, mercatorProjection.proj);
    const feature = new Feature({
      // error in TransformFunction type definition, remove undefined after openlayer fixed the type
      geometry: new Polygon([image.groundCoordinates.map(c => transform(c.slice(0, 2), undefined, undefined))]),
      viewDirection: image.viewDirection,
    });
    feature.setId(image.name);
    return feature;
  });
}

/**
 * @param {Object<string, DataState>} tiles
 * @returns {Array<import("ol").Feature<import("ol/geom/Geometry").default>>}
 */
function getTileFeatures(tiles) {
  const tileGrid = createXYZ();
  return Object.entries(tiles)
    .map(([stringTileCoord, state]) => {
      const tileCoord = stringTileCoord.split('/')
        .map(tc => Number.parseInt(tc, 10));

      const extent = tileGrid.getTileCoordExtent(tileCoord);
      const feature = new Feature({
        geometry: fromExtent(extent),
        state,
      });
      feature.setId(stringTileCoord);
      return feature;
    });
}

/**
 * @class
 * @export
 * @extends {VcsObject}
 */
class ObliqueCollection extends VcsObject {
  static get className() { return 'ObliqueCollection'; }

  /**
   * @returns {ObliqueCollectionOptions}
   */
  static getDefaultOptions() {
    return {
      maxZoom: 0,
      minZoom: 0,
      scaleFactor: 4,
      dataSets: undefined,
      hideLevels: 0,
      activeOnStartup: false,
    };
  }

  /**
   * @param {ObliqueCollectionOptions} options
   */
  constructor(options) {
    super(options);
    const defaultOptions = ObliqueCollection.getDefaultOptions();
    /**
     * Maps each direction to an RTree
     * @type {Map<import("@vcmap/core").ObliqueViewDirection, RBush>}
     * @private
     */
    this._directionTrees = new Map();
    /**
     * Maps image name to image
     * @type {Map<string, import("@vcmap/core").ObliqueImage>}
     * @private
     */
    this._images = new Map();
    /**
     * Maps urls to general infos & cameras
     * @type {Array<import("@vcmap/core").ObliqueDataSet>}
     * @private
     */
    this._dataSets = [];

    /** @type {ObliqueViewOptions} */
    this.viewOptions = {
      maxZoom: parseInteger(options.maxZoom, defaultOptions.maxZoom),
      minZoom: parseInteger(options.minZoom, defaultOptions.minZoom),
      scaleFactor: parseNumber(options.scaleFactor, defaultOptions.scaleFactor),
      hideLevels: parseInteger(options.hideLevels, defaultOptions.hideLevels),
    };

    /** @type {boolean} */
    this._loaded = false;

    /**
     * Event raised when images are loaded. Is passed an Array of ObliqueImages as its only argument.
     * @type {import("@vcmap/core").VcsEvent<Array<import("@vcmap/core").ObliqueImage>>}
     * @api
     */
    this.imagesLoaded = new VcsEvent();

    /**
     * @type {import("ol/source").Vector<import("ol/geom/Geometry").default>|null}
     * @private
     */
    this._tileFeatureSource = null;
    /**
     * @type {import("ol/source").Vector<import("ol/geom/Geometry").default>|null}
     * @private
     */
    this._imageFeatureSource = null;
    if (Array.isArray(options.dataSets)) {
      options.dataSets.forEach((dataSet) => {
        this._addDataSet(dataSet);
      });
    }

    /**
     * @type {VcsEvent<void>}
     * @private
     */
    this._destroyed = new VcsEvent();

    /**
     * Whether to activate this collection after loading its defining context.
     * @type {boolean}
     */
    this.activeOnStartup = parseBoolean(options.activeOnStartup, defaultOptions.activeOnStartup);
  }

  /**
   * @type {Array<import("@vcmap/core").ObliqueDataSet>}
   * @api
   * @readonly
   */
  get dataSets() {
    return this._dataSets.slice();
  }

  /**
   * Indicates, that this collection has been loaded
   * @type {boolean}
   * @api
   */
  get loaded() {
    return this._loaded;
  }

  /**
   * @returns {VcsEvent<void>}
   */
  get destroyed() {
    return this._destroyed;
  }

  /**
   * A vector source of all tiles available to this collection in mercator. The feature have a "state" property,
   * the id is the string tile coordinate "z/x/y" of the tile
   * @type {import("ol/source/Vector").default<import("ol/geom/Geometry").default>}
   * @api
   * @readonly
   */
  get tileFeatureSource() {
    if (!this._tileFeatureSource) {
      this._tileFeatureSource = this._createTileFeatureSource();
    }
    return this._tileFeatureSource;
  }

  /**
   * A vector source of all image currently loaded for this collection in mercator.
   * The id is the image name. The feature has a "viewDirection" property.
   * @type {import("ol/source/Vector").default<import("ol/geom/Geometry").default>}
   * @api
   * @readonly
   */
  get imageFeatureSource() {
    if (!this._imageFeatureSource) {
      this._imageFeatureSource = this._createImageFeatureSource();
    }
    return this._imageFeatureSource;
  }

  /**
   * All currently loaded images
   * @type {Array<import("@vcmap/core").ObliqueImage>}
   * @api
   * @readonly
   */
  get images() {
    return [...this._images.values()];
  }

  /**
   * @returns {import("ol/source/Vector").default<import("ol/geom/Geometry").default>}
   * @private
   */
  _createTileFeatureSource() {
    const features = getTileFeatures(this.getTiles());
    const source = new Vector();
    source.addFeatures(features);
    return source;
  }

  /**
   * @returns {import("ol/source/Vector").default<import("ol/geom/Geometry").default>}
   * @private
   */
  _createImageFeatureSource() {
    const features = getImageFeatures([...this._images.values()]);
    const source = new Vector();
    source.addFeatures(features);
    return source;
  }

  /**
   * @param {import("@vcmap/core").ObliqueDataSet} dataSet
   * @returns {Promise<void>}
   * @private
   */
  async _loadDataSet(dataSet) {
    await dataSet.load();
    if (this._tileFeatureSource) {
      const features = getTileFeatures(dataSet.getTiles());
      this._tileFeatureSource.addFeatures(features);
    }
  }

  /**
   * Adds an oblique data set to this collection.
   * @param {import("@vcmap/core").ObliqueDataSet|ObliqueDataSetOptions} dataSetOptions
   * @private
   */
  _addDataSet(dataSetOptions) {
    /** @type {import("@vcmap/core").ObliqueDataSet} */
    let dataSet;
    if (dataSetOptions instanceof ObliqueDataSet) {
      dataSet = dataSetOptions;
    } else {
      dataSet = new ObliqueDataSet(dataSetOptions.url, dataSetOptions.projection, dataSetOptions.terrainProvider);
    }
    dataSet.imagesLoaded.addEventListener(({ images, tileCoordinate }) => {
      this._loadImages(images, tileCoordinate);
    });
    this._loadImages(dataSet.images);
    this._dataSets.push(dataSet);
  }

  /**
   * Adds an oblique data set to this collection.
   * @param {import("@vcmap/core").ObliqueDataSet} dataSet
   * @returns {Promise<void>}
   * @api
   */
  async addDataSet(dataSet) { // XXX check for dataset here?
    if (this._loadingPromise) {
      await this._loadingPromise;
      await this._loadDataSet(dataSet);
    }
    this._addDataSet(dataSet);
  }

  /**
   * Loads all meta data associated with this collection
   * @returns {Promise<void>}
   * @api
   */
  async load() {
    if (!this._loadingPromise) {
      this._loadingPromise = Promise.all(this._dataSets.map(i => this._loadDataSet(i)));
      await this._loadingPromise;
      this._loaded = true;
    }

    await this._loadingPromise;
  }

  /**
   * @param {Array<import("@vcmap/core").ObliqueImage>} images
   * @param {string=} tileCoordinate
   * @private
   */
  _loadImages(images, tileCoordinate) {
    if (tileCoordinate && this._tileFeatureSource) {
      const tileFeature = this._tileFeatureSource.getFeatureById(tileCoordinate);
      if (tileFeature) {
        tileFeature.set('state', DataState.READY);
      }
    }

    const directions = new Map();
    images.forEach((image) => {
      this._images.set(image.name, image);
      if (!directions.has(image.viewDirection)) {
        directions.set(image.viewDirection, []);
      }

      const transform = getTransform(image.meta.projection.proj, mercatorProjection.proj);
      const coord = image.centerPointOnGround.slice(0, 2);
      // error in TransformFunction type definition, remove undefined after openlayer fixed the type
      transform(coord, coord, undefined);
      directions.get(image.viewDirection).push({
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
      this._directionTrees.get(direction).load(imageItems);
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
   * @returns {Object<string, DataState>}
   * @api
   */
  getTiles() {
    /** @type {Object<string, DataState>} */
    const tiles = {};
    this._dataSets.forEach((dataSet) => {
      Object.entries(dataSet.getTiles())
        .forEach(([tileCoord, state]) => {
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
   * @param {string} name
   * @returns {import("@vcmap/core").ObliqueImage}
   * @api
   */
  getImageByName(name) {
    return this._images.get(name);
  }

  /**
   * Returns a list of viewDirections which a currently available in this collection
   * @returns {Array<ObliqueViewDirection>}
   * @api
   */
  getAvailableViewDirections() {
    return [...this._directionTrees.keys()];
  }

  /**
   * Returns the state of the data for a given location an all underlying data sources
   * @param {import("ol/coordinate").Coordinate} mercatorCoordinate - coordinate in web mercator
   * @returns {DataState}
   * @api
   */
  getDataStateForCoordinate(mercatorCoordinate) {
    const states = this._dataSets.map(i => i.getDataStateForCoordinate(mercatorCoordinate));
    return getStateFromStatesArray(states);
  }

  /**
   * Returns the state of the data for a given location an all underlying data sources
   * @param {import("ol/coordinate").Coordinate} extent - coordinate in web mercator
   * @returns {DataState}
   * @api
   */
  getDataStateForExtent(extent) {
    const states = this._dataSets.map(i => i.getDataStateForExtent(extent));
    return getStateFromStatesArray(states);
  }

  /**
   * Loads data for a given mercator Coordinate
   * @param {import("ol/coordinate").Coordinate} mercatorCoordinate - coordinate in web mercator
   * @returns {Promise<void>}
   * @api
   */
  async loadDataForCoordinate(mercatorCoordinate) {
    await Promise.all(this._dataSets.map(i => i.loadDataForCoordinate(mercatorCoordinate)));
  }

  /**
   * Loads all data tiles in the given extent
   * @param {import("ol/extent").Extent} extent
   * @returns {Promise<void>}
   * @api
   */
  async loadDataForExtent(extent) {
    await Promise.all(this._dataSets.map(i => i.loadDataForExtent(extent)));
  }

  /**
   * @param {import("ol/coordinate").Coordinate} mercatorCoordinate
   * @param {import("@vcmap/core").ObliqueViewDirection} direction
   * @returns {import("@vcmap/core").ObliqueImage|undefined}
   * @private
   */
  _getNextImageForCoordinate(mercatorCoordinate, direction) {
    const tree = this._directionTrees.get(direction);
    if (tree) {
      const candidates = knn(tree, mercatorCoordinate[0], mercatorCoordinate[1], 1);
      if (candidates.length === 1 && candidates[0].name) {
        return this.getImageByName(candidates[0].name);
      }
    }
    return undefined;
  }

  /**
   * Returns the <i>closest</i> image for the given location and direction (location and image extent must not overlap).
   * Returns undefined, if there are no images for the given direction
   * @param {import("ol/coordinate").Coordinate} mercatorCoordinate - coordinate in web mercator
   * @param {import("@vcmap/core").ObliqueViewDirection} direction - the preferred direction if no image in that direction can be found, other direction will be queried
   * @returns {import("@vcmap/core").ObliqueImage|undefined}
   * @api
   */
  getImageForCoordinate(mercatorCoordinate, direction) {
    const directions = [direction, ...Object.values(ObliqueViewDirection).filter(d => d !== direction)];
    for (let i = 0; i < directions.length; i++) {
      const image = this._getNextImageForCoordinate(mercatorCoordinate, directions[i]);
      if (image) {
        return image;
      }
    }
    return undefined;
  }

  /**
   * Loads all data for a location and then returns the <i>closest</i> image for the given location and direction (location and image extent must not overlap).
   * Returns undefined, if there are no images for the given direction
   * @param {import("ol/coordinate").Coordinate} mercatorCoordinate - coordinate in web mercator
   * @param {import("@vcmap/core").ObliqueViewDirection} direction
   * @returns {Promise<import("@vcmap/core").ObliqueImage|undefined>}
   * @api
   */
  async loadImageForCoordinate(mercatorCoordinate, direction) {
    await this.loadDataForCoordinate(mercatorCoordinate);
    return this.getImageForCoordinate(mercatorCoordinate, direction);
  }

  /**
   * Checks, if an image exists for a given coordinated
   * @param {import("ol/coordinate").Coordinate} mercatorCoordinate - coordinate in web mercator
   * @param {import("@vcmap/core").ObliqueViewDirection} direction
   * @returns {Promise<boolean>}
   * @api
   */
  async hasImageAtCoordinate(mercatorCoordinate, direction) {
    const image = await this.loadImageForCoordinate(mercatorCoordinate, direction);
    if (image) {
      const transform = getTransform(mercatorProjection.proj, image.meta.projection.proj);
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
   * @param {import("@vcmap/core").ObliqueImage} image
   * @param {number} heading - 0 = east, PI / 2 = north, PI = west and PI * 1.5 = south
   * @param {number=} [deviation=PI/4]
   * @returns {Promise<import("@vcmap/core").ObliqueImage|undefined>}
   * @api
   */
  async loadAdjacentImage(image, heading, deviation = Math.PI / 4) {
    const tree = this._directionTrees.get(image.viewDirection);
    if (tree) {
      const transform = getTransform(image.meta.projection.proj, mercatorProjection.proj);
      // error in TransformFunction type definition, remove undefined after openlayer fixed the type
      const coords = image.groundCoordinates.map(c => transform(c.slice(0, 2), undefined, undefined));
      const extent = boundingExtent(coords);
      await this.loadDataForExtent(buffer(extent, 200));
      const center = getCenter(extent);
      const neighbors = knn(tree, center[0], center[1], 20);
      const found = neighbors.find((neighbour) => {
        if (neighbour.name !== image.name) {
          let angle = Math.atan2(neighbour.minY - center[1], neighbour.minX - center[0]);
          if (angle <= 0) {
            angle += Math.PI * 2;
          }
          let differenceAngle = angle - heading;
          if (differenceAngle > Math.PI) {
            differenceAngle -= (Math.PI * 2);
          } else if (differenceAngle < -Math.PI) {
            differenceAngle += (Math.PI * 2);
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
   * @api
   */
  destroy() {
    this._dataSets.forEach((ds) => { ds.destroy(); });
    this._dataSets = [];

    [...this._directionTrees.values()].forEach((tree) => { tree.clear(); });
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

  /**
   * @returns {ObliqueCollectionOptions}
   */
  toJSON() {
    /** @type {ObliqueCollectionOptions} */
    const config = super.toJSON();
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

    if (this.dataSets.length > 0) {
      config.dataSets = this.dataSets.map(d => d.toJSON());
    }
    return config;
  }
}

export default ObliqueCollection;
