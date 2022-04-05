import { getTransform } from 'ol/proj.js';
import View from 'ol/View.js';
import { unByKey } from 'ol/Observable.js';
import { DataState } from './obliqueDataSet.js';
import OLView from './obliqueView.js';
import { transformFromImage } from './helpers.js';
import { getHeightFromTerrainProvider } from '../layer/terrainHelpers.js';
import { mercatorProjection } from '../util/projection.js';
import VcsEvent from '../vcsEvent.js';
import { isDefaultImageSymbol } from './defaultObliqueCollection.js';

/**
 * @typedef {Object} ObliqueViewPoint
 * @property {import("ol/coordinate").Coordinate} center - in mercator
 * @property {number} zoom
 * @property {import("@vcmap/core").ObliqueViewDirection} direction
 * @api
 */

/**
 * @param {number} number
 * @param {number} max
 * @returns {number}
 */
function withinBounds(number, max) {
  if (number < 0) {
    return 0;
  }

  if (number > max) {
    return max;
  }
  return number;
}

/**
 * @class
 * @export
 */
class ObliqueProvider {
  /**
   * @param {import("ol").Map} olMap
   */
  constructor(olMap) {
    this._active = false;
    /** @type {import("@vcmap/core").ObliqueImage|string|null} */
    this._loadingImage = null;
    /** @type {import("ol").Map} */
    this._olMap = olMap;
    this._viewCache = new Map();
    /**
     * @type {import("@vcmap/core").ObliqueImage|null}
     */
    this._currentImage = null; // XXX defaultImage
    /**
     * @type {import("@vcmap/core").ObliqueView|null}
     * @private
     */
    this._currentView = null;
    /** @type {import("@vcmap/core").ObliqueCollection} */
    this._collection = null; // XXX should we also make a default collection?
    /** @type {string} */
    this._mapChangeEvent = 'postrender';

    /**
     * Event raised once a new image is set on the provider. Will be passed the new image as the only argument.
     * @type {import("@vcmap/core").VcsEvent<import("@vcmap/core").ObliqueImage>}
     * @api
     */
    this.imageChanged = new VcsEvent();
    /**
     * Whether the post render handler should switch on image edge. Setting
     * this to false will suspend all post render handler switches.
     * @type {boolean}
     * @api
     */
    this.switchEnabled = true;
    /**
     * Threshold from 0 to 1 to define when to start switching to other images. Where 0 indicates
     * to only switch, when the view center is outside of the image and 1 to always switch. 0.2 would start switching
     * if the view center is within the outer 20% of the image.
     * @type {number}
     * @api
     */
    this.switchThreshold = 0;
  }

  /**
   * The event to listen to on the map. can be 'postrender' or 'moveend'. Default is 'postrender'
   * @type {string}
   * @api
   */
  get mapChangeEvent() {
    return this._mapChangeEvent;
  }

  /**
   * @param {string} eventName
   */
  set mapChangeEvent(eventName) {
    this._mapChangeEvent = eventName;
    if (this._active) {
      if (this._postRenderListener) {
        unByKey(this._postRenderListener);
      }
      // @ts-ignore
      this._postRenderListener = this._olMap.on(this._mapChangeEvent, this._postRenderHandler.bind(this));
    }
  }

  /**
   * @returns {boolean}
   * @api
   */
  get loading() {
    return !!this._loadingImage;
  }

  /**
   * @returns {boolean}
   * @api
   */
  get active() {
    return this._active;
  }

  /**
   * @readonly
   * @type {import("@vcmap/core").ObliqueImage|null}
   * @api
   */
  get currentImage() { return this._currentImage; }

  /**
   * @readonly
   * @type {import("@vcmap/core").ObliqueCollection|null}
   * @api
   */
  get collection() { return this._collection; }

  /**
   * Set a new collection. The collection must be loaded.
   * If a previous collection was set, the current image and its resources will be removed from the olMap.
   * @param {import("@vcmap/core").ObliqueCollection} collection
   * @api
   */
  setCollection(collection) {
    this._loadingImage = null;
    if (!collection.loaded) {
      // eslint-disable-next-line no-console
      console.error('cannot set an unloaded collection');
      return;
    }
    this._collection = collection;
    this._removeCurrentView();
    this._currentView = null;
    this._currentImage = null;
  }

