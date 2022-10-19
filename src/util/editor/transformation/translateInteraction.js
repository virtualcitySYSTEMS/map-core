import { Plane, Transforms } from '@vcmap/cesium';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import { EventType } from '../../../interaction/interactionType.js';
import { handlerSymbol } from '../editorSymbols.js';
import {
  createCameraVerticalPlane,
  getCartographicFromPlane,
  getClosestPointOn2DLine,
} from '../editorHelpers.js';
import VcsEvent from '../../../vcsEvent.js';
import Projection, { mercatorProjection } from '../../projection.js';
import { cartographicToWgs84, mercatorToCartesian } from '../../math.js';
import { AXIS_AND_PLANES, is1DAxis, is2DAxis } from './transformationTypes.js';
import CesiumMap from '../../../map/cesiumMap.js';

/**
 * A class to handle events on a {@see TransformationHandler}. Should be used with {@see TransformationHandler} created for mode TransformationMode.TRANSLATE.
 * If the rings are dragged, the translated event will be raised.
 * @class
 * @extends {AbstractInteraction}
 */
class TranslateInteraction extends AbstractInteraction {
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
    this._translated = new VcsEvent();
    /**
     * @type {null|function(import("ol/coordinate").Coordinate, import("@vcmap/cesium").Cartesian2):import("ol/coordinate").Coordinate}
     * @private
     */
    this._getTranslateEvent = null;
  }

  /**
   * Event raised if the handlers are dragged. The resulting array is of type [dx, dy, dz] where all numbers
   * are considered to be deltas to the previous event (where 0 means no translating).
   * @type {VcsEvent<Array<number>>}
   * @readonly
   */
  get translated() { return this._translated; }

  /**
   * @param {InteractionEvent} event
   * @returns {Promise<InteractionEvent>}
   */
  async pipe(event) {
    if (this._getTranslateEvent) {
      this._translated.raiseEvent(this._getTranslateEvent(event.positionOrPixel, event.windowPosition));
      if (event.type === EventType.DRAGEND) {
        this._getTranslateEvent = null;
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
          if (is1DAxis(axis)) {
            this._getTranslateEvent = this._dragAlongAxis3D(axis, event);
          } else if (is2DAxis(axis)) {
            this._getTranslateEvent = this._dragAlongPlane3D(axis, event);
          }
        } else if (is1DAxis(axis)) {
          this._getTranslateEvent = this._dragAlongAxis2D(axis, event);
        } else if (is2DAxis(axis)) {
          this._getTranslateEvent = this._dragAlongPlane2D(axis, event);
        }
      }
    }
    return event;
  }

  /**
   * @param {AXIS_AND_PLANES} axis
   * @param {InteractionEvent} event
   * @returns {function(import("ol/coordinate").Coordinate, import("@vcmap/cesium").Cartesian2):import("ol/coordinate").Coordinate}
   * @private
   */
  _dragAlongAxis3D(axis, event) {
    const scene = /** @type {import("@vcmap/core").CesiumMap} */ (event.map).getScene();
    if (axis !== AXIS_AND_PLANES.Z) {
      const center = mercatorToCartesian(this._transformationHandler.center);
      let plane = Plane.clone(Plane.ORIGIN_XY_PLANE);
      plane = Plane.transform(plane, Transforms.eastNorthUpToFixedFrame(center), plane);
      let cartographic = getCartographicFromPlane(plane, scene.camera, event.windowPosition);
      let currentPosition = Projection.wgs84ToMercator(cartographicToWgs84(cartographic));
      return (c, windowPosition) => {
        cartographic = getCartographicFromPlane(plane, scene.camera, windowPosition);
        const newPosition = Projection.wgs84ToMercator(cartographicToWgs84(cartographic));
        const translate = axis === AXIS_AND_PLANES.X ?
          [newPosition[0] - currentPosition[0], 0, 0] :
          [0, newPosition[1] - currentPosition[1], 0];

        currentPosition = newPosition;
        return translate;
      };
    } else {
      const plane = createCameraVerticalPlane(this._transformationHandler.center.slice(), scene);
      let currentHeight = getCartographicFromPlane(plane, scene.camera, event.windowPosition).height;
      return (c, windowPosition) => {
        const newHeight = getCartographicFromPlane(plane, scene.camera, windowPosition).height;
        const translate = [0, 0, newHeight - currentHeight];
        currentHeight = newHeight;
        return translate;
      };
    }
  }

  /**
   * @param {AXIS_AND_PLANES} axis
   * @param {InteractionEvent} event
   * @returns {function(import("ol/coordinate").Coordinate, import("@vcmap/cesium").Cartesian2):import("ol/coordinate").Coordinate}
   * @private
   */
  _dragAlongPlane3D(axis, event) {
    const scene = /** @type {import("@vcmap/core").CesiumMap} */ (event.map).getScene();
    const center = mercatorToCartesian(this._transformationHandler.center);
    let plane;
    if (axis === AXIS_AND_PLANES.YZ) {
      plane = Plane.clone(Plane.ORIGIN_YZ_PLANE);
    } else if (axis === AXIS_AND_PLANES.XZ) {
      plane = Plane.clone(Plane.ORIGIN_ZX_PLANE);
    } else {
      plane = Plane.clone(Plane.ORIGIN_XY_PLANE);
    }
    plane = Plane.transform(plane, Transforms.eastNorthUpToFixedFrame(center), plane);
    let cartographic = getCartographicFromPlane(plane, scene.camera, event.windowPosition);
    let currentPosition = Projection.wgs84ToMercator(cartographicToWgs84(cartographic));
    return (c, windowPosition) => {
      cartographic = getCartographicFromPlane(plane, scene.camera, windowPosition);
      const newPosition = Projection.wgs84ToMercator(cartographicToWgs84(cartographic));

      const translate = [
        newPosition[0] - currentPosition[0],
        newPosition[1] - currentPosition[1],
        newPosition[2] - currentPosition[2],
      ];
      currentPosition = newPosition;
      return translate;
    };
  }

  /**
   * @param {AXIS_AND_PLANES} axis
   * @param {InteractionEvent} event
   * @returns {function(import("ol/coordinate").Coordinate, import("@vcmap/cesium").Cartesian2):import("ol/coordinate").Coordinate}
   * @private
   */
  _dragAlongAxis2D(axis, event) {
    const center = this._transformationHandler.center.slice();
    const mercatorExtent = mercatorProjection.proj.getExtent();
    const end = axis === AXIS_AND_PLANES.X ?
      [mercatorExtent[0], center[1], center[2]] :
      [center[0], mercatorExtent[1], center[2]];

    let lastPointOnAxis = getClosestPointOn2DLine(center, end, event.positionOrPixel);
    return (coords) => {
      const newPointOnAxis = getClosestPointOn2DLine(center, end, coords);
      const translate = axis === AXIS_AND_PLANES.X ?
        [newPointOnAxis[0] - lastPointOnAxis[0], 0, 0] :
        [0, newPointOnAxis[1] - lastPointOnAxis[1], 0];

      lastPointOnAxis = newPointOnAxis;
      return translate;
    };
  }

  /**
   * @param {AXIS_AND_PLANES} axis
   * @param {InteractionEvent} event
   * @returns {function(import("ol/coordinate").Coordinate, import("@vcmap/cesium").Cartesian2):import("ol/coordinate").Coordinate}
   * @private
   */
  // eslint-disable-next-line class-methods-use-this
  _dragAlongPlane2D(axis, event) {
    let current = event.positionOrPixel.slice();
    return (coords) => {
      const translate = [
        coords[0] - current[0],
        coords[1] - current[1],
        0,
      ];
      current = coords.slice();
      return translate;
    };
  }

  /**
   * @inheritDoc
   */
  destroy() {
    this._transformationHandler = null;
    this._translated.destroy();
  }
}

export default TranslateInteraction;
