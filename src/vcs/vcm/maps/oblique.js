import { boundingExtent, containsXY } from 'ol/extent.js';
import { get as getProjection, getTransform, transform, transformExtent } from 'ol/proj.js';
import { check } from '@vcsuite/check';
import { parseBoolean, parseNumber } from '@vcsuite/parsers';
import Extent from '../util/extent.js';
import { mercatorProjection, wgs84Projection } from '../util/projection.js';
import { getResolutionOptions, getZoom } from '../layer/oblique/obliqueHelpers.js';
import ViewPoint from '../util/viewpoint.js';
import BaseOLMap from './baseOLMap.js';
import VcsMap from './map.js';
import VcsEvent from '../event/vcsEvent.js';
import { obliqueCollectionCollection } from '../globalCollections.js';
import { ObliqueViewDirection as ViewDirection } from '../oblique/ObliqueViewDirection.js';
import ObliqueProvider from '../oblique/ObliqueProvider.js';
import ObliqueCollection from '../oblique/ObliqueCollection.js';
import { transformFromImage } from '../oblique/helpers.js';

/**
 * @typedef {Object} vcs.vcm.maps.Oblique.ClickParameters
 * @property {ol/Pixel} pixel
 * @property {boolean|undefined} estimate
 * @api stable
 */

/**
 * @typedef {vcs.vcm.maps.VcsMap.Options} vcs.vcm.maps.Oblique.Options
 * @property {boolean} [changeOnMoveEnd=false]
 * @property {number} [switchThreshold=0]
 * @property {boolean} [switchOnEdge=true]
 * @property {string|undefined} defaultCollectionName
 * @api
 */

const defaultHeadings = {
  [ViewDirection.NORTH]: 0,
  [ViewDirection.EAST]: 90,
  [ViewDirection.SOUTH]: 180,
  [ViewDirection.WEST]: 270,
};

/**
 * returns the direction which matches the heading of the viewpoint
 * @param {vcs.vcm.util.ViewPoint} viewpoint
 * @returns {vcs-oblique/ObliqueViewDirection}
 */
export function getViewDirectionFromViewPoint(viewpoint) {
  const { heading } = viewpoint;
  let direction = ViewDirection.NORTH;
  if (heading >= 45 && heading < 135) {
    direction = ViewDirection.EAST;
  } else if (heading >= 135 && heading < 225) {
    direction = ViewDirection.SOUTH;
  } else if (heading >= 225 && heading < 315) {
    direction = ViewDirection.WEST;
  }
  return direction;
}

/**
 * @param {vcs.vcm.util.ViewPoint} viewpoint
 * @returns {ol/Coordinate}
 */
export function getMercatorViewpointCenter(viewpoint) {
  const gpWGS84 = viewpoint.groundPosition || viewpoint.cameraPosition;
  return transform(
    gpWGS84,
    wgs84Projection.proj,
    mercatorProjection.proj,
  );
}

/**
 * Oblique Map Class (2D map with oblique imagery)
 *
 * @class
 * @export
 * @extends {vcs.vcm.maps.BaseOLMap}
 * @api stable
 * @memberOf vcs.vcm.maps
 */
class Oblique extends BaseOLMap {
  static get className() { return 'vcs.vcm.maps.Oblique'; }

  /**
   * @returns {vcs.vcm.maps.Oblique.Options}
   */
  static getDefaultOptions() {
    return {
      ...VcsMap.getDefaultOptions(),
      changeOnMoveEnd: false,
      switchThreshold: 0,
      switchOnEdge: true,
      defaultCollectionName: undefined,
    };
  }

