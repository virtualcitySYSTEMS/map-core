import type { JulianDate, Cesium3DTileset, Scene } from '@vcmap-cesium/engine';
import {
  PrimitiveCollection,
  CesiumWidget,
  ScreenSpaceEventHandler,
  ShadowMode,
  Math as CesiumMath,
} from '@vcmap-cesium/engine';
import type { Coordinate } from 'ol/coordinate.js';
import type { VcsMapOptions } from './vcsMap.js';
import VcsMap from './vcsMap.js';
import type { PanoramaImage } from '../panorama/panoramaImage.js';
import { mapClassRegistry } from '../classRegistry.js';
import type { PanoramaImageView } from '../panorama/panoramaImageView.js';
import { createPanoramaImageView } from '../panorama/panoramaImageView.js';
import {
  getViewpointFromScene,
  setupCesiumInteractions,
} from './cesiumMapHelpers.js';
import VcsEvent from '../vcsEvent.js';
import type { PanoramaCameraController } from '../panorama/panoramaCameraController.js';
import { createPanoramaCameraController } from '../panorama/panoramaCameraController.js';
import type Viewpoint from '../util/viewpoint.js';
import { ensureInCollection, indexChangedOnPrimitive } from './cesiumMap.js';
import Projection from '../util/projection.js';
import Collection from '../util/collection.js';
import type PanoramaDataset from '../panorama/panoramaDataset.js';
import type Layer from '../layer/layer.js';

export type PanoramaMapOptions = VcsMapOptions;

export default class PanoramaMap extends VcsMap {
  static get className(): string {
    return 'PanoramaMap';
  }

  static getDefaultOptions(): PanoramaMapOptions {
    return {
      ...VcsMap.getDefaultOptions(),
    };
  }

  /**
   * The event raised when the panorama datasets collection on this map is changed.
   */
  readonly panoramaDatasetsChanged = new VcsEvent<
    Collection<PanoramaDataset>
  >();

  /**
   * The event raised when the current image changes. Can be raised with undefined if the current image is cleared
   * or a viewpoint fails to load an image.
   */
  readonly currentImageChanged = new VcsEvent<PanoramaImage | undefined>();

  private _cesiumWidget: CesiumWidget | undefined;

  private _imageView: PanoramaImageView | undefined;

  private _currentImage: PanoramaImage | undefined;

  private _screenSpaceListener: (() => void) | undefined;

  private _screenSpaceEventHandler: ScreenSpaceEventHandler | undefined;

  private _cameraController: PanoramaCameraController | undefined;

  private _panoramaDatasets = new Collection<PanoramaDataset>();

  private _destroyCollection = true;

  private _listeners: (() => void)[] = [];

  /**
   * Internal API. throws if not properly initialized
   */
  get screenSpaceEventHandler(): ScreenSpaceEventHandler {
    if (!this._screenSpaceEventHandler) {
      throw new Error('ScreenSpaceEventHandler not initialized');
    }
    return this._screenSpaceEventHandler;
  }

  get currentPanoramaImage(): PanoramaImage | undefined {
    return this._currentImage;
  }

  /**
   * The panorama image view controlling image loading and rendering.
   * Throws if not properly initialized
   */
  get panoramaView(): PanoramaImageView {
    if (!this._imageView) {
      throw new Error('PanoramaImageView not initialized');
    }
    return this._imageView;
  }

  /**
   * The panorama camera controller controlling the camera movement.
   * Throws if not properly initialized
   */
  get panoramaCameraController(): PanoramaCameraController {
    if (!this._cameraController) {
      throw new Error('PanoramaCameraController not initialized');
    }
    return this._cameraController;
  }

  /**
   * The panorama datasets collection. The initial collection is destroyed with the map. If you
   * set your own collection, you are responsible for destroying it.
   */
  get panoramaDatasets(): Collection<PanoramaDataset> {
    return this._panoramaDatasets;
  }

  set panoramaDatasets(collection: Collection<PanoramaDataset>) {
    if (this._destroyCollection) {
      this._panoramaDatasets.destroy();
    }
    this._panoramaDatasets = collection;
    this._destroyCollection = false;
    this.panoramaDatasetsChanged.raiseEvent(collection);
  }

  /**
   * Access to the raw cesium widget for finer control. Throws if not properly initialized.
   */
  getCesiumWidget(): CesiumWidget {
    if (!this._cesiumWidget) {
      throw new Error('CesiumWidget not initialized');
    }
    return this._cesiumWidget;
  }

  override async initialize(): Promise<void> {
    if (!this.initialized) {
      this._cesiumWidget = new CesiumWidget(this.mapElement, {
        requestRenderMode: false,
        scene3DOnly: true,
        baseLayer: false,
        shadows: false,
        skyBox: false,
        skyAtmosphere: false,
        globe: false,
        terrainShadows: ShadowMode.DISABLED,
        msaaSamples: 1,
      });

      this._cesiumWidget.scene.screenSpaceCameraController.enableInputs = false;
      this._cesiumWidget.scene.primitives.destroyPrimitives = false;

      this._screenSpaceEventHandler = new ScreenSpaceEventHandler(
        this._cesiumWidget.canvas,
      );

      this._screenSpaceListener = setupCesiumInteractions(
        this,
        this._cesiumWidget.scene,
        this.screenSpaceEventHandler,
      );
      this._imageView = createPanoramaImageView(this);
      this._cameraController = createPanoramaCameraController(this);
      this.initialized = true;

      this._listeners.push(
        this._cesiumWidget.scene.postRender.addEventListener(
          (eventScene: Scene, time: JulianDate) => {
            this.postRender.raiseEvent({
              map: this,
              originalEvent: { scene: eventScene, time },
            });
          },
        ),
      );
    }
    await super.initialize();
  }

