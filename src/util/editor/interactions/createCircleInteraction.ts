import Circle from 'ol/geom/Circle.js';
import type { Coordinate } from 'ol/coordinate.js';
import AbstractInteraction, {
  EventAfterEventHandler,
} from '../../../interaction/abstractInteraction.js';
import { EventType } from '../../../interaction/interactionType.js';
import VcsEvent from '../../../vcsEvent.js';
import {
  actuallyIsCircle,
  alreadyTransformedToImage,
  alreadyTransformedToMercator,
} from '../../../layer/vectorSymbols.js';
import ObliqueMap from '../../../map/obliqueMap.js';
import type { CreateInteraction } from '../createFeatureSession.js';

/**
 * Interaction to create a circle geometry.
 * @extends {AbstractInteraction}
 * @implements {CreateInteraction<import("ol/geom").Circle>}
 */
class CreateCircleInteraction
  extends AbstractInteraction
  implements CreateInteraction<Circle>
{
  private _geometry: Circle | null = null;

  private _coordinates: Coordinate[] = [];

  private _lastCoordinate: Coordinate | null = null;

  finished = new VcsEvent<Circle | null>();

  created = new VcsEvent<Circle>();

  constructor() {
    super(EventType.CLICKMOVE | EventType.DBLCLICK);
    this.setActive();
  }

  /**
   * Sets the geometry coordinates based on the interactions coordinates
   */
  private _setCoordinates(): void {
    if (this._geometry) {
      this._geometry.setCoordinates(this._coordinates);
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
        this._geometry = new Circle(event.positionOrPixel, 20);
        this._geometry[actuallyIsCircle] = event.map instanceof ObliqueMap;
        if (event.map instanceof ObliqueMap) {
          this._geometry[alreadyTransformedToImage] = true;
        } else {
          this._geometry[alreadyTransformedToMercator] = true;
        }
        this.created.raiseEvent(this._geometry);
        this._coordinates = this._geometry.getCoordinates();
        this._lastCoordinate = this._coordinates[1];
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
    this._coordinates = [];
    this.finished.destroy();
    this.created.destroy();
    super.destroy();
  }
}

export default CreateCircleInteraction;
