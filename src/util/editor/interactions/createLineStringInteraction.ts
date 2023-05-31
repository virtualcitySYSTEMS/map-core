import LineString from 'ol/geom/LineString.js';
import type { Coordinate } from 'ol/coordinate.js';
import AbstractInteraction, {
  EventAfterEventHandler,
} from '../../../interaction/abstractInteraction.js';
import { EventType } from '../../../interaction/interactionType.js';
import VcsEvent from '../../../vcsEvent.js';
import {
  alreadyTransformedToImage,
  alreadyTransformedToMercator,
} from '../../../layer/vectorSymbols.js';
import ObliqueMap from '../../../map/obliqueMap.js';
import { CreateInteraction } from '../createFeatureSession.js';

/**
 * @extends {AbstractInteraction}
 * @implements {CreateInteraction<import("ol/geom").LineString>}
 */
class CreateLineStringInteraction
  extends AbstractInteraction
  implements CreateInteraction<LineString>
{
  private _geometry: LineString | null = null;

  private _coordinates: Coordinate[] = [];

  private _lastCoordinate: Coordinate | null = null;

  finished = new VcsEvent<LineString | null>();

  created = new VcsEvent<LineString>();

  constructor() {
    super(EventType.CLICKMOVE | EventType.DBLCLICK);
    this.setActive();
  }

  /**
   * Sets the coordiantes on the geometry
   * @private
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
      if (!this._geometry) {
        this._geometry = new LineString([event.positionOrPixel], 'XYZ');
        if (event.map instanceof ObliqueMap) {
          this._geometry[alreadyTransformedToImage] = true;
        } else {
          this._geometry[alreadyTransformedToMercator] = true;
        }
        this.created.raiseEvent(this._geometry);
        this._coordinates = [event.positionOrPixel.slice()];
        this._lastCoordinate = this._coordinates[0].slice();
        this._coordinates.push(this._lastCoordinate);
      } else {
        this._lastCoordinate = [...(this._lastCoordinate as Coordinate)];
        this._coordinates.push(this._lastCoordinate);
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
      this._coordinates.pop();
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

export default CreateLineStringInteraction;
