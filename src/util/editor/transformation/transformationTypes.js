import { Color } from '@vcmap-cesium/engine';

/**
 * Handlers are map specific transformation handlers wich enable the use of the transformation interactions.
 * There visualization is {@see TransformationMode} specific. It is not adviced to create these handlers yourself,
 * use {@see createTransformationHandler} instead.
 * @typedef {Object} Handlers
 * @property {boolean} show - whether to show or hide all handlers
 * @property {function(import("ol/coordinate").Coordinate):void} setCenter - update the center of the handlers
 * @property {AXIS_AND_PLANES} showAxis - highlight the given axis
 * @property {boolean} greyOutZ - display Z axis handlers in grey and do not allow them to be picked
 * @property {function():void} destroy - destroy the handlers, removing any resources created by create2DHandlers or create3DHandlers
 */

/**
 * This interface provides an abstraction from the other {@see Handlers} interface.
 * @typedef {Object} TransformationHandler
 * @property {function(number, number, number):void} translate - translate the center of the underlying handlers
 * @property {import("ol/coordinate").Coordinate} center - readonly current center of the handler. this is a copy, not a reference
 * @property {AXIS_AND_PLANES} showAxis - highlight the given axis
 * @property {boolean} showing - readonly value indicating whether the handlers are showing (proxy for: features are selected)
 * @property {function():void} destroy - destroy the handler and any resources created by it
 */

/**
 * @enum {string}
 * @property {string} X
 * @property {string} Y
 * @property {string} Z
 * @property {string} XY
 * @property {string} XZ
 * @property {string} YZ
 * @property {string} NONE
 */
export const AXIS_AND_PLANES = {
  X: 'X',
  Y: 'Y',
  Z: 'Z',
  XY: 'XY',
  XZ: 'XZ',
  YZ: 'YZ',
  NONE: 'NONE',
};

/**
 * @enum {string}
 * @property {string} TRANSLATE
 * @property {string} ROTATE
 * @property {string} SCALE
 * @property {string} EXTRUDE
 */
export const TransformationMode = {
  TRANSLATE: 'translate',
  ROTATE: 'rotate',
  SCALE: 'scale',
  EXTRUDE: 'extrude',
};

/**
 * @const
 * @type {import("@vcmap-cesium/engine").Color}
 */
export const greyedOutColor = Color.GRAY.withAlpha(0.5);

/**
 * @param {AXIS_AND_PLANES} axis
 * @returns {boolean}
 */
export function is1DAxis(axis) {
  return axis === AXIS_AND_PLANES.X ||
    axis === AXIS_AND_PLANES.Y ||
    axis === AXIS_AND_PLANES.Z;
}

/**
 * @param {AXIS_AND_PLANES} axis
 * @returns {boolean}
 */
export function is2DAxis(axis) {
  return axis === AXIS_AND_PLANES.XY ||
    axis === AXIS_AND_PLANES.XZ ||
    axis === AXIS_AND_PLANES.YZ;
}
