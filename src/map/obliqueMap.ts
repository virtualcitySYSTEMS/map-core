import { boundingExtent, containsXY } from 'ol/extent.js';
import { getTransform, transform, transformExtent } from 'ol/proj.js';
import type { Map as OLMap } from 'ol';
import type { Coordinate } from 'ol/coordinate.js';

import { check } from '@vcsuite/check';
import { parseBoolean, parseNumber } from '@vcsuite/parsers';
import Extent from '../util/extent.js';
import { mercatorProjection, wgs84Projection } from '../util/projection.js';
import {
  getResolutionOptions,
  getZoom,
} from '../layer/oblique/obliqueHelpers.js';
import Viewpoint from '../util/viewpoint.js';
import BaseOLMap from './baseOLMap.js';
import type { VcsMapOptions } from './vcsMap.js';
import VcsMap from './vcsMap.js';
import VcsEvent from '../vcsEvent.js';
import type { ObliqueViewDirection } from '../oblique/obliqueViewDirection.js';
import { ObliqueViewDirection as ViewDirection } from '../oblique/obliqueViewDirection.js';
import type { ObliqueProviderMapChangeEventType } from '../oblique/obliqueProvider.js';
import ObliqueProvider from '../oblique/obliqueProvider.js';
import ObliqueCollection from '../oblique/obliqueCollection.js';
import { transformFromImage } from '../oblique/helpers.js';
import { mapClassRegistry } from '../classRegistry.js';
import DefaultObliqueCollection from '../oblique/defaultObliqueCollection.js';
import type ObliqueImage from '../oblique/obliqueImage.js';

export type ObliqueOptions = VcsMapOptions & {
  changeOnMoveEnd?: boolean;
  switchThreshold?: number;
  switchOnEdge?: boolean;
  maintainViewpointOnCollectionChange?: boolean;
};

const defaultHeadings: Record<ViewDirection, number> = {
  [ViewDirection.NORTH]: 0,
  [ViewDirection.EAST]: 90,
  [ViewDirection.SOUTH]: 180,
  [ViewDirection.WEST]: 270,
  [ViewDirection.NADIR]: 0,
};

const defaultCollection = new DefaultObliqueCollection();

/**
 * returns the direction which matches the heading of the viewpoint
 * @param  viewpoint
 */
