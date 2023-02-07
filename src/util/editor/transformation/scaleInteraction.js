import {
  Plane,
  Transforms,
} from '@vcmap-cesium/engine';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import { EventType } from '../../../interaction/interactionType.js';
import { handlerSymbol } from '../editorSymbols.js';
import {
  getCartographicFromPlane,
} from '../editorHelpers.js';
import VcsEvent from '../../../vcsEvent.js';
import Projection from '../../projection.js';
import { cartesian2DDistance, cartographicToWgs84, mercatorToCartesian } from '../../math.js';
import { AXIS_AND_PLANES } from './transformationTypes.js';
import CesiumMap from '../../../map/cesiumMap.js';

/**
 * @param {function(import("ol/coordinate").Coordinate, import("@vcmap-cesium/engine").Cartesian2):import("ol/coordinate").Coordinate} getPosition
 * @param {InteractionEvent} event
 * @param {TransformationHandler} transformationHandler
 * @param {AXIS_AND_PLANES} axis
 * @returns {function(import("ol/coordinate").Coordinate, import("@vcmap-cesium/engine").Cartesian2):Array<number>}
 */
function createGetScaledEvent(getPosition, event, transformationHandler, axis) {
  const { center } = transformationHandler;
  let flippedX = false;
  let flippedY = false;

  const getDistance = (coordinate, windowPosition) => {
    const position = getPosition(coordinate, windowPosition);
    const dx = position[0] - center[0];
    const dy = position[1] - center[1];
    let distance;
    if (axis === AXIS_AND_PLANES.X) {
      distance = Math.abs(dx);
    } else if (axis === AXIS_AND_PLANES.Y) {
      distance = Math.abs(dy);
    } else {
      distance = cartesian2DDistance(center, position);
    }
    return { distance, dx, dy };
  };

  const { distance: initialDistance } = getDistance(event.positionOrPixel, event.windowPosition);
  let currentDistance = initialDistance;
  return (coordinate, windowPosition) => {
    const { distance, dx, dy } = getDistance(coordinate, windowPosition);

    const distanceDelta = distance / currentDistance;
    const currentFlippedX = dx < 0;
    const currentFlippedY = dy < 0;
    let sx = distanceDelta;
    let sy = distanceDelta;
    if (currentFlippedX !== flippedX) {
      flippedX = currentFlippedX;
      sx *= -1;
    }

    if (currentFlippedY !== flippedY) {
      flippedY = currentFlippedY;
      sy *= -1;
    }

    currentDistance = distance;
    if (axis === AXIS_AND_PLANES.X) {
      return [sx, 1, 1];
    } else if (axis === AXIS_AND_PLANES.Y) {
      return [1, sy, 1];
    } else {
      return [sx, sy, 1];
    }
  };
}

/**
 * A class to handle events on a {@see TransformationHandler}. Should be used with {@see TransformationHandler} created for mode TransformationMode.SCALE..
 * If the handlers are dragged, the scaled event will be raised.
 * @class
 * @extends {AbstractInteraction}
 */
class ScaleInteraction extends AbstractInteraction {
  /**
   * @param {TransformationHandler} transformationHandler
   */
  constructor(transformationHandler) {
    super(EventType.DRAGEVENTS);
    /**
     * @type {TransformationHandler}
     */
    this._transformationHandler = transformationHandler;
    /**
     * @type {VcsEvent<Array<number>>}
     */
    this._scaled = new VcsEvent();
    /**
     * @type {null|function(import("ol/coordinate").Coordinate, import("@vcmap-cesium/engine").Cartesian2):Array<number>}
     * @private
     */
    this._getScaleEvent = null;
  }

  /**
   * Event raised if the handlers are dragged. The resulting array is of type [sx, sy, sz] where all numbers
   * are considered to be deltas to the previous event (where 1 means no scaling).
   * @type {VcsEvent<Array<number>>}
   * @readonly
   */
  get scaled() { return this._scaled; }

  /**
   * @param {InteractionEvent} event
   * @returns {Promise<InteractionEvent>}
   */
  async pipe(event) {
    if (this._getScaleEvent) {
      this._scaled.raiseEvent(this._getScaleEvent(event.positionOrPixel, event.windowPosition));
      if (event.type === EventType.DRAGEND) {
        this._getScaleEvent = null;
        this._transformationHandler.showAxis = AXIS_AND_PLANES.NONE;
      }
    } else if (
      event.type === EventType.DRAGSTART &&
      event?.feature?.[handlerSymbol]
    ) {
      const axis = event.feature[handlerSymbol];
      if (axis !== AXIS_AND_PLANES.NONE) {
        this._transformationHandler.showAxis = axis;
        if (event.map instanceof CesiumMap) {
          this._getScaleEvent = this._dragAlongPlane3D(axis, event);
        } else {
          this._getScaleEvent = this._dragAlongPlane2D(axis, event);
        }
      }
    }
    return event;
  }

  /**
   * @param {AXIS_AND_PLANES} axis
   * @param {InteractionEvent} event
   * @returns {function(import("ol/coordinate").Coordinate, import("@vcmap-cesium/engine").Cartesian2):Array<number>}
   * @private
   */
  _dragAlongPlane3D(axis, event) {
    const scene = /** @type {import("@vcmap/core").CesiumMap} */ (event.map).getScene();
    const center = mercatorToCartesian(this._transformationHandler.center);
    let plane = Plane.clone(Plane.ORIGIN_XY_PLANE);
    plane = Plane.transform(plane, Transforms.eastNorthUpToFixedFrame(center), plane);

    return createGetScaledEvent(
      (c, windowPosition) => {
        const cartographic = getCartographicFromPlane(plane, scene.camera, windowPosition);
        return Projection.wgs84ToMercator(cartographicToWgs84(cartographic));
      },
      event,
      this._transformationHandler,
      axis,
    );
  }

  /**
   * @param {AXIS_AND_PLANES} axis
   * @param {InteractionEvent} event
   * @returns {function(import("ol/coordinate").Coordinate, import("@vcmap-cesium/engine").Cartesian2):Array<number>}
   * @private
   */
  _dragAlongPlane2D(axis, event) {
    return createGetScaledEvent(
      c => c.slice(),
      event,
      this._transformationHandler,
      axis,
    );
  }

  /**
   * @inheritDoc
   */
  destroy() {
    this._transformationHandler = null;
    this._scaled.destroy();
  }
}

export default ScaleInteraction;
