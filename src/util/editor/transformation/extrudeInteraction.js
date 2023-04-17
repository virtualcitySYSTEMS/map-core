import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import { EventType } from '../../../interaction/interactionType.js';
import { handlerSymbol } from '../editorSymbols.js';
import {
  createCameraVerticalPlane,
  getCartographicFromPlane,
} from '../editorHelpers.js';
import VcsEvent from '../../../vcsEvent.js';
import { AXIS_AND_PLANES } from './transformationTypes.js';

/**
 * A class to handle events on a {@see TransformationHandler}. Should be used with {@see TransformationHandler} created for mode TransformationMode.EXTRUDE.
 * If the Z handler is dragged, the extruded event will be raised with a delta in Z direction. This
 * interaction only works if a {@see CesiumMap} is the active map.
 * @class
 * @extends {AbstractInteraction}
 */
class ExtrudeInteraction extends AbstractInteraction {
  /**
   * @param {TransformationHandler} transformationHandler
   */
  constructor(transformationHandler) {
    super(EventType.DRAGEVENTS);
    /**
     * @type {TransformationHandler}
     * @private
     */
    this._transformationHandler = transformationHandler;
    /**
     * @type {VcsEvent<number>}
     * @private
     */
    this._extruded = new VcsEvent();
    /**
     * @type {null|function(import("ol/coordinate").Coordinate, import("@vcmap-cesium/engine").Cartesian2):number}
     * @private
     */
    this._getExtrudeEvent = null;
  }

  /**
   * Event raised with the extrusion delta to the last event fired.
   * @type {VcsEvent<number>}
   * @readonly
   */
  get extruded() {
    return this._extruded;
  }

  /**
   * @param {InteractionEvent} event
   * @returns {Promise<InteractionEvent>}
   */
  async pipe(event) {
    if (this._getExtrudeEvent) {
      this._extruded.raiseEvent(
        this._getExtrudeEvent(event.positionOrPixel, event.windowPosition),
      );
      if (event.type === EventType.DRAGEND) {
        this._getExtrudeEvent = null;
        this._transformationHandler.showAxis = AXIS_AND_PLANES.NONE;
      }
    } else if (
      event.type === EventType.DRAGSTART &&
      event?.feature?.[handlerSymbol]
    ) {
      const axis = event.feature[handlerSymbol];
      if (axis === AXIS_AND_PLANES.Z) {
        const scene = /** @type {import("@vcmap/core").CesiumMap} */ (
          event.map
        ).getScene();
        this._transformationHandler.showAxis = axis;
        const plane = createCameraVerticalPlane(
          this._transformationHandler.center.slice(),
          scene,
        );
        let currentHeight = getCartographicFromPlane(
          plane,
          scene.camera,
          event.windowPosition,
        ).height;
        this._getExtrudeEvent = (c, windowPosition) => {
          const newHeight = getCartographicFromPlane(
            plane,
            scene.camera,
            windowPosition,
          ).height;
          const extrude = newHeight - currentHeight;
          currentHeight = newHeight;
          return extrude;
        };
      }
    }
    return event;
  }

  /**
   * @inheritDoc
   */
  destroy() {
    this._transformationHandler = null;
    this._extruded.destroy();
  }
}

export default ExtrudeInteraction;
