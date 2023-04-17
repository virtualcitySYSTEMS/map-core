import { Cartesian2, Plane, Transforms } from '@vcmap-cesium/engine';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import { EventType } from '../../../interaction/interactionType.js';
import { handlerSymbol } from '../editorSymbols.js';
import { getCartographicFromPlane } from '../editorHelpers.js';
import VcsEvent from '../../../vcsEvent.js';
import Projection from '../../projection.js';
import { cartographicToWgs84, mercatorToCartesian } from '../../math.js';
import { AXIS_AND_PLANES } from './transformationTypes.js';
import CesiumMap from '../../../map/cesiumMap.js';

/**
 * @typedef {Object} RotationEvent
 * @property {number} angle - in radians
 * @property {AXIS_AND_PLANES} axis - the axis of rotation
 */

/**
 * @param {import("@vcmap-cesium/engine").Cartesian2} start
 * @param {import("@vcmap-cesium/engine").Cartesian2} end
 * @param {number} angle
 * @returns {number}
 */
function determineOrientation(start, end, angle) {
  const orientation = start.x * end.y - start.y * end.x;
  return orientation > 0 ? angle : angle * -1;
}

/**
 * @param {function(import("ol/coordinate").Coordinate, import("@vcmap-cesium/engine").Cartesian2):import("@vcmap-cesium/engine").Cartesian2} getPosition
 * @param {InteractionEvent} event
 * @param {AXIS_AND_PLANES} axis
 * @returns {function(import("ol/coordinate").Coordinate, import("@vcmap-cesium/engine").Cartesian2):RotationEvent}
 */
function createGetRotationEvent(getPosition, event, axis) {
  let currentPosition = getPosition(
    event.positionOrPixel,
    event.windowPosition,
  );

  return (coordinate, windowPosition) => {
    const newPosition = getPosition(coordinate, windowPosition);
    const angle = determineOrientation(
      currentPosition,
      newPosition,
      Cartesian2.angleBetween(currentPosition, newPosition),
    );
    currentPosition = newPosition;
    return { angle, axis };
  };
}

/**
 * A class to handle events on a {@see TransformationHandler}. Should be used with {@see TransformationHandler} created for mode TransformationMode.ROTATE.
 * If the rings are dragged, the rotated event will be raised.
 * @class
 * @extends {AbstractInteraction}
 */
class RotateInteraction extends AbstractInteraction {
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
     * @type {VcsEvent<RotationEvent>}
     * @private
     */
    this._rotated = new VcsEvent();
    /**
     * @type {null|function(import("ol/coordinate").Coordinate, import("@vcmap-cesium/engine").Cartesian2):{angle: number, axis: AXIS_AND_PLANES}}
     * @private
     */
    this._getRotationEvent = null;
  }

  /**
   * The event raised, if the rings are dragged. Event is raised with the angle delta to the last event in radians.
   * @type {VcsEvent<RotationEvent>}
   * @readonly
   */
  get rotated() {
    return this._rotated;
  }

  /**
   * @param {InteractionEvent} event
   * @returns {Promise<InteractionEvent>}
   */
  async pipe(event) {
    if (this._getRotationEvent) {
      this._rotated.raiseEvent(
        this._getRotationEvent(event.positionOrPixel, event.windowPosition),
      );
      if (event.type === EventType.DRAGEND) {
        this._getRotationEvent = null;
      }
    } else if (
      event.type === EventType.DRAGSTART &&
      event?.feature?.[handlerSymbol]
    ) {
      const axis = event.feature[handlerSymbol];
      if (axis !== AXIS_AND_PLANES.NONE) {
        if (event.map instanceof CesiumMap) {
          this._getRotationEvent = this._dragAlongPlane3D(axis, event);
        } else {
          this._getRotationEvent = this._dragAlongPlane2D(axis, event);
        }
      }
    }
    return event;
  }

  /**
   * @param {AXIS_AND_PLANES} axis
   * @param {InteractionEvent} event
   * @returns {function(import("ol/coordinate").Coordinate, import("@vcmap-cesium/engine").Cartesian2):{angle: number, axis: AXIS_AND_PLANES}}
   * @private
   */
  _dragAlongPlane3D(axis, event) {
    const scene = /** @type {import("@vcmap/core").CesiumMap} */ (
      event.map
    ).getScene();
    const center = mercatorToCartesian(this._transformationHandler.center);
    let plane;
    if (axis === AXIS_AND_PLANES.X) {
      plane = Plane.clone(Plane.ORIGIN_YZ_PLANE);
    } else if (axis === AXIS_AND_PLANES.Y) {
      plane = Plane.clone(Plane.ORIGIN_ZX_PLANE);
    } else {
      plane = Plane.clone(Plane.ORIGIN_XY_PLANE);
    }
    plane = Plane.transform(
      plane,
      Transforms.eastNorthUpToFixedFrame(center),
      plane,
    );

    return createGetRotationEvent(
      (c, windowPosition) => {
        const cartographic = getCartographicFromPlane(
          plane,
          scene.camera,
          windowPosition,
        );
        const centeredCoordinates = Projection.wgs84ToMercator(
          cartographicToWgs84(cartographic),
        );
        const { center: currentCenter } = this._transformationHandler;
        centeredCoordinates[0] = currentCenter[0] - centeredCoordinates[0];
        centeredCoordinates[1] = currentCenter[1] - centeredCoordinates[1];
        centeredCoordinates[2] = currentCenter[2] - centeredCoordinates[2];
        if (axis === AXIS_AND_PLANES.Z) {
          return Cartesian2.fromArray(centeredCoordinates);
        }
        if (axis === AXIS_AND_PLANES.X) {
          return new Cartesian2(centeredCoordinates[1], centeredCoordinates[2]);
        }
        return new Cartesian2(centeredCoordinates[0], centeredCoordinates[2]);
      },
      event,
      axis,
    );
  }

  /**
   * @param {AXIS_AND_PLANES} axis
   * @param {InteractionEvent} event
   * @returns {function(import("ol/coordinate").Coordinate, import("@vcmap-cesium/engine").Cartesian2):{angle: number, axis: AXIS_AND_PLANES}}
   * @private
   */
  _dragAlongPlane2D(axis, event) {
    return createGetRotationEvent(
      (c) => {
        const centeredCoordinates = c.slice();
        const { center } = this._transformationHandler;
        centeredCoordinates[0] = center[0] - centeredCoordinates[0];
        centeredCoordinates[1] = center[1] - centeredCoordinates[1];
        centeredCoordinates[2] = center[2] - centeredCoordinates[2];
        return Cartesian2.fromArray(centeredCoordinates);
      },
      event,
      axis,
    );
  }

  /**
   * @inheritDoc
   */
  destroy() {
    this._transformationHandler = null;
    this._rotated.destroy();
  }
}

export default RotateInteraction;
