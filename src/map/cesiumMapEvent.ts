import {
  KeyboardEventModifier,
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
