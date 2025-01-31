import {
  Cartesian2,
  CesiumWidget,
  Math as CesiumMath,
  PerspectiveFrustum,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from '@vcmap-cesium/engine';
import { PanoramaImageView } from './panoramaImageView.js';
import { DebugCameraSphere } from './debugCameraSphere.js';
import VcsEvent from '../vcsEvent.js';
import { windowPositionToImageSpherical } from './panoramaCameraHelpers.js';

type PointerInput = {
  position: Cartesian2;
  leftDown: boolean;
};

export type PanoramaNavigationControls = {
  readonly fovChanged: VcsEvent<number>;
  debugCamera?: DebugCameraSphere;
  destroy(): void;
};

const maxPitch = 85 / CesiumMath.DEGREES_PER_RADIAN;
const minPitch = -maxPitch;
const maxFov = CesiumMath.toRadians(120);
const minFov = CesiumMath.toRadians(10);
const fovStep = 0.1;

// TODO move to navication controls & setup drag listener instead of "POV" look
export function setupPanoramaNavigation(
  widget: CesiumWidget,
  view: PanoramaImageView,
): PanoramaNavigationControls {
  const { image } = view;
  const { camera, canvas } = widget;
  const frustum = camera.frustum as PerspectiveFrustum;
  let debugCamera: DebugCameraSphere | undefined;

  const pointerInput: {
    startPosition: Cartesian2;
    position: Cartesian2;
    leftDown: boolean;
  } = {
    startPosition: new Cartesian2(),
    position: new Cartesian2(),
    leftDown: false,
  };

  const pointerEventHandler = new ScreenSpaceEventHandler(canvas);

  const leftDownHandler = (event: { position: Cartesian2 }): void => {
    pointerInput.leftDown = true;
    const imageSpherical = windowPositionToImageSpherical(
      event.position,
      camera,
      image,
    );
    if (debugCamera) {
      debugCamera.setClickedPosition(imageSpherical);
    }
    // set the spherical position of the pointer on the sphere here.
    pointerInput.startPosition = event.position;
    pointerInput.position = event.position.clone();
  };

  const leftUpHandler = (): void => {
    pointerInput.leftDown = false;
  };

  const mouseMoveHandler = (event: { endPosition: Cartesian2 }): void => {
    if (pointerInput.leftDown) {
      pointerInput.position = event.endPosition;
      // calculate the distance between the start and end position _on the sphere_ rotate by the given amount along the spheres axis.
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

  const fovChanged = new VcsEvent<number>();
  pointerEventHandler.setInputAction((event: number): void => {
    if (event > 0 && frustum.fov > minFov) {
      frustum.fov -= fovStep;
    } else if (event < 0 && frustum.fov < maxFov) {
      frustum.fov += fovStep;
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

      // Distance of current pointer position to the initial/start position on leftDown as share of clientWidth
      const xShare = (position.x - startPosition.x) / clientWidth;
      // Distance of current pointer position to the initial/start position on leftDown as share of clientHeight
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

  return {
    get fovChanged(): VcsEvent<number> {
      return fovChanged;
    },
    get debugCamera(): DebugCameraSphere | undefined {
      return debugCamera;
    },
    set debugCamera(value: DebugCameraSphere | undefined) {
      debugCamera = value;
    },
    destroy(): void {
      pointerEventHandler.destroy();
      document.body.removeEventListener('keydown', altHandler);
      fovChanged.destroy();
      clockListener();
    },
  };
}
