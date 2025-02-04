import {
  CesiumWidget,
  ScreenSpaceEventHandler,
  ShadowMode,
} from '@vcmap-cesium/engine';
import VcsMap, { VcsMapOptions } from './vcsMap.js';
import {
  createPanoramaImage,
  PanoramaImage,
} from '../panorama/panoramaImage.js';
import { mapClassRegistry } from '../classRegistry.js';
import { createDebugCameraSphere } from '../panorama/debugCameraSphere.js';
import {
  createPanoramaImageView,
  PanoramaImageView,
} from '../panorama/panoramaImageView.js';
import { setupPanoramaNavigation } from '../panorama/panoramaNavigation.js';
import { setupCesiumInteractions } from './cesiumMapEvent.js';

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

  private _currentImageView: PanoramaImageView | undefined;

  private _currentImage: PanoramaImage | undefined;

  private _screenSpaceListener: (() => void) | undefined;

  private _screenSpaceEventHandler: ScreenSpaceEventHandler | undefined;

  async initialize(): Promise<void> {
    if (!this.initialized) {
      this._cesiumWidget = new CesiumWidget(this.mapElement, {
        requestRenderMode: false,
        scene3DOnly: true,
        baseLayer: false,
        shadows: false,
        terrainShadows: ShadowMode.DISABLED,
      });

      this._cesiumWidget.scene.screenSpaceCameraController.enableInputs = false;
      this._cesiumWidget.scene.primitives.destroyPrimitives = false;
      this._cesiumWidget.scene.globe.enableLighting = false;
      this.initialized = true;

      const image = await createPanoramaImage({
        rootUrl: 'exampleData/panoramaImages',
        name: 'pano_000001_000011',
        position: {
          x: 52.477762,
          y: 9.7283938,
          z: 56.12,
        },
        orientation: {
          heading: 0,
          pitch: 0,
          roll: 0,
        },
      });
      this._currentImageView = createPanoramaImageView(
        this._cesiumWidget.scene,
        image,
      );
      this._currentImage = image;
      this._screenSpaceEventHandler = new ScreenSpaceEventHandler(
        this._cesiumWidget.canvas,
      );

      this._screenSpaceListener = setupCesiumInteractions(
        this,
        this.screenSpaceEventHandler,
      );

      const nav = setupPanoramaNavigation(
        this,
        this._cesiumWidget,
        this._currentImageView,
      );

      nav.debugCamera = createDebugCameraSphere(
        this._cesiumWidget.scene,
        image,
      );
    }
    await super.initialize();
  }

  get screenSpaceEventHandler(): ScreenSpaceEventHandler {
    if (!this._screenSpaceEventHandler) {
      throw new Error('ScreenSpaceEventHandler not initialized');
    }
    return this._screenSpaceEventHandler;
  }

  async activate(): Promise<void> {
    await super.activate();
    if (this.active && this._cesiumWidget) {
      this._cesiumWidget.useDefaultRenderLoop = true;
      this._cesiumWidget.resize();
    }
  }

  getCesiumWidget(): CesiumWidget | undefined {
    return this._cesiumWidget;
  }

  deactivate(): void {
    super.deactivate();
    if (this._cesiumWidget) {
      this._cesiumWidget.useDefaultRenderLoop = false;
    }
  }

  destroy(): void {
    this._currentImage?.destroy();
    this._currentImageView?.destroy();
    this._screenSpaceListener?.();
    this._screenSpaceEventHandler?.destroy();
    this._cesiumWidget?.destroy();
    super.destroy();
  }
}

mapClassRegistry.registerClass(PanoramaMap.className, PanoramaMap);
