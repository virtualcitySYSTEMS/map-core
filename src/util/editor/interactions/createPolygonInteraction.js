import { Polygon } from 'ol/geom.js';
import GeometryLayout from 'ol/geom/GeometryLayout.js';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import { EventType } from '../../../interaction/interactionType.js';
import VcsEvent from '../../../vcsEvent.js';
import { alreadyTransformedToImage } from '../../../layer/vectorSymbols.js';
import ObliqueMap from '../../../map/obliqueMap.js';

/**
 * @class
 * @extends {AbstractInteraction}
 * @implements {CreateInteraction<import("ol/geom").Polygon>}
 */
class CreatePolygonInteraction extends AbstractInteraction {
  constructor() {
    super(EventType.CLICKMOVE | EventType.DBLCLICK);

    /**
     * @type {import("ol/geom").Polygon|null}
     * @private
     */
    this._geometry = null;
    /**
     * @type {Array<import("ol/coordinate").Coordinate>}
     * @private
     */
    this._coordinates = [];
    /**
     * @type {import("ol/coordinate").Coordinate|null}
     * @private
     */
    this._lastCoordinate = null;
    /**
     * This coordinate is added together with the first click to ensure a valid geometry
     * so the user has feedback. On the second click, this coordinate gets sliced to no longer be in
     * sync with the last coordinate.
     * @type {import("ol/coordinate").Coordinate|null}
     * @private
     */
    this._validityPlaceHolder = null;
    /**
     * @type {VcsEvent<import("ol/geom").Polygon|null>}
     */
    this.finished = new VcsEvent();
    /**
     * @type {VcsEvent<import("ol/geom").Polygon>}
     */
    this.created = new VcsEvent();
    this.setActive();
  }

  /**
   * Sets the coordiantes on the geometry
   * @private
   */
  _setCoordinates() {
    if (this._geometry) {
      this._geometry.setCoordinates([this._coordinates]);
    }
  }

  /**
   * @param {InteractionEvent} event
   * @returns {Promise<InteractionEvent>}
   * @inheritDoc
   */
  async pipe(event) {
    if (event.type & EventType.CLICKMOVE && this._geometry) {
      this._lastCoordinate.splice(0, event.positionOrPixel.length, ...event.positionOrPixel);
      this._setCoordinates();
    }

    if (event.type & EventType.CLICK) {
      if (!this._geometry) {
        this._geometry = new Polygon([[event.positionOrPixel.slice()]], GeometryLayout.XYZ);
        this._geometry[alreadyTransformedToImage] = event.map instanceof ObliqueMap;
        this.created.raiseEvent(this._geometry);
        this._coordinates = [event.positionOrPixel.slice()];
        this._lastCoordinate = [...event.positionOrPixel];
        this._validityPlaceHolder = event.positionOrPixel.slice();
        this._coordinates.push(this._lastCoordinate);
        this._coordinates.push(this._validityPlaceHolder);
      } else if (this._validityPlaceHolder) {
        this._lastCoordinate = [...this._lastCoordinate];
        this._coordinates.splice(2, 1, this._lastCoordinate);
        this._validityPlaceHolder = null;
      } else {
        this._lastCoordinate = [...this._lastCoordinate];
        this._coordinates.push(this._lastCoordinate);
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
      this._coordinates.pop();
      if (this._validityPlaceHolder) {
        this._coordinates.pop();
      }
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

export default CreatePolygonInteraction;