  override async activate(): Promise<void> {
    await super.activate();
    if (this.active && this._cesiumWidget) {
      this._cesiumWidget.useDefaultRenderLoop = true;
      this._cesiumWidget.resize();
    }
  }

  override deactivate(): void {
    super.deactivate();
    if (this._cesiumWidget) {
      this._cesiumWidget.useDefaultRenderLoop = false;
    }
  }

  override getViewpoint(): Promise<null | Viewpoint> {
    return Promise.resolve(this.getViewpointSync());
  }

  override getViewpointSync(): Viewpoint | null {
    if (!this._cesiumWidget || !this._cesiumWidget.scene || !this.target) {
      return null;
    }
    return getViewpointFromScene(this._cesiumWidget.scene);
  }

  /**
   * Sets the current image to the closest image to the given coordinate. Does not set the
   * current image, if there is no image within the default distance.
   * @param viewpoint
   */
  override async gotoViewpoint(viewpoint: Viewpoint): Promise<void> {
    if (
      this.movementApiCallsDisabled ||
      !viewpoint.isValid() ||
      !this._cesiumWidget
    ) {
      return;
    }

    const position = viewpoint.groundPosition ?? viewpoint.cameraPosition;
    if (!position) {
      return;
    }

    const closestImage = await this.getClosestImage(
      Projection.wgs84ToMercator(position),
    );

    if (closestImage) {
      if (viewpoint.heading != null) {
        this._cesiumWidget.camera.setView({
          orientation: {
            pitch: closestImage.orientation.pitch,
            roll: closestImage.orientation.roll,
            heading: CesiumMath.toRadians(viewpoint.heading),
          },
        });
      }

      this.setCurrentImage(closestImage);
    }
  }

  /**
   * Returns the closest image to the given coordinate within the given distance from all the datasets in the panorama datasets collection.
   * @param coordinate
   * @param maxDistance
   */
  async getClosestImage(
    coordinate: Coordinate,
    maxDistance = 200,
  ): Promise<PanoramaImage | undefined> {
    const loadPromises = [...this._panoramaDatasets]
      .filter((dataset) => dataset.active)
      .map(async (dataset) => {
        const closesImage = await dataset.getClosestImage(
          coordinate,
          maxDistance,
        );
        if (closesImage) {
          return {
            ...closesImage,
            dataset,
          };
        }

        return undefined;
      });

    const images = await Promise.all(loadPromises);

    let minDistanceSqrd = Infinity;
    let closestIndex = -1;

    images.forEach((image, index) => {
      if (image && image.distanceSqrd < minDistanceSqrd) {
        minDistanceSqrd = image.distanceSqrd;
        closestIndex = index;
      }
    });

    if (closestIndex !== -1) {
      const { imageName, dataset } = images[closestIndex]!;
      return dataset.createPanoramaImage(imageName); // XXX position is a HACK to support frankenstein datasets
    }

    return undefined;
  }

  setCurrentImage(image?: PanoramaImage): void {
    if (this._currentImage !== image) {
      this._currentImage = image;
      this.currentImageChanged.raiseEvent(image);
    }
  }

  override indexChanged(layer: Layer): void {
    const viz = this.getVisualizationsForLayer(layer);
    if (viz) {
      viz.forEach((item) => {
        if (item instanceof PrimitiveCollection) {
          indexChangedOnPrimitive(
            this.getCesiumWidget().scene.primitives,
            item,
            this.layerCollection,
          );
        }
      });
    }
  }

  /**
   * Internal API used to register visualizations from layer implementations
   * @param  primitiveCollection
   */
  addPrimitiveCollection(
    primitiveCollection: PrimitiveCollection | Cesium3DTileset,
  ): void {
    if (!this._cesiumWidget) {
      throw new Error('Cannot add primitive to uninitialized map');
    }
    if (this.validateVisualization(primitiveCollection)) {
      this.addVisualization(primitiveCollection);
      ensureInCollection(
        this._cesiumWidget.scene.primitives,
        primitiveCollection,
        this.layerCollection,
      );
    }
  }

  /**
   * Internal API to unregister the visualization for a layers implementation
   * @param  primitiveCollection
   */
  removePrimitiveCollection(
    primitiveCollection: PrimitiveCollection | Cesium3DTileset,
  ): void {
    this.removeVisualization(primitiveCollection);
    this._cesiumWidget?.scene.primitives.remove(primitiveCollection);
  }

  destroy(): void {
    this.currentImageChanged.destroy();
    this._currentImage?.destroy();
    this._cameraController?.destroy();
    this._imageView?.destroy();
    this._screenSpaceListener?.();
    this._screenSpaceEventHandler?.destroy();
    this._cesiumWidget?.destroy();

    if (this._destroyCollection) {
      this._panoramaDatasets.destroy();
    }

    this._listeners.forEach((cb) => {
      cb();
    });

    super.destroy();
  }
}

mapClassRegistry.registerClass(PanoramaMap.className, PanoramaMap);
