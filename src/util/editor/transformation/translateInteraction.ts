import type { Cartesian2, Scene } from '@vcmap-cesium/engine';
import { Plane, Transforms } from '@vcmap-cesium/engine';
import type { Coordinate } from 'ol/coordinate.js';
import type { Feature } from 'ol/index.js';

import type { EventAfterEventHandler } from '../../../interaction/abstractInteraction.js';
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
import type { TransformationHandler } from './transformationTypes.js';
import { AxisAndPlanes, is1DAxis, is2DAxis } from './transformationTypes.js';
import BaseCesiumMap from '../../../map/baseCesiumMap.js';

/**
 * Of type [dx, dy, dz];
 */
export type TranslateEvent = [number, number, number];

type GetTranslateEvent = (
  coord: Coordinate,
  windowPosition: Cartesian2,
) => TranslateEvent;

/**
 * A class to handle events on a {@link TransformationHandler}. Should be used with {@link TransformationHandler} created for mode TransformationMode.TRANSLATE.
 * If the rings are dragged, the translated event will be raised.
 * @extends {AbstractInteraction}
 */
class TranslateInteraction extends AbstractInteraction {
  private _transformationHandler: TransformationHandler | null;

  /**
   * Event raised if the handlers are dragged. The resulting array is of type [dx, dy, dz] where all numbers
   * are considered to be deltas to the previous event (where 0 means no translating).
   */
  readonly translated = new VcsEvent<TranslateEvent>();

  private _getTranslateEvent: null | GetTranslateEvent = null;

  constructor(transformationHandler: TransformationHandler) {
    super(EventType.DRAGEVENTS);
    this._transformationHandler = transformationHandler;
  }

  pipe(event: EventAfterEventHandler): Promise<EventAfterEventHandler> {
    if (this._getTranslateEvent) {
      this.translated.raiseEvent(
        this._getTranslateEvent(event.positionOrPixel, event.windowPosition),
      );
      if (event.type === EventType.DRAGEND) {
        this._getTranslateEvent = null;
        this._transformationHandler!.showAxis = AxisAndPlanes.NONE;
      }
    } else if (
      event.type === EventType.DRAGSTART &&
      (event.feature as Feature | undefined)?.[handlerSymbol]
    ) {
      const axis = (event.feature as Feature)[handlerSymbol] as AxisAndPlanes;
      if (axis !== AxisAndPlanes.NONE) {
        this._transformationHandler!.showAxis = axis;
        if (event.map instanceof BaseCesiumMap) {
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
    return Promise.resolve(event);
  }

  private _dragAlongAxis3D(
    axis: AxisAndPlanes,
    event: EventAfterEventHandler,
  ): GetTranslateEvent {
    const scene = (event.map as BaseCesiumMap).getScene() as Scene;
    if (axis !== AxisAndPlanes.Z) {
      const center = mercatorToCartesian(this._transformationHandler!.center);
      let plane = Plane.clone(Plane.ORIGIN_XY_PLANE);
      plane = Plane.transform(
        plane,
        Transforms.eastNorthUpToFixedFrame(center),
        plane,
      );
      let cartographic = getCartographicFromPlane(
        plane,
        scene.camera,
        event.windowPosition,
      );
      let currentPosition = Projection.wgs84ToMercator(
        cartographicToWgs84(cartographic),
      );
      return (_c, windowPosition): TranslateEvent => {
        cartographic = getCartographicFromPlane(
          plane,
          scene.camera,
          windowPosition,
        );
        const newPosition = Projection.wgs84ToMercator(
          cartographicToWgs84(cartographic),
        );
        const translate: TranslateEvent =
          axis === AxisAndPlanes.X
            ? [newPosition[0] - currentPosition[0], 0, 0]
            : [0, newPosition[1] - currentPosition[1], 0];

        currentPosition = newPosition;
        return translate;
      };
    } else {
      const plane = createCameraVerticalPlane(
        this._transformationHandler!.center.slice(),
        scene,
      );
      let currentHeight = getCartographicFromPlane(
        plane,
        scene.camera,
        event.windowPosition,
      ).height;
      return (_c, windowPosition): TranslateEvent => {
        const newHeight = getCartographicFromPlane(
          plane,
          scene.camera,
          windowPosition,
        ).height;
        const translate: TranslateEvent = [0, 0, newHeight - currentHeight];
        currentHeight = newHeight;
        return translate;
      };
    }
  }

  private _dragAlongPlane3D(
    axis: AxisAndPlanes,
    event: EventAfterEventHandler,
  ): GetTranslateEvent {
    const scene = (event.map as BaseCesiumMap).getScene() as Scene;
    const center = mercatorToCartesian(this._transformationHandler!.center);
    let plane: Plane;
    if (axis === AxisAndPlanes.YZ) {
      plane = Plane.clone(Plane.ORIGIN_YZ_PLANE);
    } else if (axis === AxisAndPlanes.XZ) {
      plane = Plane.clone(Plane.ORIGIN_ZX_PLANE);
    } else {
      plane = Plane.clone(Plane.ORIGIN_XY_PLANE);
    }
    plane = Plane.transform(
      plane,
      Transforms.eastNorthUpToFixedFrame(center),
      plane,
    );
    let cartographic = getCartographicFromPlane(
      plane,
      scene.camera,
      event.windowPosition,
    );
    let currentPosition = Projection.wgs84ToMercator(
      cartographicToWgs84(cartographic),
    );
    return (_c, windowPosition): TranslateEvent => {
      cartographic = getCartographicFromPlane(
        plane,
        scene.camera,
        windowPosition,
      );
      const newPosition = Projection.wgs84ToMercator(
        cartographicToWgs84(cartographic),
      );

      const translate: TranslateEvent = [
        newPosition[0] - currentPosition[0],
        newPosition[1] - currentPosition[1],
        newPosition[2] - currentPosition[2],
      ];
      currentPosition = newPosition;
      return translate;
    };
  }

  private _dragAlongAxis2D(
    axis: AxisAndPlanes,
    event: EventAfterEventHandler,
  ): GetTranslateEvent {
    const center = this._transformationHandler!.center.slice();
    const mercatorExtent = mercatorProjection.proj.getExtent();
    const end =
      axis === AxisAndPlanes.X
        ? [mercatorExtent[0], center[1], center[2]]
        : [center[0], mercatorExtent[1], center[2]];

    let lastPointOnAxis = getClosestPointOn2DLine(
      center,
      end,
      event.positionOrPixel,
    );
    return (coords): TranslateEvent => {
      const newPointOnAxis = getClosestPointOn2DLine(center, end, coords);
      const translate: TranslateEvent =
        axis === AxisAndPlanes.X
          ? [newPointOnAxis[0] - lastPointOnAxis[0], 0, 0]
          : [0, newPointOnAxis[1] - lastPointOnAxis[1], 0];

      lastPointOnAxis = newPointOnAxis;
      return translate;
    };
  }

  // eslint-disable-next-line class-methods-use-this
  private _dragAlongPlane2D(
    _axis: AxisAndPlanes,
    event: EventAfterEventHandler,
  ): GetTranslateEvent {
    let current = event.positionOrPixel.slice();
    return (coords): TranslateEvent => {
      const translate: TranslateEvent = [
        coords[0] - current[0],
        coords[1] - current[1],
        0,
      ];
      current = coords.slice();
      return translate;
    };
  }

  destroy(): void {
    this._transformationHandler = null;
    this.translated.destroy();
  }
}

export default TranslateInteraction;
