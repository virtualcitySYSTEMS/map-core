import {
  Cartesian2,
  Math as CesiumMath,
  PerspectiveFrustum,
  ScreenSpaceEventType,
} from '@vcmap-cesium/engine';
import { windowPositionToImageSpherical } from './panoramaCameraHelpers.js';
import PanoramaMap from '../map/panoramaMap.js';
import {
  PointerEventType,
  PointerKeyType,
} from '../interaction/interactionType.js';
import { PanoramaImage } from './panoramaImage.js';
import VcsEvent from '../vcsEvent.js';

export type PanoramaNavigationControls = {
  readonly fovChanged: VcsEvent<void>;
  destroy(): void;
};

const MAX_PITCH = CesiumMath.toRadians(85);
const MIN_PITCH = -MAX_PITCH;
const MAX_FOV = CesiumMath.toRadians(120);
const MIN_FOV = CesiumMath.toRadians(10);
const FOV_STEP = 0.1;
const INERTIA_DECAY = 0.8;
const DECAY_FRAMES = 60;

export function setupPanoramaNavigation(
  map: PanoramaMap,
  image: PanoramaImage,
): PanoramaNavigationControls {
  const widget = map.getCesiumWidget();
  const { camera } = widget;
  const frustum = camera.frustum as PerspectiveFrustum;
  const fovChanged = new VcsEvent<void>();

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

  map.screenSpaceEventHandler.setInputAction((event: number): void => {
    if (event > 0 && frustum.fov > MIN_FOV) {
      frustum.fov -= FOV_STEP;
      fovChanged.raiseEvent(); // IDEA since this only changes the FOV, maybe we can optimize this?
    } else if (event < 0 && frustum.fov < MAX_FOV) {
      frustum.fov += FOV_STEP;
      fovChanged.raiseEvent(); // IDEA since this only changes the FOV, maybe we can optimize this?
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

  // IDEA maybe not attach to the clock to avoid blocking by renderer.
  const clockListener = widget.clock.onTick.addEventListener(() => {
    if (!widget.scene.screenSpaceCameraController.enableInputs) {
      if (pointerInput.leftDown) {
        const { position, startPosition } = pointerInput;
        const startImagePosition = windowPositionToImageSpherical(
          startPosition,
          camera,
          image,
        );
        const newImagePosition = windowPositionToImageSpherical(
          position,
          camera,
          image,
        );

        if (startImagePosition && newImagePosition) {
          let diffX = startImagePosition[0] - newImagePosition[0];
          if (diffX > CesiumMath.PI) {
            diffX -= CesiumMath.TWO_PI;
          } else if (diffX < -CesiumMath.PI) {
            diffX += CesiumMath.TWO_PI;
          }
          const diffY = startImagePosition[1] - newImagePosition[1];
          widget.camera.look(image.up, diffX);
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
        widget.camera.look(image.up, xInertia);
        yInertia *= INERTIA_DECAY;
        widget.camera.look(camera.right, yInertia);

        ensurePitch();
      }
    }
  });

  return {
    fovChanged,
    destroy(): void {
      clockListener();
      fovChanged.destroy();
    },
  };
}
