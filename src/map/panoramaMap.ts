import {
  CesiumWidget,
  ScreenSpaceEventHandler,
  ShadowMode,
} from '@vcmap-cesium/engine';
import VcsMap, { VcsMapOptions } from './vcsMap.js';
import {
  createPanoramaImageFromURL,
  PanoramaImage,
} from '../panorama/panoramaImage.js';
import { mapClassRegistry } from '../classRegistry.js';
import {
  createPanoramaImageView,
  PanoramaImageView,
} from '../panorama/panoramaImageView.js';
import { setupCesiumInteractions } from './cesiumMapEvent.js';
import VcsEvent from '../vcsEvent.js';
import { createPanoramaNavigation } from '../panorama/panoramaNavigation.js';

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

  readonly currentImageChanged = new VcsEvent<PanoramaImage | undefined>();

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

      const image = await createPanoramaImageFromURL(
        'exampleData/panoramaImages/pano_000001_000011_rgb.tif',
      );
      this._setCurrentImage(image);
    }
    await super.initialize();
  }

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

  async activate(): Promise<void> {
    await super.activate();
    if (this.active && this._cesiumWidget) {
      this._cesiumWidget.useDefaultRenderLoop = true;
      this._cesiumWidget.resize();
    }
  }

  private _setCurrentImage(image?: PanoramaImage): void {
    this._currentImage = image;
    this.currentImageChanged.raiseEvent(image);
  }

  getCesiumWidget(): CesiumWidget {
    if (!this._cesiumWidget) {
      throw new Error('CesiumWidget not initialized');
    }
    return this._cesiumWidget;
  }

  deactivate(): void {
    super.deactivate();
    if (this._cesiumWidget) {
      this._cesiumWidget.useDefaultRenderLoop = false;
    }
  }

  destroy(): void {
    this.currentImageChanged.destroy();
    this._currentImage?.destroy();
    this._destroyNavigation?.();
    this._imageView?.destroy();
    this._screenSpaceListener?.();
    this._screenSpaceEventHandler?.destroy();
    this._cesiumWidget?.destroy();
    super.destroy();
  }
}

mapClassRegistry.registerClass(PanoramaMap.className, PanoramaMap);
