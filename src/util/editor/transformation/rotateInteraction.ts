import type { Scene } from '@vcmap-cesium/engine';
import { Cartesian2, Plane, Transforms } from '@vcmap-cesium/engine';
import type { Coordinate } from 'ol/coordinate.js';
import type { Feature } from 'ol/index.js';
import type { EventAfterEventHandler } from '../../../interaction/abstractInteraction.js';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import { EventType } from '../../../interaction/interactionType.js';
import { handlerSymbol } from '../editorSymbols.js';
import { getCartographicFromPlane } from '../editorHelpers.js';
import VcsEvent from '../../../vcsEvent.js';
import Projection from '../../projection.js';
import { cartographicToWgs84, mercatorToCartesian } from '../../math.js';
import type { TransformationHandler } from './transformationTypes.js';
import { AxisAndPlanes } from './transformationTypes.js';
import CesiumMap from '../../../map/cesiumMap.js';

export type RotationEvent = {
  angle: number;
  axis: AxisAndPlanes;
};

function determineOrientation(
  start: Cartesian2,
  end: Cartesian2,
  angle: number,
): number {
  const orientation = start.x * end.y - start.y * end.x;
  return orientation > 0 ? angle : angle * -1;
}

type GetRotationEventCallback = (
  coord: Coordinate,
  windowPosition: Cartesian2,
) => RotationEvent;

function createGetRotationEvent(
  getPosition: (coords: Coordinate, windowPosition: Cartesian2) => Cartesian2,
  event: EventAfterEventHandler,
  axis: AxisAndPlanes,
): GetRotationEventCallback {
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
 * A class to handle events on a {@link TransformationHandler}. Should be used with {@link TransformationHandler} created for mode TransformationMode.ROTATE.
 * If the rings are dragged, the rotated event will be raised.
 */
class RotateInteraction extends AbstractInteraction {
  private _transformationHandler: TransformationHandler | null;

  /**
   * The event raised, if the rings are dragged. Event is raised with the angle delta to the last event in radians.
   */
  readonly rotated = new VcsEvent<RotationEvent>();

  private _getRotationEvent: null | GetRotationEventCallback = null;

  constructor(transformationHandler: TransformationHandler) {
    super(EventType.DRAGEVENTS);
    this._transformationHandler = transformationHandler;
  }

  pipe(event: EventAfterEventHandler): Promise<EventAfterEventHandler> {
    if (this._getRotationEvent) {
      this.rotated.raiseEvent(
        this._getRotationEvent(event.positionOrPixel, event.windowPosition),
      );
      if (event.type === EventType.DRAGEND) {
        this._getRotationEvent = null;
      }
    } else if (
      event.type === EventType.DRAGSTART &&
      (event.feature as Feature | undefined)?.[handlerSymbol]
    ) {
      const axis = (event.feature as Feature)[handlerSymbol] as AxisAndPlanes;
      if (axis !== AxisAndPlanes.NONE) {
        if (event.map instanceof CesiumMap) {
          this._getRotationEvent = this._dragAlongPlane3D(axis, event);
        } else {
          this._getRotationEvent = this._dragAlongPlane2D(axis, event);
        }
      }
    }
    return Promise.resolve(event);
  }

  private _dragAlongPlane3D(
    axis: AxisAndPlanes,
    event: EventAfterEventHandler,
  ): (
    coords: Coordinate,
    windowPosition: Cartesian2,
  ) => { angle: number; axis: AxisAndPlanes } {
    const scene = (event.map as CesiumMap).getScene() as Scene;
    const center = mercatorToCartesian(this._transformationHandler!.center);
    let plane: Plane;
    if (axis === AxisAndPlanes.X) {
      plane = Plane.clone(Plane.ORIGIN_YZ_PLANE);
    } else if (axis === AxisAndPlanes.Y) {
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
      (_c, windowPosition) => {
        const cartographic = getCartographicFromPlane(
          plane,
          scene.camera,
          windowPosition,
        );
        const centeredCoordinates = Projection.wgs84ToMercator(
          cartographicToWgs84(cartographic),
        );
        const currentCenter = this._transformationHandler!.center;
        centeredCoordinates[0] = currentCenter[0] - centeredCoordinates[0];
        centeredCoordinates[1] = currentCenter[1] - centeredCoordinates[1];
        centeredCoordinates[2] = currentCenter[2] - centeredCoordinates[2];
        if (axis === AxisAndPlanes.Z) {
          return Cartesian2.fromArray(centeredCoordinates);
        }
        if (axis === AxisAndPlanes.X) {
          return new Cartesian2(centeredCoordinates[1], centeredCoordinates[2]);
        }
        return new Cartesian2(centeredCoordinates[0], centeredCoordinates[2]);
      },
      event,
      axis,
    );
  }

  private _dragAlongPlane2D(
    axis: AxisAndPlanes,
    event: EventAfterEventHandler,
  ): (
    coords: Coordinate,
    windowPosition: Cartesian2,
  ) => { angle: number; axis: AxisAndPlanes } {
    return createGetRotationEvent(
      (c) => {
        const centeredCoordinates = c.slice();
        const { center } = this._transformationHandler!;
        centeredCoordinates[0] = center[0] - centeredCoordinates[0];
        centeredCoordinates[1] = center[1] - centeredCoordinates[1];
        centeredCoordinates[2] = center[2] - centeredCoordinates[2];
        return Cartesian2.fromArray(centeredCoordinates);
      },
      event,
      axis,
    );
  }

  destroy(): void {
    this._transformationHandler = null;
    this.rotated.destroy();
  }
}

export default RotateInteraction;
