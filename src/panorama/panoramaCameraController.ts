import type { PerspectiveFrustum } from '@vcmap-cesium/engine';
import {
  Cartesian2,
  Math as CesiumMath,
  ScreenSpaceEventType,
} from '@vcmap-cesium/engine';
import { windowPositionToImageSpherical } from './fieldOfView.js';
import type PanoramaMap from '../map/panoramaMap.js';
import {
  PointerEventType,
  PointerKeyType,
} from '../interaction/interactionType.js';

/**
 * maximum pitch allowed for the camera in radians
 */
export const MAX_PITCH = CesiumMath.toRadians(85);

/**
 * minimum pitch allowed for the camera in radians
 */
export const MIN_PITCH = -MAX_PITCH;

/**
 * maximum field of view allowed for the camera in radians
 */
export const MAX_FOV = CesiumMath.toRadians(120);

/**
 * minimum field of view allowed for the camera in radians
 */
export const MIN_FOV = CesiumMath.toRadians(10);

/**
 * decay factor for the inertia delay
 */
const INERTIA_DECAY = 0.8;

/**
 * number of frames to decay the inertia
 */
const DECAY_FRAMES = 60;

/**
 * The panorama camera controller allows to control the camera of a panorama map
 * by dragging the mouse and zooming in and out with the mouse wheel.
 */
export type PanoramaCameraController = {
  /**
   * Zooms in, until MIN_FOV of 10 degrees is reached
   * @param [step=0.1] - optional step in radians
   */
  zoomIn: (step?: number) => void;
  /**
   * Zooms out, until MAX_FOV of 120 degrees is reached
   * @param [step=0.1] - optional step in radians
   */
  zoomOut: (step?: number) => void;
  destroy: () => void;
};

export function createPanoramaCameraController(
  map: PanoramaMap,
): PanoramaCameraController {
  const widget = map.getCesiumWidget();
  const { camera } = widget;
  const frustum = camera.frustum as PerspectiveFrustum;

  const pointerInput: {
    startPosition: Cartesian2;
    position: Cartesian2;
    leftDown: boolean;
  } = {
    startPosition: new Cartesian2(),
    position: new Cartesian2(),
    leftDown: false,
  };

  map.pointerInteractionEvent.addEventListener((event) => {
    if (event.pointer === PointerKeyType.LEFT) {
      if (event.pointerEvent === PointerEventType.DOWN) {
        pointerInput.leftDown = true;
        // set the spherical position of the pointer on the sphere here.
        pointerInput.position = event.windowPosition.clone(
          pointerInput.position,
        );
        pointerInput.startPosition = event.windowPosition.clone(
          pointerInput.startPosition,
        );
      } else {
        pointerInput.leftDown = false;
      }
    } else if (
      event.pointerEvent === PointerEventType.MOVE &&
      pointerInput.leftDown
    ) {
      pointerInput.position = event.windowPosition.clone(pointerInput.position);
    }
  });

  function panoZoom(event: number, step = 0.1): void {
    if (event > 0 && frustum.fov > MIN_FOV) {
      frustum.fov -= step;
      if (frustum.fov < MIN_FOV) {
        frustum.fov = MIN_FOV;
      }
      map.panoramaView.render();
    } else if (event < 0 && frustum.fov < MAX_FOV) {
      frustum.fov += step;
      if (frustum.fov > MAX_FOV) {
        frustum.fov = MAX_FOV;
      }
      map.panoramaView.render();
    }
  }

  map.screenSpaceEventHandler.setInputAction((event: number): void => {
    if (!map.movementPointerEventsDisabled) {
      panoZoom(event);
    }
  }, ScreenSpaceEventType.WHEEL);

  let yInertia = 0;
  let xInertia = 0;
  let decay = 0;

  function ensurePitch(): void {
    if (camera.pitch > MAX_PITCH) {
      camera.look(camera.right, camera.pitch - MAX_PITCH);
    } else if (camera.pitch < MIN_PITCH) {
      camera.look(camera.right, camera.pitch - MIN_PITCH);
    }
  }

  let currentImage = map.currentPanoramaImage;
  const imageListener = map.currentImageChanged.addEventListener((image) => {
    currentImage = image;
  });
  let animationFrameHandle: number;
  const loop = (): void => {
    if (
      currentImage &&
      !widget.scene.screenSpaceCameraController.enableInputs &&
      !map.movementPointerEventsDisabled
    ) {
      if (pointerInput.leftDown) {
        const { position, startPosition } = pointerInput;
        const startImagePosition = windowPositionToImageSpherical(
          startPosition,
          camera,
          currentImage.invModelMatrix,
        );
        const newImagePosition = windowPositionToImageSpherical(
          position,
          camera,
          currentImage.invModelMatrix,
        );

        if (startImagePosition && newImagePosition) {
          let diffX = startImagePosition[0] - newImagePosition[0];
          if (diffX > CesiumMath.PI) {
            diffX -= CesiumMath.TWO_PI;
          } else if (diffX < -CesiumMath.PI) {
            diffX += CesiumMath.TWO_PI;
          }
          const diffY = startImagePosition[1] - newImagePosition[1];
          widget.camera.look(currentImage.up, diffX);
          widget.camera.look(camera.right, diffY);

          yInertia = diffY;
          xInertia = diffX;
          decay = 0;
          ensurePitch();
          pointerInput.startPosition = position.clone(startPosition);
        }
      } else if (decay < DECAY_FRAMES) {
        decay += 1;
        xInertia *= INERTIA_DECAY;
        widget.camera.look(currentImage.up, xInertia);
        yInertia *= INERTIA_DECAY;
        widget.camera.look(camera.right, yInertia);

        ensurePitch();
      }
    }
    animationFrameHandle = requestAnimationFrame(loop);
  };
  loop();

  return {
    zoomIn(step = 0.1): void {
      if (!map.movementApiCallsDisabled) {
        panoZoom(1, step);
      }
    },
    zoomOut(step = 0.1): void {
      if (!map.movementApiCallsDisabled) {
        panoZoom(-1, step);
      }
    },
    destroy(): void {
      cancelAnimationFrame(animationFrameHandle);
      imageListener();
    },
  };
}