  /**
   * Activate the provider, its current view and its post render handler
   * @api
   */
  activate() {
    if (!this._collection) {
      throw new Error('cannot activate provider without an oblique collection.');
    }
    if (!this._active) {
      this._active = true;
      this._setCurrentView();
      if (!this._postRenderListener) {
        // @ts-ignore
        this._postRenderListener = this._olMap.on(this._mapChangeEvent, this._postRenderHandler.bind(this));
      }
    }
  }

  /**
   * Deactivates the provider, removing the current view and post render handler from the map
   * @api
   */
  deactivate() {
    if (this._currentView) {
      this._removeCurrentView();
    }

    if (this._postRenderListener) {
      unByKey(this._postRenderListener);
      this._postRenderListener = null;
    }

    this._active = false;
  }

  /**
   * @param {import("ol/coordinate").Coordinate} coord
   * @returns {import("ol/coordinate").Coordinate}
   * @private
   */
  _pullCoordinateToImageCenter(coord) {
    if (this.currentImage) {
      const center = [this.currentImage.meta.size[0] / 2, this.currentImage.meta.size[1] / 2];
      if (coord[0] < center[0]) {
        coord[0] += 50;
      } else {
        coord[0] -= 50;
      }

      if (coord[1] < center[1]) {
        coord[1] += 50;
      } else {
        coord[1] -= 50;
      }
    }
    return coord;
  }

  _postRenderHandler() {
    if (this._active && !this.loading && this.switchEnabled) {
      const currentSize = this._currentImage ? this._currentImage.meta.size : null;
      const imageCoordinates = this._olMap.getView().getCenter();
      const ratioLower = this.switchThreshold; // XXX this.switchThreshold;
      const ratioUpper = 1 - ratioLower;
      if (
        !this._currentImage || (
          imageCoordinates[0] / currentSize[0] > ratioLower &&
          imageCoordinates[0] / currentSize[0] < ratioUpper &&
          imageCoordinates[1] / currentSize[1] > ratioLower &&
          imageCoordinates[1] / currentSize[1] < ratioUpper
        )
      ) {
        return;
      }
      const pulledCenter = this._pullCoordinateToImageCenter(imageCoordinates.slice());
      const worldCoords = this._currentImage.transformImage2RealWorld(pulledCenter).slice(0, 2);
      const transform = getTransform(this._currentImage.meta.projection.proj, mercatorProjection.proj);
      // error in TransformFunction type definition, remove undefined after openlayer fixed the type
      const mercatorCoords = transform(worldCoords, undefined, undefined);
      const buffer = 200; // XXX make configurable?
      const extent = [
        mercatorCoords[0] - buffer, mercatorCoords[1] - buffer,
        mercatorCoords[0] + buffer, mercatorCoords[1] + buffer,
      ];
      const dataState = this._collection.getDataStateForExtent(extent);
      if (dataState === DataState.READY) {
        const image = this._collection.getImageForCoordinate(mercatorCoords, this._currentImage.viewDirection);
        if (image && image.name !== this._currentImage.name) {
          this._changeImage(image, imageCoordinates);
        }
      } else if (dataState === DataState.PENDING) {
        this._collection.loadDataForExtent(extent);
      }
    }
  }

  async _changeImage(image, imageCoordinates) {
    this._loadingImage = image;
    const { coords } = await transformFromImage(this._currentImage, imageCoordinates);
    if (this._loadingImage !== image) {
      return;
    }
    await this.setImage(image, coords);
  }

