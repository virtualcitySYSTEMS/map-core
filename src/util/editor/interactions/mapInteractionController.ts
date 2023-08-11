import type { Feature } from 'ol/index.js';
import DragPan from 'ol/interaction/DragPan.js';
import type { CameraEventType, Scene } from '@vcmap-cesium/engine';
import {
  EventType,
  ModificationKeyType,
} from '../../../interaction/interactionType.js';
import { handlerSymbol, vertexSymbol } from '../editorSymbols.js';
import AbstractInteraction, {
  EventAfterEventHandler,
} from '../../../interaction/abstractInteraction.js';
import type BaseOLMap from '../../../map/baseOLMap.js';
import type CesiumMap from '../../../map/cesiumMap.js';

function suspendOpenlayerMap(map: BaseOLMap): () => void {
  const dragPan = map
    .olMap!.getInteractions()
    .getArray()
    .find((i) => i instanceof DragPan);

  if (dragPan) {
    dragPan.setActive(false);
    return () => {
      dragPan.setActive(true);
    };
  }
  return () => {};
}

type CachedScreenSpaceCameraControllerKeys =
  | 'lookEventTypes'
  | 'tiltEventTypes'
  | 'rotateEventTypes';
function suspendCesiumMap(map: CesiumMap): () => void {
  function getOriginalEventTypes<T = any[] | CameraEventType | undefined>(
    types: T,
  ): T {
    if (Array.isArray(types)) {
      return types.slice() as T;
    } else if (typeof types === 'object') {
      return { ...types };
    }
    return types;
  }

  const originalScreenSpaceEvents: Partial<
    Record<
      CachedScreenSpaceCameraControllerKeys,
      any[] | CameraEventType | undefined
    >
  > = {};
  const { screenSpaceCameraController } = map.getScene() as Scene;
  (
    [
      'lookEventTypes',
      'tiltEventTypes',
      'rotateEventTypes',
    ] as CachedScreenSpaceCameraControllerKeys[]
  ).forEach((eventTypes) => {
    if (screenSpaceCameraController != null) {
      originalScreenSpaceEvents[eventTypes] = getOriginalEventTypes(
        screenSpaceCameraController[eventTypes],
      );
    }
  });
  screenSpaceCameraController.lookEventTypes = undefined;
  screenSpaceCameraController.tiltEventTypes = undefined;
  screenSpaceCameraController.rotateEventTypes = undefined;

  return () => {
    screenSpaceCameraController.lookEventTypes =
      originalScreenSpaceEvents.lookEventTypes;
    screenSpaceCameraController.tiltEventTypes =
      originalScreenSpaceEvents.tiltEventTypes;
    screenSpaceCameraController.rotateEventTypes =
      originalScreenSpaceEvents.rotateEventTypes;
  };
}

/**
 * An interaction to suppress map interactions when handling editor features (e.g. dragPan)
 */
class MapInteractionController extends AbstractInteraction {
  // eslint-disable-next-line class-methods-use-this
  private _clear: () => void = () => {};

  constructor() {
    super(EventType.MOVE, ModificationKeyType.ALL);

    this.setActive();
  }

  pipe(event: EventAfterEventHandler): Promise<EventAfterEventHandler> {
    this.reset();
    if (
      event.feature &&
      ((event.feature as Feature)[vertexSymbol] ||
        (event.feature as Feature)[handlerSymbol])
    ) {
      if (event.map.className === 'CesiumMap') {
        this._clear = suspendCesiumMap(event.map as CesiumMap);
      } else {
        this._clear = suspendOpenlayerMap(event.map as BaseOLMap);
      }
    }
    return Promise.resolve(event);
  }

  reset(): void {
    this._clear();
    this._clear = (): void => {};
  }

  destroy(): void {
    this.reset();
  }
}

export default MapInteractionController;
