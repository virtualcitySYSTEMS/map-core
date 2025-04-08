import {
  type Cesium3DTileset,
  CesiumWidget,
  JulianDate,
  PrimitiveCollection,
  type Scene,
  ScreenSpaceEventHandler,
  ShadowMode,
  Math as CesiumMath,
} from '@vcmap-cesium/engine';
import VcsMap, { VcsMapOptions } from './vcsMap.js';
import { PanoramaImage } from '../panorama/panoramaImage.js';
import { mapClassRegistry } from '../classRegistry.js';
import {
  createPanoramaImageView,
  PanoramaImageView,
} from '../panorama/panoramaImageView.js';
import {
  getViewpointFromScene,
  setupCesiumInteractions,
} from './cesiumMapHelpers.js';
import VcsEvent from '../vcsEvent.js';
import { createPanoramaNavigation } from '../panorama/panoramaNavigation.js';
import {
  createDebugSphere,
  DebugSphere,
  DebugCameraSphereOptions,
} from '../panorama/debugSphere.js';
import Viewpoint from '../util/viewpoint.js';
import { ensureInCollection } from './cesiumMap.js';
import PanoramaDatasetCollection from '../panorama/panoramaDatasetCollection.js';
import Projection from '../util/projection.js';

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

  private _cesiumWidget: CesiumWidget | undefined;

  private _imageView: PanoramaImageView | undefined;

  private _currentImage: PanoramaImage | undefined;

  private _screenSpaceListener: (() => void) | undefined;

  private _screenSpaceEventHandler: ScreenSpaceEventHandler | undefined;

  private _destroyNavigation: (() => void) | undefined;

  private _debugSphere: DebugSphere | undefined;

  readonly currentImageChanged = new VcsEvent<PanoramaImage | undefined>();

  private _panoramaDatasets = new PanoramaDatasetCollection();

  private _destroyCollection = true;

  private _listeners: (() => void)[] = [];

  get screenSpaceEventHandler(): ScreenSpaceEventHandler {
    if (!this._screenSpaceEventHandler) {
      throw new Error('ScreenSpaceEventHandler not initialized');
    }
    return this._screenSpaceEventHandler;
  }

  get currentPanoramaImage(): PanoramaImage | undefined {
    return this._currentImage;
  }

  get panoramaView(): PanoramaImageView {
    if (!this._imageView) {
      throw new Error('PanoramaImageView not initialized');
    }
    return this._imageView;
  }

  get debugSphere(): DebugSphere | undefined {
    return this._debugSphere;
  }

  setDebugSphere(debugSphere?: DebugCameraSphereOptions): void {
    if (this._debugSphere) {
      this._debugSphere.destroy();
    }

    if (debugSphere) {
      this._debugSphere = createDebugSphere(this, debugSphere);
    }
  }

  get panoramaDatasets(): PanoramaDatasetCollection {
    return this._panoramaDatasets;
  }

  set panoramaDatasets(collection: PanoramaDatasetCollection) {
    if (this._destroyCollection) {
      this._panoramaDatasets.destroy();
    }
    this._panoramaDatasets = collection;
    this._destroyCollection = false;
  }

  async initialize(): Promise<void> {
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
        this.screenSpaceEventHandler,
      );
      this._imageView = createPanoramaImageView(this);
      this._destroyNavigation = createPanoramaNavigation(this);
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

  async activate(): Promise<void> {
    await super.activate();
    if (this.active && this._cesiumWidget) {
      this._cesiumWidget.useDefaultRenderLoop = true;
      this._cesiumWidget.resize();
    }
  }

  deactivate(): void {
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

    const closestImage = await this.panoramaDatasets.getClosestImage(
      Projection.wgs84ToMercator(position),
    );

    if (closestImage) {
      if (viewpoint.heading != null) {
        this._cesiumWidget.camera.setView({
          orientation: {
            heading: CesiumMath.toRadians(viewpoint.heading),
          },
        });
      }

      this.setCurrentImage(closestImage);
    }
  }

  setCurrentImage(image?: PanoramaImage): void {
    this._currentImage = image;
    this.currentImageChanged.raiseEvent(image);
  }

  getCesiumWidget(): CesiumWidget {
    if (!this._cesiumWidget) {
      throw new Error('CesiumWidget not initialized');
    }
    return this._cesiumWidget;
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
    this._destroyNavigation?.();
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