  /**
   * Sets the current image
   * @param {import("@vcmap/core").ObliqueImage} image
   * @param {import("ol/coordinate").Coordinate=} optCenter - mercator coordinates of an optional center to use. uses the images center if undefined
   * @returns {Promise<boolean>}
   * @api
   */
  async setImage(image, optCenter) {
    if (!this._collection) {
      throw new Error('cannot set an image without an oblique collection.');
    }
    this._loadingImage = image;
    const isNewImage = !this._currentImage || this._currentImage.name !== image.name;
    this._currentImage = image;
    if (isNewImage) {
      await image.calculateImageAverageHeight();
    }

    if (image !== this._loadingImage) {
      return false;
    }

    let olView;
    if (this._viewCache.has(image.meta)) {
      olView = this._viewCache.get(image.meta);
    } else {
      olView = new OLView(image.meta, this._collection.viewOptions);
      this._viewCache.set(image.meta, olView);
    }

    const previousView = this._currentView;
    this._currentView = olView;
    if (isNewImage) {
      this._currentView.setImageName(this._currentImage.name, this._currentImage[isDefaultImageSymbol]);
    }

    const [width, height] = this._currentImage.meta.size;
    let center = [width / 2, height / 2];
    if (optCenter) {
      // error in TransformFunction type definition, remove undefined after openlayer fixed the type
      const worldCenter = getTransform(
        mercatorProjection.proj,
        this._currentImage.meta.projection.proj,
      )(optCenter.slice(0, 2), undefined, undefined);
      const imageCenter = this._currentImage.transformRealWorld2Image(worldCenter, optCenter[2]);
      imageCenter[0] = withinBounds(imageCenter[0], width);
      imageCenter[1] = withinBounds(imageCenter[1], height);
      center = imageCenter;
    }
    this._currentView.view.setCenter(center);

    if (this._active) {
      this._setCurrentView(previousView);
    }

    this._loadingImage = null;
    if (isNewImage) {
      this.imageChanged.raiseEvent(image);
    }
    return true;
  }

  /**
   * @param {import("@vcmap/core").ObliqueView=} previousView
   * @private
   */
  _setCurrentView(previousView) {
    if (this._currentView) {
      const isSame = previousView && previousView === this._currentView;
      if (!isSame) {
        if (previousView) {
          this._olMap.removeLayer(previousView.layer);
        }

        if (this._olMap.getView() && this._olMap.getView().getResolution()) {
          this._currentView.view.setResolution(this._olMap.getView().getResolution());
        }

        this._olMap.setView(this._currentView.view);
        this._olMap.getLayers().insertAt(0, this._currentView.layer);
      }
    }
  }

  _removeCurrentView() {
    if (this._currentView) {
      if (this._olMap.getView() === this._currentView.view) {
        this._olMap.setView(new View());
      }
      this._olMap.removeLayer(this._currentView.layer);
    }
  }

  /**
   * Sets a new image based on a ground coordinate and a direction.
   * @param {import("ol/coordinate").Coordinate} coordinate
   * @param {import("@vcmap/core").ObliqueViewDirection} direction
   * @param {number} [zoom=2]
   * @returns {Promise<void>}
   * @api
   */
  async setView(coordinate, direction, zoom = 2) {
    if (!this._collection) {
      throw new Error('cannot set the view without an oblique collection.');
    }

    const usedCoordinate = coordinate.slice();
    const coordinateHash = `${coordinate.join('')}${direction}${zoom}`;
    this._loadingImage = coordinateHash;
    const image = await this._collection.loadImageForCoordinate(coordinate, direction);
    if (image) {
      if (this._loadingImage !== coordinateHash) {
        return;
      }
      this._loadingImage = image;
      if (!usedCoordinate[2] && image.meta.terrainProvider) {
        const transformResult = [usedCoordinate];
        await getHeightFromTerrainProvider(
          image.meta.terrainProvider,
          transformResult,
          mercatorProjection,
          transformResult,
        );
      }
      if (this._loadingImage !== image) {
        return;
      }
      const imageSet = await this.setImage(image, usedCoordinate);
      if (imageSet) {
        this._currentView.view.setZoom(zoom);
      }
    } else {
      throw new Error('could not find an image for this direction');
    }
  }

  /**
   * Returns a viewpoint for the currently set view.
   * @returns {Promise<ObliqueViewPoint>}
   * @api
   */
  async getView() {
    if (this._currentView && this._currentImage) {
      const imageCoord = this._currentView.view.getCenter();
      const { coords: center } = await transformFromImage(this._currentImage, imageCoord);
      return {
        center,
        direction: this._currentImage.viewDirection,
        zoom: this._currentView.view.getZoom(),
      };
    }
    return null;
  }

  /**
   * Destroys all openlayers resources created by this oblique provider
   * @api
   */
  destroy() {
    this._removeCurrentView();
    [...this._viewCache.values()].forEach((ov) => { ov.destroy(); });
    this._viewCache.clear();
    this._loadingImage = null;
    if (this._postRenderListener) {
      unByKey(this._postRenderListener);
      this._postRenderListener = null;
    }

    this.imageChanged.destroy();
    this._collection = null;
    this._olMap = null;
  }
}

export default ObliqueProvider;
