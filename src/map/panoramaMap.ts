import { parseNumber } from '@vcsuite/parsers';
import {
  Color,
  CesiumWidget,
  ShadowMode,
  Math as CesiumMath,
} from '@vcmap-cesium/engine';
import type { Coordinate } from 'ol/coordinate.js';
import VcsMap, { type VcsMapOptions } from './vcsMap.js';
import type { PanoramaImage } from '../panorama/panoramaImage.js';
import { mapClassRegistry } from '../classRegistry.js';
import type { PanoramaImageView } from '../panorama/panoramaImageView.js';
import { createPanoramaImageView } from '../panorama/panoramaImageView.js';
import VcsEvent from '../vcsEvent.js';
import type { PanoramaCameraController } from '../panorama/panoramaCameraController.js';
import { createPanoramaCameraController } from '../panorama/panoramaCameraController.js';
import type Viewpoint from '../util/viewpoint.js';
import Projection from '../util/projection.js';
import { defaultCursorColor } from '../panorama/panoramaTileMaterial.js';
import LayerState from '../layer/layerState.js';
import type PanoramaDatasetLayer from '../layer/panoramaDatasetLayer.js';
import BaseCesiumMap from './baseCesiumMap.js';

export type PanoramaMapOptions = VcsMapOptions & {
  /**
   * Css color string to use for the overlay NaN color.
   */
  overlayNaNColor?: string;
  /**
   * Css color string to use for the cursor color.
   */
  cursorColor?: string;
  /**
   * The default field of view in degrees when loading a new image.
   */
  defaultFov?: number;
};

export default class PanoramaMap extends BaseCesiumMap {
  static get className(): string {
    return 'PanoramaMap';
  }

  static getDefaultOptions(): PanoramaMapOptions {
    return {
      ...VcsMap.getDefaultOptions(),
      overlayNaNColor: 'rgba(255, 0, 0, 1)',
      cursorColor: defaultCursorColor,
      fallbackToCurrentMap: false,
      layerTypes: ['PanoramaDatasetLayer', 'TerrainLayer', 'VectorLayer'],
      defaultFov: 90,
    };
  }

  /**
   * The event raised when the current image changes. Can be raised with undefined if the current image is cleared
   * or a viewpoint fails to load an image.
   */
  readonly currentImageChanged = new VcsEvent<PanoramaImage | undefined>();

  private _imageView: PanoramaImageView | undefined;

  private _currentImage: PanoramaImage | undefined;

  private _cameraController: PanoramaCameraController | undefined;

  protected _listeners: (() => void)[] = [];

  private _overlayNaNColor: string | undefined;

  private _cursorColor: string | undefined;

  private _defaultFov = 90;

  constructor(options: PanoramaMapOptions) {
    const defaultOptions = PanoramaMap.getDefaultOptions();
    super({ ...defaultOptions, ...options });

    this._overlayNaNColor =
      options.overlayNaNColor ?? defaultOptions.overlayNaNColor;
    this._cursorColor = options.cursorColor ?? defaultOptions.cursorColor;
    this._defaultFov = parseNumber(
      options.defaultFov,
      defaultOptions.defaultFov,
    );
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

  get defaultFov(): number {
    if (!this._imageView) {
      return this._defaultFov;
    }
    return CesiumMath.toDegrees(this._imageView.defaultFov);
  }

  /**
   * Sets the default field of view in degrees when loading a new image.
   */
  set defaultFov(fov: number) {
    this._defaultFov = fov;
    if (this._imageView) {
      this._imageView.defaultFov = CesiumMath.toRadians(fov);
    }
  }

  /**
   * Access to the raw cesium widget for finer control. Throws if not properly initialized.
   */
  override getCesiumWidget(): CesiumWidget {
    if (!this._cesiumWidget) {
      throw new Error('CesiumWidget not initialized');
    }
    return this._cesiumWidget;
  }

  override async initialize(): Promise<void> {
    if (!this.initialized) {
      const cesiumWidget = new CesiumWidget(this.mapElement, {
        requestRenderMode: false,
        scene3DOnly: true,
        baseLayer: false,
        shadows: false,
        skyBox: false,
        skyAtmosphere: false,
        terrainShadows: ShadowMode.DISABLED,
        msaaSamples: 1,
      });

      cesiumWidget.scene.globe.depthTestAgainstTerrain = true;
      cesiumWidget.scene.globe.baseColor = Color.WHITE.withAlpha(0.01);
      const defaultTranslucency = cesiumWidget.scene.globe.translucency;
      defaultTranslucency.enabled = true;
      defaultTranslucency.backFaceAlpha = 0.75;
      defaultTranslucency.frontFaceAlpha = 0.75;
      cesiumWidget.scene.screenSpaceCameraController.enableInputs = false;
      cesiumWidget.scene.screenSpaceCameraController.enableCollisionDetection =
        false;
      cesiumWidget.scene.primitives.destroyPrimitives = false;
      this.initialized = true;
      this._initializeCesiumWidget(cesiumWidget);

      this._imageView = createPanoramaImageView(
        this,
        CesiumMath.toRadians(this._defaultFov),
      );

      if (this._overlayNaNColor) {
        this._imageView.tilePrimitiveCollection.overlayNaNColor =
          Color.fromCssColorString(this._overlayNaNColor);
      }

      if (this._cursorColor) {
        this._imageView.tilePrimitiveCollection.cursorColor =
          Color.fromCssColorString(this._cursorColor);
      }

      this._cameraController = createPanoramaCameraController(this);
    }
    await super.initialize();
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

  override getViewpointSync(): Viewpoint | null {
    const vp = super.getViewpointSync();
    if (vp) {
      vp.groundPosition = null;
      vp.distance = 100;
    }
    return vp;
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
      const { imageName, dataset, time } = images[closestIndex]!;
      return dataset.createPanoramaImage(imageName, time);
    }

    return undefined;
  }

  /**
   * Sets the current image to the given panorama image. If the image is undefined, the current image is cleared.
   * @param image
   */
  setCurrentImage(image?: PanoramaImage): void {
    if (!this._currentImage?.equals(image)) {
      const currentImage = this._currentImage;
      this._currentImage = image;
      currentImage?.destroy();
      this.currentImageChanged.raiseEvent(image);
    }
  }

  override toJSON(
    defaultOptions = PanoramaMap.getDefaultOptions(),
  ): PanoramaMapOptions {
    const config = super.toJSON(defaultOptions) as Partial<PanoramaMapOptions>;

    if (this._overlayNaNColor !== defaultOptions.overlayNaNColor) {
      config.overlayNaNColor = this._overlayNaNColor;
    }

    if (this._cursorColor !== defaultOptions.cursorColor) {
      config.cursorColor = this._cursorColor;
    }

    const defaultFov = this._imageView
      ? CesiumMath.toDegrees(this._imageView.defaultFov)
      : this._defaultFov;
    if (defaultFov !== defaultOptions.defaultFov) {
      config.defaultFov = defaultFov;
    }

    return config;
  }

  override destroy(): void {
    this.currentImageChanged.destroy();
    this._currentImage?.destroy();
    this._cameraController?.destroy();
    this._imageView?.destroy();

    super.destroy();
  }
}

mapClassRegistry.registerClass(PanoramaMap.className, PanoramaMap);
