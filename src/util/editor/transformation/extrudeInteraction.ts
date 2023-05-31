import type { Cartesian2, Scene } from '@vcmap-cesium/engine';
import type { Feature } from 'ol/index.js';
import type { Coordinate } from 'ol/coordinate.js';

import AbstractInteraction, {
  EventAfterEventHandler,
} from '../../../interaction/abstractInteraction.js';
import { EventType } from '../../../interaction/interactionType.js';
import { handlerSymbol } from '../editorSymbols.js';
import {
  createCameraVerticalPlane,
  getCartographicFromPlane,
} from '../editorHelpers.js';
import VcsEvent from '../../../vcsEvent.js';
import { AxisAndPlanes, TransformationHandler } from './transformationTypes.js';
import type CesiumMap from '../../../map/cesiumMap.js';

/**
 * A class to handle events on a {@link TransformationHandler}. Should be used with {@link TransformationHandler} created for mode TransformationMode.EXTRUDE.
 * If the Z handler is dragged, the extruded event will be raised with a delta in Z direction. This
 * interaction only works if a {@link CesiumMap} is the active map.
 */
class ExtrudeInteraction extends AbstractInteraction {
  private _transformationHandler: TransformationHandler | null;

  private _getExtrudeEvent:
    | null
    | ((coord: Coordinate, windowPosition: Cartesian2) => number) = null;

  /**
   * Event raised with the extrusion delta to the last event fired.
   */
  readonly extruded = new VcsEvent<number>();

  constructor(transformationHandler: TransformationHandler) {
    super(EventType.DRAGEVENTS);
    this._transformationHandler = transformationHandler;
  }

  pipe(event: EventAfterEventHandler): Promise<EventAfterEventHandler> {
    if (this._getExtrudeEvent) {
      this.extruded.raiseEvent(
        this._getExtrudeEvent(event.positionOrPixel, event.windowPosition),
      );
      if (event.type === EventType.DRAGEND) {
        this._getExtrudeEvent = null;
        this._transformationHandler!.showAxis = AxisAndPlanes.NONE;
      }
    } else if (
      event.type === EventType.DRAGSTART &&
      (event?.feature as Feature)?.[handlerSymbol]
    ) {
      const axis = (event.feature as Feature)[handlerSymbol];
      if (axis === AxisAndPlanes.Z) {
        const scene = (event.map as CesiumMap).getScene() as Scene;
        this._transformationHandler!.showAxis = axis;
        const plane = createCameraVerticalPlane(
          this._transformationHandler!.center.slice(),
          scene,
        );
        let currentHeight = getCartographicFromPlane(
          plane,
          scene.camera,
          event.windowPosition,
        ).height;
        this._getExtrudeEvent = (_c, windowPosition): number => {
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
    return Promise.resolve(event);
  }

  destroy(): void {
    this._transformationHandler = null;
    this.extruded.destroy();
  }
}

export default ExtrudeInteraction;