  /**
   * @param {vcs.vcm.maps.Oblique.Options} options
   */
  constructor(options) {
    super(options);
    const defaultOptions = Oblique.getDefaultOptions();
    /**
     * @type {string|undefined}
     * @private
     */
    this._defaultCollectionName = options.defaultCollectionName || defaultOptions.defaultCollectionName;

    /**
     * @type  {vcs-oblique/ObliqueCollection|null}
     * @private
     */
    this._loadingCollection = null;

    /**
     * @type {string}
     * @private
     */
    this._mapChangeEvent = options.changeOnMoveEnd ? 'moveend' : 'postrender';

    /** @type {number} */
    this._switchThreshold = parseNumber(options.switchThreshold, defaultOptions.switchThreshold);
    if (this._switchThreshold > 1) {
      this._switchThreshold = 0.2;
    } else if (this._switchThreshold < 0) {
      this._switchThreshold = 0;
    }

    /**
     * @type {boolean}
     * @private
     */
    this._switchEnabled = parseBoolean(options.switchOnEdge, defaultOptions.switchOnEdge);

    /**
     * An event raise, when the collection changes. Is passed the collection as its only argument.
     * @type {vcs.vcm.event.VcsEvent<vcs-oblique/ObliqueCollection>}
     * @api
     */
    this.collectionChanged = new VcsEvent();
  }

  /**
   * Whether the post render handler should switch on image edge. Setting
   * this to false will suspend all post render handler switches.
   * @type {boolean}
   * @api
   */
  get switchEnabled() {
    return this._switchEnabled;
  }

  /**
   * @param {boolean} switchEnabled
   */
  set switchEnabled(switchEnabled) {
    this._switchEnabled = switchEnabled;
    if (this._obliqueProvider) {
      this._obliqueProvider.switchEnabled = switchEnabled;
    }
  }

  /**
   * Threshold from 0 to 1 to define when to start switching to other images. Where 0 indicates
   * to only switch, when the view center is outside of the image and 1 to always switch. 0.2 would start switching
   * if the view center is within the outer 20% of the image.
   * @type {number}
   * @api
   */
  get switchThreshold() {
    return this._switchThreshold;
  }

  /**
   * @param {number} threshold
   */
  set switchThreshold(threshold) {
    check(threshold, Number);
    this._switchThreshold = threshold;
    if (this._switchThreshold > 1) {
      this._switchThreshold = 0.2;
    } else if (this._switchThreshold < 0) {
      this._switchThreshold = 0;
    }

    if (this._obliqueProvider) {
      this._obliqueProvider.switchThreshold = this._switchThreshold;
    }
  }

  /**
   * @type {string}
   */
  get mapChangeEvent() {
    return this._mapChangeEvent;
  }

  /**
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.initializedPromise) {
      this.initializedPromise = super.initialize()
        .then(async () => {
          this._obliqueProvider = new ObliqueProvider(this.olMap);
          this.mapChangeEvent = this._mapChangeEvent;
          this.switchThreshold = this._switchThreshold;
          this.switchEnabled = this._switchEnabled;
          let collectionToLoad = this._loadingCollection;
          if (!collectionToLoad) {
            collectionToLoad = this._defaultCollectionName ?
              obliqueCollectionCollection.getByKey(this._defaultCollectionName) :
              [...obliqueCollectionCollection][0];
          }
          if (collectionToLoad) {
            await this._setCollection(collectionToLoad);
          }
        })
        .then(() => {
          this.initialized = true;
        });
    }
    await this.initializedPromise;
  }

  /**
   * @param {string} eventType
   */
  set mapChangeEvent(eventType) {
    check(eventType, String);
    this._mapChangeEvent = eventType;
    if (this._obliqueProvider) {
      this._obliqueProvider.mapChangeEvent = eventType;
    }
  }

  /**
   * @type {vcs-oblique/ObliqueCollection}
   * @readonly
   * @api
   */
  get collection() { return this._obliqueProvider.collection; }

  /**
   * @type {Cesium/Event}
   * @readonly
   * @api
   */
  get imageChanged() {
    return this._obliqueProvider ? this._obliqueProvider.imageChanged : null;
  }

  /**
   * @type {vcs-oblique/ObliqueImage|null}
   * @api
   * @readonly
   */
  get currentImage() {
    return this._obliqueProvider ? this._obliqueProvider.currentImage : null;
  }

