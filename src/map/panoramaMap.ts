import {
  Cartesian2,
  CesiumWidget,
  Math as CesiumMath,
  PerspectiveFrustum,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  ShadowMode,
} from '@vcmap-cesium/engine';
import VcsMap, { VcsMapOptions } from './vcsMap.js';
import {
  createPanoramaImage,
  PanoramaImage,
} from '../panorama/panoramaImage.js';
import { mapClassRegistry } from '../classRegistry.js';
import {
  createDebugCameraSphere,
  DebugCameraSphere,
} from '../panorama/debugCameraSphere.js';
import {
  createPanoramaImageView,
  PanoramaImageView,
} from '../panorama/panoramaImageView.js';

export type PanoramaMapOptions = VcsMapOptions;

type PointerInput = {
  startPosition: Cartesian2;
  position: Cartesian2;
  leftDown: boolean;
};

const maxPitch = 85 / CesiumMath.DEGREES_PER_RADIAN;
const minPitch = -maxPitch;
const maxFov = CesiumMath.toRadians(120);
const minFov = CesiumMath.toRadians(10);
const fovStep = 0.1;

// TODO move to navication controls & setup drag listener instead of "POV" look
function setupNavigationControls(
  widget: CesiumWidget,
  view: PanoramaImageView,
  debugCamera?: DebugCameraSphere,
): () => void {
  const { image } = view;
  const pointerInput: PointerInput = {
    startPosition: new Cartesian2(),
    position: new Cartesian2(),
    leftDown: false,
  };

  const pointerEventHandler = new ScreenSpaceEventHandler(widget.canvas);

  const leftDownHandler = (event: { position: Cartesian2 }): void => {
    if (!widget.scene.screenSpaceCameraController.enableInputs) {
      pointerInput.leftDown = true;
      pointerInput.startPosition = Cartesian2.clone(event.position);
      pointerInput.position = pointerInput.startPosition;
    }
  };
  const leftUpHandler = (): void => {
    if (!widget.scene.screenSpaceCameraController.enableInputs) {
      pointerInput.leftDown = false;
    }
  };
  const mouseMoveHandler = (event: { endPosition: Cartesian2 }): void => {
    if (!widget.scene.screenSpaceCameraController.enableInputs) {
      pointerInput.position = event.endPosition;
    }
  };

  pointerEventHandler.setInputAction(
    leftDownHandler,
    ScreenSpaceEventType.LEFT_DOWN,
  );
  pointerEventHandler.setInputAction(
    leftUpHandler,
    ScreenSpaceEventType.LEFT_UP,
  );
  pointerEventHandler.setInputAction(
    mouseMoveHandler,
    ScreenSpaceEventType.MOUSE_MOVE,
  );

  const frustum = widget.camera.frustum as PerspectiveFrustum;
  pointerEventHandler.setInputAction((event: number): void => {
    if (!widget.scene.screenSpaceCameraController.enableInputs) {
      if (event > 0 && frustum.fov > minFov) {
        frustum.fov -= fovStep;
      } else if (event < 0 && frustum.fov < maxFov) {
        frustum.fov += fovStep;
      }
    }
  }, ScreenSpaceEventType.WHEEL);

  const altHandler = (event: KeyboardEvent): void => {
    if (event.altKey) {
      widget.scene.screenSpaceCameraController.enableInputs =
        !widget.scene.screenSpaceCameraController.enableInputs;

      if (!widget.scene.screenSpaceCameraController.enableInputs) {
        widget.scene.camera.setView({
          destination: image.position,
          orientation: {
            heading: 0,
            pitch: 0,
            roll: 0,
          },
        });
        if (debugCamera) {
          debugCamera.paused = false;
          view.suspendTileLoading = false;
        }
      } else if (debugCamera) {
        view.suspendTileLoading = true;
        debugCamera.paused = true;
      }
    }
  };
  document.body.addEventListener('keydown', altHandler);
  const shareToAngleFactor = 0.05;

  const clockListener = widget.clock.onTick.addEventListener(() => {
    if (pointerInput.leftDown) {
      const { clientWidth, clientHeight } = widget.canvas;
      const { position, startPosition } = pointerInput;

      /** Distance of current pointer position to the initial/start position on leftDown as share of clientWidth */
      const xShare = (position.x - startPosition.x) / clientWidth;
      /** Distance of current pointer position to the initial/start position on leftDown as share of clientHeight */
      const yShare = -(position.y - startPosition.y) / clientHeight;

      widget.camera.look(widget.camera.position, xShare * shareToAngleFactor);
      const yAmount = yShare * shareToAngleFactor;
      if (
        widget.camera.pitch + yAmount > minPitch &&
        widget.camera.pitch + yAmount < maxPitch
      ) {
        widget.camera.lookUp(yAmount);
      }
    }
  });

  return (): void => {
    pointerEventHandler.destroy();
    document.body.removeEventListener('keydown', altHandler);
    clockListener();
  };
}

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

  private _destroyImageSource: (() => void) | undefined;

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
      // const image = createPanoramaImage({
      //   rootUrl: '',
      //   name: 'pano_000001_000011',
      //   position: {
      //     x: 52.477762,
      //     y: 9.7283938,
      //     z: 56.12,
      //   },
      //   orientation: {
      //     heading: -165.52229,
      //     pitch: -0.92061,
      //     roll: -0.65027,
      //   },
      // });

      const image = createPanoramaImage(
        {
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
        },
        [512, 512],
      );

      this._currentImageView = createPanoramaImageView(
        this._cesiumWidget.scene,
        image,
        4,
      );

      // @ts-expect-error missing global
      window.vcs.view = this._currentImageView;

      // const debugCamera = createDebugCameraSphere(
      //   this._cesiumWidget.scene,
      //   image,
      // );

      setupNavigationControls(
        this._cesiumWidget,
        this._currentImageView,
        // debugCamera,
      );
      // this._destroyImageSource = createPanoramaImageSource(
      //   this._cesiumWidget.scene,
      //   4,
      //   Cartesian3.fromDegrees(0, 0, 1),
      // );
      /*
      this.setCurrentImage(
        new PanoramaImage({
          url: 'exampleData/Trimble_MX60_Hannover_Beispiel/pano_000001_000011.jpg',
        }),
      );
       */
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

  /*
  setCurrentImage(image: PanoramaImage): void {
    if (this._currentImage) {
      this._cesiumWidget?.scene.primitives.remove(
        this._currentImage.getPrimitive(),
      );
    }
    this._currentImage = image;
    this._cesiumWidget?.scene.primitives.add(image.getPrimitive());
    this._cesiumWidget?.scene.groundPrimitives.add(
      new GroundPrimitive({
        geometryInstances: new GeometryInstance({
          geometry: new PolygonGeometry({
            polygonHierarchy: new PolygonHierarchy(
              Cartesian3.fromDegreesArrayHeights([
                -10, -10, 0.5, 10, -10, 0.5, 10, 10, 0.5, -10, 10, 0.5,
              ]),
            ),
            vertexFormat: VertexFormat.POSITION_AND_COLOR,
          }),
        }),
        appearance: new MaterialAppearance({
          material: Material.fromType('Color', {
            color: Color.RED.withAlpha(1),
          }),
          translucent: true,
        }),
      }),
    );
  }
  */
  deactivate(): void {
    super.deactivate();
    if (this._cesiumWidget) {
      this._cesiumWidget.useDefaultRenderLoop = false;
    }
  }

  destroy(): void {
    this._destroyImageSource?.();
    this._currentImageView?.destroy();
    super.destroy();
  }
}
mapClassRegistry.registerClass(PanoramaMap.className, PanoramaMap);