export function getViewDirectionFromViewpoint(
  viewpoint: Viewpoint,
): ObliqueViewDirection {
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

export function getMercatorViewpointCenter(viewpoint: Viewpoint): Coordinate {
  const gpWGS84 = viewpoint.groundPosition ??
    viewpoint.cameraPosition ?? [0, 0, 0];
  return transform(gpWGS84, wgs84Projection.proj, mercatorProjection.proj);
}

/**
 * @group Map
 */
class ObliqueMap extends BaseOLMap {
  static get className(): string {
    return 'ObliqueMap';
  }

  private _loadingCollection: ObliqueCollection | null;

  private _mapChangeEvent: ObliqueProviderMapChangeEventType;

  private _switchThreshold: number;

  private _switchEnabled: boolean;

  /**
   * An event raise, when the collection changes. Is passed the collection as its only argument.
   */
  collectionChanged: VcsEvent<ObliqueCollection>;

  failedToSetCollection = new VcsEvent<ObliqueCollection>();

  maintainViewpointOnCollectionChange: boolean;

  private _activeCollectionDestroyedListener: () => void;

  private _obliqueProvider: ObliqueProvider | null = null;

  initializedPromise: Promise<void> | null = null;

  static getDefaultOptions(): ObliqueOptions {
    return {
      ...VcsMap.getDefaultOptions(),
      changeOnMoveEnd: false,
      switchThreshold: 0,
      switchOnEdge: true,
      maintainViewpointOnCollectionChange: false,
    };
  }

  constructor(options: ObliqueOptions) {
    super(options);
    const defaultOptions = ObliqueMap.getDefaultOptions();
    this._loadingCollection = null;

    this._mapChangeEvent = options.changeOnMoveEnd ? 'moveend' : 'postrender';

    this._switchThreshold = parseNumber(
      options.switchThreshold,
      defaultOptions.switchThreshold,
    );
    if (this._switchThreshold > 1) {
      this._switchThreshold = 0.2;
    } else if (this._switchThreshold < 0) {
      this._switchThreshold = 0;
    }

    this._switchEnabled = parseBoolean(
      options.switchOnEdge,
      defaultOptions.switchOnEdge,
    );

    this.collectionChanged = new VcsEvent();

    this.maintainViewpointOnCollectionChange = parseBoolean(
      options.maintainViewpointOnCollectionChange,
      defaultOptions.maintainViewpointOnCollectionChange,
    );

    this._activeCollectionDestroyedListener = (): void => {};
  }

  /**
   * Whether the post render handler should switch on image edge. Setting
   * this to false will suspend all post render handler switches.
   */
  get switchEnabled(): boolean {
    return this._switchEnabled;
  }

  /**
   * @param  switchEnabled
   */
  set switchEnabled(switchEnabled: boolean) {
    this._switchEnabled = switchEnabled;
    if (this._obliqueProvider) {
      this._obliqueProvider.switchEnabled = switchEnabled;
    }
  }

  /**
   * Threshold from 0 to 1 to define when to start switching to other images. Where 0 indicates
   * to only switch, when the view center is outside of the image and 1 to always switch. 0.2 would start switching
   * if the view center is within the outer 20% of the image.
   */
  get switchThreshold(): number {
    return this._switchThreshold;
  }

  /**
   * @param  threshold
   */
  set switchThreshold(threshold: number) {
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

  async initialize(): Promise<void> {
    if (!this.initializedPromise) {
      this.initializedPromise = super
        .initialize()
        .then(async () => {
          this._obliqueProvider = new ObliqueProvider(this.olMap as OLMap);
          this.mapChangeEvent = this._mapChangeEvent;
          this.switchThreshold = this._switchThreshold;
          this.switchEnabled = this._switchEnabled;
          let collectionToLoad = this._loadingCollection;
          if (!collectionToLoad) {
            collectionToLoad = defaultCollection;
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

  get mapChangeEvent(): ObliqueProviderMapChangeEventType {
    return this._mapChangeEvent;
  }

  set mapChangeEvent(eventType: ObliqueProviderMapChangeEventType) {
    check(eventType, String);

    this._mapChangeEvent = eventType;
    if (this._obliqueProvider) {
      this._obliqueProvider.mapChangeEvent = eventType;
    }
  }

  get collection(): ObliqueCollection | null {
    return this._obliqueProvider?.collection ?? null;
  }

  get imageChanged(): VcsEvent<ObliqueImage> | null {
    return this._obliqueProvider?.imageChanged ?? null;
  }

  get currentImage(): ObliqueImage | null {
    return this._obliqueProvider?.currentImage ?? null;
  }

  async canShowViewpoint(viewpoint: Viewpoint): Promise<boolean> {
    await this.initialize();
    if (this.collection) {
      const viewDirection = getViewDirectionFromViewpoint(viewpoint);
      const mercatorCoordinates = getMercatorViewpointCenter(viewpoint);
      return this.collection.hasImageAtCoordinate(
        mercatorCoordinates,
        viewDirection,
      );
    }
    return false;
  }

  async activate(): Promise<void> {
    await super.activate();
    if (this.active) {
      this._obliqueProvider?.activate?.();
    }
  }

  getExtentOfCurrentImage(): Extent {
    const image = this.currentImage;
    if (image) {
      const coords = boundingExtent(image.groundCoordinates);
      return new Extent({
        coordinates: transformExtent(
          coords,
          image.meta.projection.proj,
          mercatorProjection.proj,
        ),
        projection: mercatorProjection.toJSON(),
      });
    }
    return new Extent({
      coordinates: [
        -18924313.4349, -15538711.0963, 18924313.4349, 15538711.0963,
      ],
      projection: mercatorProjection.toJSON(),
    });
  }

  deactivate(): void {
    super.deactivate();
    this._obliqueProvider?.deactivate?.();
  }

  /**
   * Sets a new oblique collection
   */
  async setCollection(
    obliqueCollection: ObliqueCollection,
    viewpoint?: Viewpoint,
  ): Promise<void> {
    check(obliqueCollection, ObliqueCollection);

    if (this.movementApiCallsDisabled) {
      return;
    }

    this._loadingCollection = obliqueCollection;
    if (!this.initializedPromise) {
      return;
    }

    await this.initializedPromise;
    if (this._loadingCollection !== obliqueCollection) {
      return;
    }

    await this._setCollection(obliqueCollection, viewpoint);
  }

  /**
   * Sets a new oblique collection
   */
  private async _setCollection(
    obliqueCollection: ObliqueCollection,
    viewpoint?: Viewpoint,
  ): Promise<void> {
    this._loadingCollection = obliqueCollection;
    await obliqueCollection.load();
    const vp = viewpoint || (await this.getViewpoint());
    if (this._loadingCollection !== obliqueCollection) {
      return;
    }

    if (
      viewpoint &&
      this.maintainViewpointOnCollectionChange &&
      this.collection
    ) {
      const viewDirection = getViewDirectionFromViewpoint(viewpoint);
      const mercatorCoordinates = getMercatorViewpointCenter(viewpoint);
      const canShow = await obliqueCollection.hasImageAtCoordinate(
        mercatorCoordinates,
        viewDirection,
      );
      if (!canShow) {
        this.failedToSetCollection.raiseEvent(obliqueCollection);
        return;
      }
    }

    this._obliqueProvider?.setCollection(obliqueCollection);
    this._activeCollectionDestroyedListener();
    this._activeCollectionDestroyedListener =
      obliqueCollection.destroyed.addEventListener(() => {
        // eslint-disable-next-line no-void
        void this._setCollection(defaultCollection);
      });

    this.collectionChanged.raiseEvent(obliqueCollection);
    if (vp) {
      await this.gotoViewpoint(vp);
    }
  }

  /**
   * Sets an image by its name on the map
   */
  async setImageByName(
    imageName: string,
    optCenter?: Coordinate,
  ): Promise<void> {
    if (this.movementApiCallsDisabled || !this.initializedPromise) {
      return;
    }
    await this.initializedPromise;
    const image = this._obliqueProvider?.collection?.getImageByName(imageName);
    if (image) {
      await this._obliqueProvider!.setImage(image, optCenter);
    }
  }

  async getViewpoint(): Promise<Viewpoint | null> {
    const image = this.currentImage;
    if (!image) {
      return null;
    }
    // if we dont have an image, we may not have a map, thus two if clauses
    const viewCenter = this.olMap!.getView().getCenter();
    if (!viewCenter) {
      return null;
    }

    const transformationOptions = { dataProjection: wgs84Projection };
    const { coords } = await transformFromImage(
      image,
      viewCenter,
      transformationOptions,
    );
    return this._computeViewpointInternal(coords);
  }

  getViewpointSync(): Viewpoint | null {
    const image = this.currentImage;
    if (!image) {
      return null;
    }

    const gpImageCoordinates = this.olMap!.getView().getCenter();
    if (!gpImageCoordinates) {
      return null;
    }

    const gpInternalProjection = image.transformImage2RealWorld(
      gpImageCoordinates,
      image.averageHeight,
    );

    const transfrom = getTransform(
      image.meta.projection.proj,
      wgs84Projection.proj,
    );
    // getText can return a rich Text string[] We do not support this at the moment.
    const gpWGS84 = transfrom(
      gpInternalProjection.slice(0, 2),
      undefined,
      undefined,
    );
    return this._computeViewpointInternal(gpWGS84);
  }

  private _computeViewpointInternal(groundPosition: Coordinate): Viewpoint {
    const image = this.currentImage as ObliqueImage;
    const map = this.olMap as OLMap;
    const { size, fovy, metersPerUnit } = getResolutionOptions(map, image);

    const view = map.getView();
    const resolution = view.getResolution() || 1;
    const visibleMapUnits = resolution * size.height;
    const visibleMeters = visibleMapUnits * metersPerUnit;
    const height = Math.abs(visibleMeters / 2 / Math.tan(fovy / 2));

    const avgHeight = groundPosition[2] || image.averageHeight;
    const cameraHeight = height + avgHeight;

    return new Viewpoint({
      cameraPosition: [groundPosition[0], groundPosition[1], cameraHeight],
      groundPosition,
      heading: defaultHeadings[image.viewDirection],
      pitch: -90,
      roll: 0,
      distance: height,
    });
  }

  async gotoViewpoint(viewpoint: Viewpoint): Promise<void> {
    if (
      this.movementApiCallsDisabled ||
      !this.olMap ||
      !this._obliqueProvider ||
      !viewpoint.isValid()
    ) {
      return;
    }

    const viewDirection = getViewDirectionFromViewpoint(viewpoint);
    const mercatorCoordinates = getMercatorViewpointCenter(viewpoint);
    const { distance } = viewpoint;
    await this._obliqueProvider.setView(mercatorCoordinates, viewDirection);
    if (this._obliqueProvider.currentImage) {
      const zoom = getZoom(
        this.olMap,
        this._obliqueProvider.currentImage,
        distance as number,
      );
      this.olMap.getView().setZoom(zoom);
    }
  }

  pointIsVisible(coords: Coordinate): boolean {
    const image = this.currentImage;
    if (!image || !this.active) {
      return false;
    }
    const view = this.olMap!.getView();
    const extent = view.calculateExtent(this.olMap!.getSize());
    const bl = image.transformImage2RealWorld([extent[0], extent[1]]);
    const ur = image.transformImage2RealWorld([extent[2], extent[3]]);
    const bbox = [bl[0], bl[1], ur[0], ur[1]];
    const transformedBbox = transformExtent(
      bbox,
      image.meta.projection.proj,
      wgs84Projection.proj,
    );
    return containsXY(transformedBbox, coords[0], coords[1]);
  }

  toJSON(): ObliqueOptions {
    const config: ObliqueOptions = super.toJSON();
    const defaultOptions = ObliqueMap.getDefaultOptions();

    if (this.mapChangeEvent === 'moveend') {
      config.changeOnMoveEnd = true;
    }

    if (this.switchThreshold !== defaultOptions.switchThreshold) {
      config.switchThreshold = this.switchThreshold;
    }

    if (this.switchEnabled !== defaultOptions.switchOnEdge) {
      config.switchOnEdge = this.switchEnabled;
    }

    if (
      this.maintainViewpointOnCollectionChange !==
      defaultOptions.maintainViewpointOnCollectionChange
    ) {
      config.maintainViewpointOnCollectionChange =
        this.maintainViewpointOnCollectionChange;
    }

    return config;
  }

  destroy(): void {
    if (this._obliqueProvider) {
      this._obliqueProvider.destroy();
    }
    this.collectionChanged.destroy();
    this.failedToSetCollection.destroy();
    this._activeCollectionDestroyedListener();
    super.destroy();
  }
}

mapClassRegistry.registerClass(ObliqueMap.className, ObliqueMap);
export default ObliqueMap;
