import type { JulianDate, Cesium3DTileset, Scene } from '@vcmap-cesium/engine';
import {
  Color,
  PrimitiveCollection,
  CesiumWidget,
  ScreenSpaceEventHandler,
  ShadowMode,
  Math as CesiumMath,
} from '@vcmap-cesium/engine';
import type { Coordinate } from 'ol/coordinate.js';
import VcsMap, { type VcsMapOptions } from './vcsMap.js';
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
import type Layer from '../layer/layer.js';
import { defaultCursorColor } from '../panorama/panoramaTileMaterial.js';
import LayerState from '../layer/layerState.js';
import type PanoramaDatasetLayer from '../layer/panoramaDatasetLayer.js';

export type PanoramaMapOptions = VcsMapOptions & {
  /**
   * Css color string to use for the overlay NaN color.
   */
  overlayNaNColor?: string;
  /**
   * Css color string to use for the cursor color.
   */
  cursorColor?: string;
};

export default class PanoramaMap extends VcsMap {
  static get className(): string {
    return 'PanoramaMap';
  }

  static getDefaultOptions(): PanoramaMapOptions {
    return {
      ...VcsMap.getDefaultOptions(),
      overlayNaNColor: 'rgba(255, 0, 0, 1)',
      cursorColor: defaultCursorColor,
      fallbackToCurrentMap: false,
    };
  }

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

  private _listeners: (() => void)[] = [];

  private _overlayNaNColor: string | undefined;

  private _cursorColor: string | undefined;

  constructor(options: PanoramaMapOptions) {
    const defaultOptions = PanoramaMap.getDefaultOptions();
    super({ ...defaultOptions, ...options });

    this._overlayNaNColor =
      options.overlayNaNColor ?? defaultOptions.overlayNaNColor;
    this._cursorColor = options.cursorColor ?? defaultOptions.cursorColor;
  }

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

      if (this._overlayNaNColor) {
        this._imageView.tilePrimitiveCollection.overlayNaNColor =
          Color.fromCssColorString(this._overlayNaNColor);
      }

      if (this._cursorColor) {
        this._imageView.tilePrimitiveCollection.cursorColor =
          Color.fromCssColorString(this._cursorColor);
      }

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
   * Sets the current image to the closest image to the given coordinate. Unsets the
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

    const closestImage = await this.getClosestImageFromViewpoint(viewpoint);

    if (closestImage) {
      if (viewpoint.heading != null) {
        const { camera } = this._cesiumWidget;
        camera.setView({
          orientation: {
            heading: CesiumMath.toRadians(viewpoint.heading),
            pitch: camera.pitch,
            roll: camera.roll,
          },
        });
      }
    }
    this.setCurrentImage(closestImage);
  }

  /**
   * {@link getClosestImage} for the given viewpoint. Prefers the ground position
   * @param viewpoint
   */
  async getClosestImageFromViewpoint(
    viewpoint: Viewpoint,
  ): Promise<PanoramaImage | undefined> {
    if (viewpoint.isValid()) {
      const position = viewpoint.groundPosition ?? viewpoint.cameraPosition;
      if (position) {
        return this.getClosestImage(Projection.wgs84ToMercator(position), 200);
      }
    }
    return undefined;
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
    const loadPromises = [...this.layerCollection]
      .filter(
        (dataset): dataset is PanoramaDatasetLayer =>
          dataset.state !== LayerState.INACTIVE &&
          dataset.className === 'PanoramaDatasetLayer',
      )
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

  /**
   * Sets the current image to the given panorama image. If the image is undefined, the current image is cleared.
   * @param image
   */
  setCurrentImage(image?: PanoramaImage): void {
    if (this._currentImage !== image) {
      const currentImage = this._currentImage;
      this._currentImage = image;
      currentImage?.destroy();
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

  override toJSON(): PanoramaMapOptions {
    const config = super.toJSON() as Partial<PanoramaMapOptions>;
    const defaultOptions = PanoramaMap.getDefaultOptions();

    if (this._overlayNaNColor !== defaultOptions.overlayNaNColor) {
      config.overlayNaNColor = this._overlayNaNColor;
    }

    if (this._cursorColor !== defaultOptions.cursorColor) {
      config.cursorColor = this._cursorColor;
    }

    if (this.fallbackToCurrentMap !== defaultOptions.fallbackToCurrentMap) {
      config.fallbackToCurrentMap = this.fallbackToCurrentMap;
    } else {
      delete config.fallbackToCurrentMap;
    }

    return config;
  }

  override destroy(): void {
    this.currentImageChanged.destroy();
    this._currentImage?.destroy();
    this._cameraController?.destroy();
    this._imageView?.destroy();
    this._screenSpaceListener?.();
    this._screenSpaceEventHandler?.destroy();
    this._cesiumWidget?.destroy();
    this._cesiumWidget = undefined;
    this._listeners.forEach((cb) => {
      cb();
    });

    super.destroy();
  }
}

mapClassRegistry.registerClass(PanoramaMap.className, PanoramaMap);
