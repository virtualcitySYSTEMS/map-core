import Circle from 'ol/geom/Circle.js';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import { EventType } from '../../../interaction/interactionType.js';
import VcsEvent from '../../../vcsEvent.js';
import {
  actuallyIsCircle,
  alreadyTransformedToImage,
  alreadyTransformedToMercator,
} from '../../../layer/vectorSymbols.js';
import ObliqueMap from '../../../map/obliqueMap.js';

/**
 * Interaction to create a circle geometry.
 * @class
 * @extends {AbstractInteraction}
 * @implements {CreateInteraction<import("ol/geom").Circle>}
 */
class CreateCircleInteraction extends AbstractInteraction {
  constructor() {
    super(EventType.CLICKMOVE | EventType.DBLCLICK);

    /**
     * @type {import("ol/geom").Circle|null}
     * @private
     */
    this._geometry = null;
    /**
     * @type {import("ol/coordinate").Coordinate|null}
     * @private
     */
    this._lastCoordinate = null;
    /**
     * @type {Array<import("ol/coordinate").Coordinate>}
     * @private
     */
    this._coordinates = [];
    /**
     * @type {VcsEvent<import("ol/geom").Circle|null>}
     */
    this.finished = new VcsEvent();
    /**
     * @type {VcsEvent<import("ol/geom").Circle>}
     */
    this.created = new VcsEvent();
    this.setActive();
  }

  /**
   * Sets the geometry coordinates based on the interactions coordinates
   * @private
   */
  _setCoordinates() {
    if (this._geometry) {
      this._geometry.setCoordinates(this._coordinates);
    }
  }

  /**
   * @param {InteractionEvent} event
   * @returns {Promise<InteractionEvent>}
   * @inheritDoc
   */
  async pipe(event) {
    if (event.type & EventType.CLICKMOVE && this._geometry) {
      this._lastCoordinate.splice(
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
        this._geometry = new Circle(event.positionOrPixel, 20, 'XYZ');
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
    return event;
  }

  /**
   * Finish the current creation. Calls finish and sets the interaction to be inactive
   */
  finish() {
    if (this.active !== EventType.NONE) {
      this._setCoordinates();
      this.setActive(false);
      this.finished.raiseEvent(this._geometry);
    }
  }

  /**
   * @inheritDoc
   */
  destroy() {
    this._geometry = null;
    this._coordinates = [];
    this.finished.destroy();
    this.created.destroy();
    super.destroy();
  }
}

export default CreateCircleInteraction;
