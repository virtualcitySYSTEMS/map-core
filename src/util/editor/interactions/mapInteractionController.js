import DragPan from 'ol/interaction/DragPan.js';
import {
  EventType,
  ModificationKeyType,
} from '../../../interaction/interactionType.js';
import { handlerSymbol, vertexSymbol } from '../editorSymbols.js';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';

/**
 * @param {import("@vcmap/core").BaseOLMap} map
 * @returns {function():void}
 */
function suspendOpenlayerMap(map) {
  const dragPan = /** @type {import("ol/interaction").DragPan} */ (
    map.olMap
      .getInteractions()
      .getArray()
      .find((i) => i instanceof DragPan)
  );

  if (dragPan) {
    dragPan.setActive(false);
    return () => {
      dragPan.setActive(true);
    };
  }
  return () => {};
}

/**
 * @param {import("@vcmap/core").CesiumMap} map
 * @returns {function():void}
 */
function suspendCesiumMap(map) {
  function getOriginalEventTypes(types) {
    if (Array.isArray(types)) {
      return types.slice();
    } else if (typeof types === 'object') {
      return { ...types };
    }
    return types;
  }

  const originalScreenSpaceEvents = {};
  const { screenSpaceCameraController } = map.getScene();
  ['lookEventTypes', 'tiltEventTypes', 'rotateEventTypes'].forEach(
    (eventTypes) => {
      if (screenSpaceCameraController != null) {
        originalScreenSpaceEvents[eventTypes] = getOriginalEventTypes(
          screenSpaceCameraController[eventTypes],
        );
      }
    },
  );
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
  constructor() {
    super(EventType.MOVE, ModificationKeyType.ALL);
    /**
     * @type {function():void}
     * @private
     */
    this._clear = () => {};

    this.setActive();
  }

  /**
   * @inheritDoc
   * @param {InteractionEvent} event
   * @returns {Promise<InteractionEvent>}
   */
  async pipe(event) {
    this.reset();
    if (
      event.feature &&
      (event.feature[vertexSymbol] || event.feature[handlerSymbol])
    ) {
      if (event.map.className === 'CesiumMap') {
        this._clear = suspendCesiumMap(
          /** @type {import("@vcmap/core").CesiumMap} */ (event.map),
        );
      } else {
        this._clear = suspendOpenlayerMap(
          /** @type {import("@vcmap/core").OpenlayersMap|import("@vcmap/core").ObliqueMap} */ (
            event.map
          ),
        );
      }
    }
    return event;
  }

  /**
   * Resets the event handlers for the currently suspended map
   */
  reset() {
    this._clear();
    this._clear = () => {};
  }
}

export default MapInteractionController;
