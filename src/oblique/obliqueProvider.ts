import { getTransform } from 'ol/proj.js';
import View from 'ol/View.js';
import type olMap from 'ol/Map.js';
import { unByKey } from 'ol/Observable.js';
import type { Coordinate } from 'ol/coordinate.js';
import type { EventsKey } from 'ol/events.js';

import { DataState } from './obliqueDataSet.js';
import ObliqueView from './obliqueView.js';
import { transformFromImage } from './helpers.js';
import { getHeightFromTerrainProvider } from '../layer/terrainHelpers.js';
import { mercatorProjection } from '../util/projection.js';
import VcsEvent from '../vcsEvent.js';
import type ObliqueImage from './obliqueImage.js';
import { isDefaultImageSymbol } from './obliqueImage.js';
import { ObliqueViewDirection } from './obliqueViewDirection.js';
import type ObliqueCollection from './obliqueCollection.js';
import ObliqueImageMeta from './obliqueImageMeta.js';

export type ObliqueViewpoint = {
  /**
   * in mercator
   */
  center: Coordinate;
  zoom: number;
  direction: ObliqueViewDirection;
};

function withinBounds(number: number, max: number): number {
  if (number < 0) {
    return 0;
  }

  if (number > max) {
    return max;
  }
  return number;
}

export type ObliqueProviderMapChangeEventType = 'postrender' | 'moveend';

class ObliqueProvider {
  private _active = false;

  private _loadingImage: ObliqueImage | string | null = null;

  private _olMap: olMap;

  private _viewCache: Map<ObliqueImageMeta, ObliqueView> = new Map();

  private _currentImage: ObliqueImage | null = null;

  private _currentView: ObliqueView | undefined = undefined;

  private _collection: ObliqueCollection | null = null;

  private _mapChangeEvent: ObliqueProviderMapChangeEventType = 'postrender';

  /**
   * Event raised once a new image is set on the provider. Will be passed the new image as the only argument.
   */
  imageChanged = new VcsEvent<ObliqueImage>();

  /**
   * Whether the post render handler should switch on image edge. Setting
   * this to false will suspend all post render handler switches.
   */
  switchEnabled = true;

  /**
   * Threshold from 0 to 1 to define when to start switching to other images. Where 0 indicates
   * to only switch, when the view center is outside of the image and 1 to always switch. 0.2 would start switching
   * if the view center is within the outer 20% of the image.
   */
  switchThreshold = 0;

  private _postRenderListener: EventsKey | undefined = undefined;

  constructor(olMap: olMap) {
    this._olMap = olMap;
  }

  /**
   * The event to listen to on the map. can be 'postrender' or 'moveend'. Default is 'postrender'
   */
  get mapChangeEvent(): ObliqueProviderMapChangeEventType {
    return this._mapChangeEvent;
  }

  set mapChangeEvent(eventName: ObliqueProviderMapChangeEventType) {
    this._mapChangeEvent = eventName;
    if (this._active) {
      if (this._postRenderListener) {
        unByKey(this._postRenderListener);
      }
      this._postRenderListener = this._olMap.on(
        this._mapChangeEvent,
        this._postRenderHandler.bind(this),
      );
    }
  }

  get loading(): boolean {
    return !!this._loadingImage;
  }

  get active(): boolean {
    return this._active;
  }

  get currentImage(): ObliqueImage | null {
    return this._currentImage;
  }

  get collection(): ObliqueCollection | null {
    return this._collection;
  }

  /**
   * Set a new collection. The collection must be loaded.
   * If a previous collection was set, the current image and its resources will be removed from the olMap.
   */
  setCollection(collection: ObliqueCollection): void {
    this._loadingImage = null;
    if (!collection.loaded) {
      // eslint-disable-next-line no-console
      console.error('cannot set an unloaded collection');
      return;
    }
    this._collection = collection;
    this._removeCurrentView();
    this._currentView = undefined;
    this._currentImage = null;
  }

