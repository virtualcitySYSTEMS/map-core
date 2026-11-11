import { parseNumber } from '@vcsuite/parsers';
import {
  Color,
  CesiumWidget,
  ShadowMode,
  Math as CesiumMath,
  type Cesium3DTileset,
} from '@vcmap-cesium/engine';
import type { Coordinate } from 'ol/coordinate.js';
import {
  type PanoramaImage,
  usesPointCloudDepth,
} from '../panorama/panoramaImage.js';
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
import type { BaseCesiumMapOptions } from './baseCesiumMap.js';
import BaseCesiumMap from './baseCesiumMap.js';
import type TilesetDepthPass from '../cursor/TilesetDepthPass.js';
import { isPanoramaCamera } from '../panorama/panoramaSymbols.js';

export type PanoramaMapOptions = BaseCesiumMapOptions & {
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
      ...BaseCesiumMap.getDefaultOptions(),
      overlayNaNColor: 'rgba(255, 0, 0, 1)',
      cursorColor: defaultCursorColor,
      fallbackToCurrentMap: false,
      layerTypes: [
        'PanoramaDatasetLayer',
        'VectorLayer',
        'PointCloudLayer',
        'TerrainLayer',
      ],
      defaultFov: 90,
    };
  }

  /**
   * The event raised when the current image changes. Can be raised with undefined if the current image is cleared
   * or a viewpoint fails to load an image.
   */
  readonly currentImageChanged = new VcsEvent<PanoramaImage | undefined>();

  /**
   * Raised with the new value, whenever {@link hasDepthInformation} changes.
   */
  readonly depthInformationChanged = new VcsEvent<boolean>();

  private _hasDepthInformation = false;

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
   * Whether depth is available for the current image, from its depth image (version 1) or from point clouds (version 2).
   */
  get hasDepthInformation(): boolean {
    return this._hasDepthInformation;
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

      cesiumWidget.camera[isPanoramaCamera] = true;

      cesiumWidget.scene.screenSpaceCameraController.enableInputs = false;
      cesiumWidget.scene.screenSpaceCameraController.enableCollisionDetection =
        false;

      cesiumWidget.scene.primitives.destroyPrimitives = false;

      cesiumWidget.scene.highDynamicRange = true;
      cesiumWidget.scene.gamma = 2.2;

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
      this._setupCursor();
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

  override addToDepthPass(tileset: Cesium3DTileset): () => void {
    const remove = super.addToDepthPass(tileset);
    this._updateDepthInformation();
    return (): void => {
      remove();
      this._updateDepthInformation();
    };
  }

  private _updateDepthInformation(): void {
    const image = this.currentPanoramaImage;
    const hasDepthInformation =
      !!image &&
      (usesPointCloudDepth(image) ? !!this.depthPass : image.hasDepth);
    if (hasDepthInformation !== this._hasDepthInformation) {
      this._hasDepthInformation = hasDepthInformation;
      this.depthInformationChanged.raiseEvent(hasDepthInformation);
    }
  }

  /**
   * The depth cursor is enabled together with the depth pass, see _setupDepthPass. It shares its color with the cursor of
   * the depth image, so hiding the cursor (alpha 0) or changing its color applies to both.
   */
  private _setupCursor(): void {
    const cursor = this._initializeCursor();
    const { tilePrimitiveCollection } = this._imageView!;
    cursor.color = tilePrimitiveCollection.cursorColor;
    cursor.enabled = this.depthPass?.enabled ?? false;
    this._listeners.push(
      tilePrimitiveCollection.cursorColorChanged.addEventListener((color) => {
        cursor.color = color;
      }),
    );
  }

  /**
   * Enables the depth pass and its cursor only for images using point cloud depth, see {@link usesPointCloudDepth}.
   * Without a depth pass, the cursor stays disabled, since there is no depth to show.
   * Gives the panorama image tiles priority over the depth pass tiles by suspending depth pass
   * tile loading for as long as the current images tile provider is loading. Without this, both
   * request their tiles in parallel and compete for the same connections.
   */
  protected override _setupDepthPass(depthPass: TilesetDepthPass): () => void {
    let release: (() => void) | undefined;
    const setLoading = (loading: boolean): void => {
      if (loading) {
        release ??= depthPass.suspend();
      } else {
        release?.();
        release = undefined;
      }
    };

    let removeLoadingListener: (() => void) | undefined;
    const trackImage = (image?: PanoramaImage): void => {
      const enabled = !!image && usesPointCloudDepth(image);
      depthPass.enabled = enabled;
      if (this.cursor) {
        this.cursor.enabled = enabled;
      }
      removeLoadingListener?.();
      setLoading(image?.tileProvider.loading ?? false);
      removeLoadingListener =
        image?.tileProvider.loadingStateChanged.addEventListener(setLoading);
    };

    trackImage(this.currentPanoramaImage);
    const removeImageListener =
      this.currentImageChanged.addEventListener(trackImage);

    return (): void => {
      removeImageListener();
      removeLoadingListener?.();
      setLoading(false);
      if (this.cursor) {
        this.cursor.enabled = false;
      }
    };
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
      this._updateDepthInformation();
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
    this.depthInformationChanged.destroy();
    this._currentImage?.destroy();
    this._cameraController?.destroy();
    this._imageView?.destroy();

    super.destroy();
  }
}

mapClassRegistry.registerClass(PanoramaMap.className, PanoramaMap);
