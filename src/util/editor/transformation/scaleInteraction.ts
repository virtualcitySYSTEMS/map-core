import type { Cartesian2, Scene } from '@vcmap-cesium/engine';
import { Plane, Transforms } from '@vcmap-cesium/engine';
import type { Coordinate } from 'ol/coordinate.js';
import type { Feature } from 'ol/index.js';

import type { EventAfterEventHandler } from '../../../interaction/abstractInteraction.js';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import { EventType } from '../../../interaction/interactionType.js';
import { handlerSymbol } from '../editorSymbols.js';
import { getCartographicFromPlane } from '../editorHelpers.js';
import VcsEvent from '../../../vcsEvent.js';
import Projection from '../../projection.js';
import {
  cartesian2DDistance,
  cartesian3DDistance,
  cartographicToWgs84,
  mercatorToCartesian,
} from '../../math.js';
import type { TransformationHandler } from './transformationTypes.js';
import { AxisAndPlanes } from './transformationTypes.js';
import CesiumMap from '../../../map/cesiumMap.js';

/**
 * [dx, dy, dz]
 */
export type ScaleEvent = [number, number, number];

type GetScaleCallback = (
  coords: Coordinate,
  windowPosition: Cartesian2,
) => ScaleEvent;

function createGetScaledEvent(
  getPosition: (coords: Coordinate, windowPosition: Cartesian2) => Coordinate,
  event: EventAfterEventHandler,
  transformationHandler: TransformationHandler,
  axis: AxisAndPlanes,
): GetScaleCallback {
  const { center } = transformationHandler;
  let flippedX = false;
  let flippedY = false;
  let flippedZ = false;

  const getDistance = (
    coordinate: Coordinate,
    windowPosition: Cartesian2,
  ): { distance: number; dx: number; dy: number; dz: number } => {
    const position = getPosition(coordinate, windowPosition);
    const dx = position[0] - center[0];
    const dy = position[1] - center[1];
    let dz = position[2] - center[2];
    dz = Number.isFinite(dz) ? dz : 0;
    let distance;
    if (axis === AxisAndPlanes.X) {
      distance = Math.abs(dx);
    } else if (axis === AxisAndPlanes.Y) {
      distance = Math.abs(dy);
    } else if (axis === AxisAndPlanes.Z) {
      distance = Math.abs(dz);
    } else if (axis === AxisAndPlanes.XYZ) {
      distance = cartesian3DDistance(center, position);
    } else {
      distance = cartesian2DDistance(center, position);
    }
    return { distance, dx, dy, dz };
  };

  const { distance: initialDistance } = getDistance(
    event.positionOrPixel,
    event.windowPosition,
  );
  let currentDistance = initialDistance;
  return (coordinate, windowPosition) => {
    const { distance, dx, dy, dz } = getDistance(coordinate, windowPosition);

    const distanceDelta = distance / currentDistance;
    const currentFlippedX = dx < 0;
    const currentFlippedY = dy < 0;
    const currentFlippedZ = dz < 0;
    let sx = distanceDelta;
    let sy = distanceDelta;
    let sz = distanceDelta;

    if (currentFlippedX !== flippedX) {
      flippedX = currentFlippedX;
      sx *= -1;
    }

    if (currentFlippedY !== flippedY) {
      flippedY = currentFlippedY;
      sy *= -1;
    }

    if (currentFlippedZ !== flippedZ) {
      flippedZ = currentFlippedZ;
      sz *= -1;
    }

    currentDistance = distance;
    if (axis === AxisAndPlanes.X) {
      return [sx, 1, 1];
    } else if (axis === AxisAndPlanes.Y) {
      return [1, sy, 1];
    } else if (axis === AxisAndPlanes.XY) {
      return [sx, sy, 1];
    } else if (axis === AxisAndPlanes.XYZ) {
      return [sx, sy, sz];
    } else if (axis === AxisAndPlanes.Z) {
      return [1, 1, sz];
    }
    return [1, 1, 1];
  };
}

/**
 * A class to handle events on a {@link TransformationHandler}. Should be used with {@link TransformationHandler} created for mode TransformationMode.SCALE..
 * If the handlers are dragged, the scaled event will be raised.
 */
class ScaleInteraction extends AbstractInteraction {
  private _transformationHandler: TransformationHandler | null;

  /**
   * Event raised if the handlers are dragged. The resulting array is of type [sx, sy, sz] where all numbers
   * are considered to be deltas to the previous event (where 1 means no scaling).
   */
  readonly scaled = new VcsEvent<ScaleEvent>();

  private _getScaleEvent: null | GetScaleCallback = null;

  constructor(transformationHandler: TransformationHandler) {
    super(EventType.DRAGEVENTS);
    this._transformationHandler = transformationHandler;
  }

  pipe(event: EventAfterEventHandler): Promise<EventAfterEventHandler> {
    if (this._getScaleEvent) {
      this.scaled.raiseEvent(
        this._getScaleEvent(event.positionOrPixel, event.windowPosition),
      );
      if (event.type === EventType.DRAGEND) {
        this._getScaleEvent = null;
        this._transformationHandler!.showAxis = AxisAndPlanes.NONE;
      }
    } else if (
      event.type === EventType.DRAGSTART &&
      (event.feature as Feature | undefined)?.[handlerSymbol]
    ) {
      const axis = (event.feature as Feature)[handlerSymbol] as AxisAndPlanes;
      if (axis !== AxisAndPlanes.NONE) {
        this._transformationHandler!.showAxis = axis;
        if (event.map instanceof CesiumMap) {
          this._getScaleEvent = this._dragAlongPlane3D(axis, event);
        } else {
          this._getScaleEvent = this._dragAlongPlane2D(axis, event);
        }
      }
    }
    return Promise.resolve(event);
  }

  private _dragAlongPlane3D(
    axis: AxisAndPlanes,
    event: EventAfterEventHandler,
  ): GetScaleCallback {
    const scene = (event.map as CesiumMap).getScene() as Scene;
    const center = mercatorToCartesian(this._transformationHandler!.center);
    let plane = Plane.clone(
      axis === AxisAndPlanes.Z ? Plane.ORIGIN_ZX_PLANE : Plane.ORIGIN_XY_PLANE,
    );
    plane = Plane.transform(
      plane,
      Transforms.eastNorthUpToFixedFrame(center),
      plane,
    );

    return createGetScaledEvent(
      (_c, windowPosition) => {
        const cartographic = getCartographicFromPlane(
          plane,
          scene.camera,
          windowPosition,
        );
        return Projection.wgs84ToMercator(cartographicToWgs84(cartographic));
      },
      event,
      this._transformationHandler!,
      axis,
    );
  }

  private _dragAlongPlane2D(
    axis: AxisAndPlanes,
    event: EventAfterEventHandler,
  ): GetScaleCallback {
    return createGetScaledEvent(
      (c) => c.slice(),
      event,
      this._transformationHandler!,
      axis,
    );
  }

  destroy(): void {
    this._transformationHandler = null;
    this.scaled.destroy();
  }
}

export default ScaleInteraction;