  /**
   * @param {vcs.vcm.util.ViewPoint} viewpoint
   * @returns {Promise<boolean>}
   * @api
   */
  async canShowViewpoint(viewpoint) {
    await this.initialize();
    if (this.collection) {
      const viewDirection = getViewDirectionFromViewPoint(viewpoint);
      const mercatorCoordinates = getMercatorViewpointCenter(viewpoint);
      return this.collection.hasImageAtCoordinate(mercatorCoordinates, viewDirection);
    }
    return false;
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  async activate() {
    await super.activate();
    if (this.active) {
      this._obliqueProvider.activate();
    }
  }

  /**
   * @returns {vcs.vcm.util.Extent}
   */
  getExtentOfCurrentImage() {
    const image = this.currentImage;
    if (image) {
      const coords = boundingExtent(image.groundCoordinates);
      return new Extent({
        coordinates: transformExtent(coords, image.meta.projection, mercatorProjection.proj),
        epsg: 'EPSG:3857',
      });
    }
    return new Extent({
      coordinates: [-18924313.4349, -15538711.0963, 18924313.4349, 15538711.0963],
      epsg: 'EPSG:3857',
    });
  }

  /**
   * @returns {vcs-oblique/ObliqueImage}
   * @api
   * @deprecated 4.0
   */
  getCurrentImage() {
    this.getLogger().deprecate('getCurrentImage', 'access the currentImage property');
    return this._obliqueProvider ? this._obliqueProvider.currentImage : null;
  }

  deactivate() {
    super.deactivate();
    this._obliqueProvider.deactivate();
  }

  /**
   * Sets a new oblique collection
   * @param {vcs-oblique/ObliqueCollection} obliqueCollection
   * @param {vcs.vcm.util.ViewPoint=} viewpoint
   * @returns {Promise<void>}
   * @api
   */
  async setCollection(obliqueCollection, viewpoint) {
    check(obliqueCollection, ObliqueCollection);

    if (this.movementDisabled) {
      return;
    }

    if (!this.initializedPromise) { // TODO add collection to obliqueCollections?
      this._defaultCollectionName = obliqueCollection.name;
      return;
    }
    this._loadingCollection = obliqueCollection;
    await this.initializedPromise;
    if (this._loadingCollection !== obliqueCollection) {
      return;
    }
    await this._setCollection(obliqueCollection, viewpoint);
  }

  /**
   * Sets a new oblique collection
   * @param {vcs-oblique/ObliqueCollection} obliqueCollection
   * @param {vcs.vcm.util.ViewPoint=} viewpoint
   * @returns {Promise<void>}
   * @private
   */
  async _setCollection(obliqueCollection, viewpoint) {
    this._loadingCollection = obliqueCollection;
    await obliqueCollection.load();
    const vp = viewpoint || await this.getViewPoint();
    if (this._loadingCollection !== obliqueCollection) {
      return;
    }
    this._obliqueProvider.setCollection(obliqueCollection);
    this.collectionChanged.raiseEvent(obliqueCollection);
    if (vp) {
      await this.gotoViewPoint(vp);
    }
  }

  /**
   * Sets an image by its name on the map
   * @param {string} imageName
   * @param {ol/Coordinate=} optCenter
   * @returns {Promise<void>}
   * @api
   */
  async setImageByName(imageName, optCenter) {
    if (this.movementDisabled || !this.initializedPromise) {
      return;
    }
    await this.initializedPromise;
    const image = this._obliqueProvider.collection.getImageByName(imageName);
    if (image) {
      await this._obliqueProvider.setImage(image, optCenter);
    }
  }

  /**
   * @returns {Promise<vcs.vcm.util.ViewPoint|null>}
   * @inheritDoc
   */
  async getViewPoint() {
    const image = this.currentImage;
    if (!image) {
      return null;
    }
    // if we dont have an image, we may not have a map, thus two if clauses
    const viewCenter = this.olMap.getView().getCenter();
    if (!viewCenter) {
      return null;
    }

    const transformationOptions = { dataProjection: getProjection('EPSG:4326') };
    const { coords } = await transformFromImage(image, viewCenter, transformationOptions);
    return this._computeViewpointInternal(coords);
  }

  /**
   * @inheritDoc
   * @returns {vcs.vcm.util.ViewPoint|null}
   */
  getViewPointSync() {
    const image = this.currentImage;
    if (!image) {
      return null;
    }

    const gpImageCoordinates = this.olMap.getView().getCenter();
    if (!gpImageCoordinates) {
      return null;
    }

    const gpInternalProjection = image.transformImage2RealWorld(gpImageCoordinates, image.averageHeight);

    const transfrom = getTransform(image.meta.projection, wgs84Projection.proj);
    const gpWGS84 = transfrom(gpInternalProjection.slice(0, 2));
    return this._computeViewpointInternal(gpWGS84);
  }

  /**
   * @param {ol/Coordinate} groundPosition
   * @returns {vcs.vcm.util.ViewPoint}
   * @private
   */
  _computeViewpointInternal(groundPosition) {
    const image = this.currentImage;
    const { size, fovy, metersPerUnit } = getResolutionOptions(this.olMap, image);

    const view = this.olMap.getView();
    const resolution = view.getResolution() || 1;
    const visibleMapUnits = resolution * size.height;
    const visibleMeters = visibleMapUnits * metersPerUnit;
    const height = Math.abs((visibleMeters / 2) / Math.tan(fovy / 2));

    const avgHeight = groundPosition[2] || image.averageHeight;
    const cameraHeight = height + avgHeight;

    return new ViewPoint({
      cameraPosition: [groundPosition[0], groundPosition[1], cameraHeight],
      groundPosition,
      heading: defaultHeadings[image.viewDirection],
      pitch: -90,
      roll: 0,
      distance: height,
    });
  }

  /**
   * @param {vcs.vcm.util.ViewPoint} viewpoint
   * @returns {Promise<void>}
   * @inheritDoc
   */
  async gotoViewPoint(viewpoint) {
    if (this.movementDisabled || !this._obliqueProvider || !viewpoint.isValid()) {
      return;
    }

    const viewDirection = getViewDirectionFromViewPoint(viewpoint);
    const mercatorCoordinates = getMercatorViewpointCenter(viewpoint);
    const { distance } = viewpoint;
    await this._obliqueProvider.setView(mercatorCoordinates, viewDirection);
    if (this._obliqueProvider.currentImage) {
      const zoom = getZoom(this.olMap, this._obliqueProvider.currentImage, distance);
      this.olMap.getView().setZoom(zoom);
    }
  }

  /**
   * @param {ol/Coordinate} coords in WGS84 degrees
   * @returns {boolean}
   * @api
   */
  pointIsVisible(coords) {
    const image = this.currentImage;
    if (!image || !this.active) {
      return false;
    }
    const view = this.olMap.getView();
    const extent = view.calculateExtent(this.olMap.getSize());
    const bl = image.transformImage2RealWorld([extent[0], extent[1]]);
    const ur = image.transformImage2RealWorld([extent[2], extent[3]]);
    const bbox = [bl[0], bl[1], ur[0], ur[1]];
    const transformedBbox = transformExtent(bbox, image.meta.projection, wgs84Projection.proj);
    return containsXY(transformedBbox, coords[0], coords[1]);
  }

  /**
   * @returns {vcs.vcm.maps.Oblique.Options}
   * @api
   */
  getConfigObject() {
    const config = /** @type {vcs.vcm.maps.Oblique.Options} */ (super.getConfigObject());
    const defaultOptions = Oblique.getDefaultOptions();

    if (this.mapChangeEvent === 'movened') {
      config.changeOnMoveEnd = true;
    }

    if (this.switchThreshold !== defaultOptions.switchThreshold) {
      config.switchThreshold = this.switchThreshold;
    }

    if (this.switchEnabled !== defaultOptions.switchOnEdge) {
      config.switchOnEdge = this.switchEnabled;
    }

    if (this._defaultCollectionName !== defaultOptions.defaultCollectionName) {
      config.defaultCollectionName = this._defaultCollectionName;
    }

    return config;
  }

  /**
   * @api
   */
  destroy() {
    if (this._obliqueProvider) {
      this._obliqueProvider.destroy();
    }
    this.collectionChanged.destroy();
    super.destroy();
  }
}

export default Oblique;