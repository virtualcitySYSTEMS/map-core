import Polygon from 'ol/geom/Polygon.js';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import { EventType } from '../../../interaction/interactionType.js';
import VcsEvent from '../../../vcsEvent.js';
import { GeometryType } from '../editorSessionHelpers.js';
import { alreadyTransformedToImage } from '../../../layer/vectorSymbols.js';
import ObliqueMap from '../../../map/obliqueMap.js';

/**
 * Offset to prevent bbox from collapsing
 * @type {number}
 */
const precisionOffset = 0.000001;

/**
 * This interaction allows you to create a bounding box geometry.
 * @class
 * @extends {AbstractInteraction}
 * @implements {CreateInteraction<import("ol/geom").Polygon>}
 */
class CreateBBoxInteraction extends AbstractInteraction {
  constructor() {
    super(EventType.CLICKMOVE | EventType.DBLCLICK);

    /**
     * @type {import("ol/geom").Polygon|null}
     * @private
     */
    this._geometry = null;
    /**
     * @type {import("ol/coordinate").Coordinate|null}
     * @private
     */
    this._origin = null;
    /**
     * @type {import("ol/coordinate").Coordinate|null}
     * @private
     */
    this._lastCoordinate = null;
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
   * Sets the coordinates given the last coordinate and the current origin
   * @private
   */
  _setCoordinates() {
    if (this._geometry) {
      const originXHigher = this._origin[0] >= this._lastCoordinate[0];
      const originYHigher = this._origin[1] >= this._lastCoordinate[1];
      if (this._origin[0] === this._lastCoordinate[0]) {
        this._lastCoordinate[0] += precisionOffset;
      }
      if (this._origin[1] === this._lastCoordinate[1]) {
        this._lastCoordinate[1] += precisionOffset;
      }

      this._lastCoordinate[2] = this._origin[2];
      let ringCoordinates;
      if ((originXHigher && originYHigher) || (!originXHigher && !originYHigher)) {
        ringCoordinates = [
          this._origin,
          [this._lastCoordinate[0], this._origin[1], this._origin[2]],
          this._lastCoordinate,
          [this._origin[0], this._lastCoordinate[1], this._origin[2]],
        ];
      } else {
        ringCoordinates = [
          this._origin,
          [this._origin[0], this._lastCoordinate[1], this._origin[2]],
          this._lastCoordinate,
          [this._lastCoordinate[0], this._origin[1], this._origin[2]],
        ];
      }
      this._geometry.setCoordinates([ringCoordinates]);
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
      if (this._geometry) {
        this.finish();
      } else {
        this._geometry = new Polygon([[event.positionOrPixel.slice()]], 'XYZ');
        this._geometry.set('_vcsGeomType', GeometryType.BBox);
        this._geometry[alreadyTransformedToImage] = event.map instanceof ObliqueMap;
        this.created.raiseEvent(this._geometry);
        this._origin = event.positionOrPixel.slice();
        this._lastCoordinate = this._origin.slice();
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

export default CreateBBoxInteraction;
