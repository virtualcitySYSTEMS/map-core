import {
  Camera,
  Cartesian3,
  Cartographic,
  Ellipsoid,
  KeyboardEventModifier,
  Math as CesiumMath,
  Ray,
  Scene,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from '@vcmap-cesium/engine';
import type PanoramaMap from './panoramaMap.js';
import {
  ModificationKeyType,
  PointerEventType,
  PointerKeyType,
} from '../interaction/interactionType.js';
import type CesiumMap from './cesiumMap.js';
import Viewpoint from '../util/viewpoint.js';

function raisePointerInteraction(
  map: PanoramaMap | CesiumMap,
  key: ModificationKeyType,
  pointer: number,
  pointerEvent: PointerEventType,
  csEvent:
    | ScreenSpaceEventHandler.PositionedEvent
    | ScreenSpaceEventHandler.MotionEvent,
  screenSpaceEventHandler: ScreenSpaceEventHandler,
): void {
  const multipleTouch =
    // eslint-disable-next-line no-underscore-dangle
    (screenSpaceEventHandler?._positions?.length ?? 0) > 1;
  const windowPosition = (csEvent as ScreenSpaceEventHandler.PositionedEvent)
    .position
    ? (csEvent as ScreenSpaceEventHandler.PositionedEvent).position
    : (csEvent as ScreenSpaceEventHandler.MotionEvent).endPosition;

  map.pointerInteractionEvent.raiseEvent({
    map,
    windowPosition,
    key,
    pointer,
    multipleTouch,
    pointerEvent,
  });
}

// eslint-disable-next-line import/prefer-default-export
export function setupCesiumInteractions(
  map: CesiumMap | PanoramaMap,
  screenSpaceEventHandler: ScreenSpaceEventHandler,
): () => void {
  const widget = map.getCesiumWidget();
  if (!widget) {
    throw new Error('Cannot setup interactions on uninitailized map');
  }
  const mods = [
    {
      csModifier: KeyboardEventModifier.ALT,
      vcsModifier: ModificationKeyType.ALT,
    },
    {
      csModifier: KeyboardEventModifier.CTRL,
      vcsModifier: ModificationKeyType.CTRL,
    },
    {
      csModifier: KeyboardEventModifier.SHIFT,
      vcsModifier: ModificationKeyType.SHIFT,
    },
    { csModifier: undefined, vcsModifier: ModificationKeyType.NONE },
  ];

  const types = [
    {
      type: ScreenSpaceEventType.LEFT_DOWN,
      pointerEvent: PointerEventType.DOWN,
      pointer: PointerKeyType.LEFT,
    },
    {
      type: ScreenSpaceEventType.LEFT_UP,
      pointerEvent: PointerEventType.UP,
      pointer: PointerKeyType.LEFT,
    },
    {
      type: ScreenSpaceEventType.RIGHT_DOWN,
      pointerEvent: PointerEventType.DOWN,
      pointer: PointerKeyType.RIGHT,
    },
    {
      type: ScreenSpaceEventType.RIGHT_UP,
      pointerEvent: PointerEventType.UP,
      pointer: PointerKeyType.RIGHT,
    },
    {
      type: ScreenSpaceEventType.MIDDLE_DOWN,
      pointerEvent: PointerEventType.DOWN,
      pointer: PointerKeyType.MIDDLE,
    },
    {
      type: ScreenSpaceEventType.MIDDLE_UP,
      pointerEvent: PointerEventType.UP,
      pointer: PointerKeyType.MIDDLE,
    },
    {
      type: ScreenSpaceEventType.MOUSE_MOVE,
      pointerEvent: PointerEventType.MOVE,
      pointer: PointerKeyType.ALL,
    },
  ];
  let lastEventFrameNumber = 0;
  const screenSpaceListeners = types
    .map(({ pointerEvent, pointer, type }) => {
      return mods.map(({ csModifier, vcsModifier }) => {
        const handler:
          | ScreenSpaceEventHandler.PositionedEventCallback
          | ScreenSpaceEventHandler.MotionEventCallback =
          type === ScreenSpaceEventType.MOUSE_MOVE
            ? (csEvent: ScreenSpaceEventHandler.MotionEvent): void => {
                if (
                  widget.scene.frameState.frameNumber !== lastEventFrameNumber
                ) {
                  lastEventFrameNumber = widget.scene.frameState.frameNumber;
                  raisePointerInteraction(
                    map,
                    vcsModifier,
                    pointer,
                    pointerEvent,
                    csEvent,
                    screenSpaceEventHandler,
                  );
                }
              }
            : (csEvent: ScreenSpaceEventHandler.PositionedEvent): void => {
                raisePointerInteraction(
                  map,
                  vcsModifier,
                  pointer,
                  pointerEvent,
                  csEvent,
                  screenSpaceEventHandler,
                );
              };

        screenSpaceEventHandler.setInputAction?.(handler, type, csModifier);
        return () => {
          screenSpaceEventHandler.removeInputAction?.(type, csModifier);
        };
      });
    })
    .flat();

  return (): void => {
    screenSpaceListeners.forEach((removeListener) => removeListener());
  };
}

export function getViewpointFromScene(scene: Scene): Viewpoint {
  const cam = scene.camera;
  const cameraPositionCartesian = cam.position;
  let groundPosition;
  let distance;

  const groundPositionCartesian = scene.globe?.pick(
    new Ray(cam.position, cam.direction),
    scene,
  );

  if (groundPositionCartesian) {
    distance = Cartesian3.distance(
      groundPositionCartesian,
      cameraPositionCartesian,
    );
    const groundPositionCartographic = Ellipsoid.WGS84.cartesianToCartographic(
      groundPositionCartesian,
    );
    groundPosition = [
      CesiumMath.toDegrees(groundPositionCartographic.longitude),
      CesiumMath.toDegrees(groundPositionCartographic.latitude),
      groundPositionCartographic.height,
    ];
  }

  const cameraPositionCartographic = cam.positionCartographic;
  const cameraPosition = [
    CesiumMath.toDegrees(cameraPositionCartographic.longitude),
    CesiumMath.toDegrees(cameraPositionCartographic.latitude),
    cameraPositionCartographic.height,
  ];

  return new Viewpoint({
    groundPosition,
    cameraPosition,
    distance,
    heading: CesiumMath.toDegrees(cam.heading),
    pitch: CesiumMath.toDegrees(cam.pitch),
    roll: CesiumMath.toDegrees(cam.roll),
  });
}

export function getResolution(
  cartesian: Cartesian3,
  camera: Camera,
  mapElement: HTMLElement,
  latitude?: number,
): number {
  const distance = Cartesian3.distance(cartesian, camera.position);
  const usedLatitude =
    latitude ?? Cartographic.fromCartesian(cartesian).latitude;

  const fov = Math.PI / 3.0;
  const width = mapElement.offsetWidth;
  const height = mapElement.offsetHeight;
  const aspectRatio = width / height;
  const fovy = Math.atan(Math.tan(fov * 0.5) / aspectRatio) * 2.0;
  const visibleMeters = 2 * distance * Math.tan(fovy / 2);
  const relativeCircumference = Math.cos(Math.abs(usedLatitude));
  const visibleMapUnits = visibleMeters / relativeCircumference;

  return visibleMapUnits / height;
}
