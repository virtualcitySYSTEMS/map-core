import Polygon from 'ol/geom/Polygon.js';
import type { Coordinate } from 'ol/coordinate.js';

import AbstractInteraction, {
  type EventAfterEventHandler,
} from '../../../interaction/abstractInteraction.js';
import { EventType } from '../../../interaction/interactionType.js';
import VcsEvent from '../../../vcsEvent.js';
import { GeometryType } from '../editorSessionHelpers.js';
import {
  alreadyTransformedToImage,
  alreadyTransformedToMercator,
} from '../../../layer/vectorSymbols.js';
import ObliqueMap from '../../../map/obliqueMap.js';
import type { CreateInteraction } from '../createFeatureSession.js';
import { is2DLayout } from '../../geometryHelpers.js';

/**
 * Offset to prevent bbox from collapsing
 */
const precisionOffset = 0.000001;

/**
 * This interaction allows you to create a bounding box geometry.
 */
class CreateBBoxInteraction
  extends AbstractInteraction
  implements CreateInteraction<Polygon>
{
  private _geometry: Polygon | null = null;

  private _origin: Coordinate | null = null;

  private _lastCoordinate: Coordinate | null = null;

  private _is3D = false;

  finished = new VcsEvent<Polygon | null>();

  created = new VcsEvent<Polygon>();

  constructor() {
    super(EventType.CLICKMOVE | EventType.DBLCLICK);
    this.setActive();
  }

  /**
   * Sets the coordinates given the last coordinate and the current origin
   * @private
   */
  private _setCoordinates(): void {
    if (this._geometry && this._origin && this._lastCoordinate) {
      const originXHigher = this._origin[0] >= this._lastCoordinate[0];
      const originYHigher = this._origin[1] >= this._lastCoordinate[1];
      if (this._origin[0] === this._lastCoordinate[0]) {
        this._lastCoordinate[0] += precisionOffset;
      }
      if (this._origin[1] === this._lastCoordinate[1]) {
        this._lastCoordinate[1] += precisionOffset;
      }

      if (this._is3D) {
        this._lastCoordinate[2] = this._origin[2];
      }

      let lowerRight: Coordinate;
      let upperLeft: Coordinate;

      if (
        (originXHigher && originYHigher) ||
        (!originXHigher && !originYHigher)
      ) {
        lowerRight = [this._lastCoordinate[0], this._origin[1]];
        upperLeft = [this._origin[0], this._lastCoordinate[1]];
      } else {
        lowerRight = [this._origin[0], this._lastCoordinate[1]];
        upperLeft = [this._lastCoordinate[0], this._origin[1]];
      }

      if (this._is3D) {
        lowerRight.push(this._origin[2]);
        upperLeft.push(this._origin[2]);
      }

      this._geometry.setCoordinates([
        [this._origin, lowerRight, this._lastCoordinate, upperLeft],
      ]);
    }
  }

  pipe(event: EventAfterEventHandler): Promise<EventAfterEventHandler> {
    if (event.type & EventType.CLICKMOVE && this._geometry) {
      this._lastCoordinate!.splice(
        0,
        event.positionOrPixel.length,
        ...event.positionOrPixel,
      );
      this._setCoordinates();
    }

    if (event.type & EventType.CLICK) {
      if (this._geometry) {
        this.finish();
      } else {
        this._geometry = new Polygon([[event.positionOrPixel.slice()]]);
        this._geometry.set('_vcsGeomType', GeometryType.BBox);
        this._is3D = !is2DLayout(this._geometry.getLayout());
        if (event.map instanceof ObliqueMap) {
          this._geometry[alreadyTransformedToImage] = true;
        } else {
          this._geometry[alreadyTransformedToMercator] = true;
        }
        this.created.raiseEvent(this._geometry);
        this._origin = event.positionOrPixel.slice();
        this._lastCoordinate = this._origin.slice();
      }
    }

    if (event.type & EventType.DBLCLICK) {
      this.finish();
    }
    return Promise.resolve(event);
  }

  /**
   * Finish the current creation. Calls finish and sets the interaction to be inactive
   */
  finish(): void {
    if (this.active !== EventType.NONE) {
      this._setCoordinates();
      this.setActive(false);
      this.finished.raiseEvent(this._geometry);
    }
  }

  destroy(): void {
    this._geometry = null;
    this.finished.destroy();
    this.created.destroy();
    super.destroy();
  }
}

export default CreateBBoxInteraction;