  /**
   * Activate the provider, its current view and its post render handler
   */
  activate(): void {
    if (!this._collection) {
      throw new Error(
        'cannot activate provider without an oblique collection.',
      );
    }
    if (!this._active) {
      this._active = true;
      this._setCurrentView();
      if (!this._postRenderListener) {
        this._postRenderListener = this._olMap.on(
          this._mapChangeEvent,
          this._postRenderHandler.bind(this),
        );
      }
    }
  }

  /**
   * Deactivates the provider, removing the current view and post render handler from the map
   */
  deactivate(): void {
    if (this._currentView) {
      this._removeCurrentView();
    }

    if (this._postRenderListener) {
      unByKey(this._postRenderListener);
      this._postRenderListener = undefined;
    }

    this._active = false;
  }

  private _pullCoordinateToImageCenter(coord: Coordinate): Coordinate {
    if (this.currentImage) {
      const center = [
        this.currentImage.meta.size[0] / 2,
        this.currentImage.meta.size[1] / 2,
      ];
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

  private _postRenderHandler(): void {
    if (this._active && !this.loading && this.switchEnabled) {
      const currentSize = this._currentImage
        ? this._currentImage.meta.size
        : null;
      const imageCoordinates = this._olMap.getView().getCenter() as Coordinate;
      const ratioLower = this.switchThreshold; // XXX this.switchThreshold;
      const ratioUpper = 1 - ratioLower;
      if (
        !this._currentImage ||
        (imageCoordinates[0] / currentSize![0] > ratioLower &&
          imageCoordinates[0] / currentSize![0] < ratioUpper &&
          imageCoordinates[1] / currentSize![1] > ratioLower &&
          imageCoordinates[1] / currentSize![1] < ratioUpper)
      ) {
        return;
      }
      const pulledCenter = this._pullCoordinateToImageCenter(
        imageCoordinates.slice(),
      );
      const worldCoords = this._currentImage
        .transformImage2RealWorld(pulledCenter)
        .slice(0, 2);
      const transform = getTransform(
        this._currentImage.meta.projection.proj,
        mercatorProjection.proj,
      );
      // error in TransformFunction type definition, remove undefined after openlayer fixed the type
      const mercatorCoords = transform(worldCoords, undefined, undefined);
      const buffer = 200; // XXX make configurable?
      const extent = [
        mercatorCoords[0] - buffer,
        mercatorCoords[1] - buffer,
        mercatorCoords[0] + buffer,
        mercatorCoords[1] + buffer,
      ];
      const dataState = this._collection!.getDataStateForExtent(extent);
      if (dataState === DataState.READY) {
        const image = this._collection!.getImageForCoordinate(
          mercatorCoords,
          this._currentImage.viewDirection,
        );
        if (image && image.name !== this._currentImage.name) {
          // eslint-disable-next-line no-void
          void this._changeImage(image, imageCoordinates);
        }
      } else if (dataState === DataState.PENDING) {
        // eslint-disable-next-line no-void
        void this._collection!.loadDataForExtent(extent);
      }
    }
  }

  private async _changeImage(
    image: ObliqueImage,
    imageCoordinates: Coordinate,
  ): Promise<void> {
    this._loadingImage = image;
    const { coords } = await transformFromImage(
      this._currentImage as ObliqueImage,
      imageCoordinates,
    );
    if (this._loadingImage !== image) {
      return;
    }
    await this.setImage(image, coords);
  }

  /**
   * Sets the current image
   * @param  image
   * @param  optCenter - mercator coordinates of an optional center to use. uses the images center if undefined
   */
  async setImage(
    image: ObliqueImage,
    optCenter?: Coordinate,
  ): Promise<boolean> {
    if (!this._collection) {
      throw new Error('cannot set an image without an oblique collection.');
    }
    this._loadingImage = image;
    const isNewImage =
      !this._currentImage || this._currentImage.name !== image.name;
    this._currentImage = image;
    if (isNewImage) {
      await image.calculateImageAverageHeight();
    }

    if (image !== this._loadingImage) {
      return false;
    }

    let olView: ObliqueView;
    if (this._viewCache.has(image.meta)) {
      olView = this._viewCache.get(image.meta) as ObliqueView;
    } else {
      olView = new ObliqueView(image.meta, this._collection.viewOptions);
      this._viewCache.set(image.meta, olView);
    }

    const previousView = this._currentView;
    this._currentView = olView;
    if (isNewImage) {
      this._currentView.setImageName(
        this._currentImage.name,
        this._currentImage[isDefaultImageSymbol],
      );
    }

    const [width, height] = this._currentImage.meta.size;
    let center = [width / 2, height / 2];
    if (optCenter) {
      // error in TransformFunction type definition, remove undefined after openlayer fixed the type
      const worldCenter = getTransform(
        mercatorProjection.proj,
        this._currentImage.meta.projection.proj,
      )(optCenter.slice(0, 2), undefined, undefined);
      const imageCenter = this._currentImage.transformRealWorld2Image(
        worldCenter,
        optCenter[2],
      );
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

  private _setCurrentView(previousView?: ObliqueView): void {
    if (this._currentView) {
      const isSame = previousView && previousView === this._currentView;
      if (!isSame) {
        if (previousView) {
          this._olMap.removeLayer(previousView.layer);
        }

        if (this._olMap.getView() && this._olMap.getView().getResolution()) {
          this._currentView.view.setResolution(
            this._olMap.getView().getResolution(),
          );
        }

        this._olMap.setView(this._currentView.view);
        this._olMap.getLayers().insertAt(0, this._currentView.layer);
      }
    }
  }

  private _removeCurrentView(): void {
    if (this._currentView) {
      if (this._olMap.getView() === this._currentView.view) {
        this._olMap.setView(new View());
      }
      this._olMap.removeLayer(this._currentView.layer);
    }
  }

  /**
   * Sets a new image based on a ground coordinate and a direction.
   * @param  coordinate
   * @param  direction
   * @param  [zoom=2]
   */
  async setView(
    coordinate: Coordinate,
    direction: ObliqueViewDirection,
    zoom = 2,
  ): Promise<void> {
    if (!this._collection) {
      throw new Error('cannot set the view without an oblique collection.');
    }

    const usedCoordinate = coordinate.slice();
    const coordinateHash = `${coordinate.join('')}${direction}${zoom}`;
    this._loadingImage = coordinateHash;
    const image = await this._collection.loadImageForCoordinate(
      coordinate,
      direction,
    );
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
      if (imageSet && this._currentView) {
        this._currentView.view.setZoom(zoom);
      }
    } else {
      throw new Error('could not find an image for this direction');
    }
  }

  /**
   * Returns a viewpoint for the currently set view.
   */
  async getView(): Promise<ObliqueViewpoint | null> {
    if (this._currentView && this._currentImage) {
      const imageCoord = this._currentView.view.getCenter() as Coordinate;
      const { coords: center } = await transformFromImage(
        this._currentImage,
        imageCoord,
      );
      return {
        center,
        direction: this._currentImage.viewDirection,
        zoom: this._currentView.view.getZoom() as number,
      };
    }
    return null;
  }

  /**
   * Destroys all openlayers resources created by this oblique provider
   */
  destroy(): void {
    this._removeCurrentView();
    [...this._viewCache.values()].forEach((ov) => {
      ov.destroy();
    });
    this._viewCache.clear();
    this._loadingImage = null;
    if (this._postRenderListener) {
      unByKey(this._postRenderListener);
      this._postRenderListener = undefined;
    }

    this.imageChanged.destroy();
    this._collection = null;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this._olMap = undefined;
  }
}

export default ObliqueProvider;
