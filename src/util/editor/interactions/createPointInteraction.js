import Point from 'ol/geom/Point.js';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import VcsEvent from '../../../vcsEvent.js';
import { EventType } from '../../../interaction/interactionType.js';
import {
  alreadyTransformedToImage,
  alreadyTransformedToMercator,
} from '../../../layer/vectorSymbols.js';
import ObliqueMap from '../../../map/obliqueMap.js';

/**
 * @class
 * @extends {AbstractInteraction}
 * @implements {CreateInteraction<import("ol/geom").Point>}
 */
class CreatePointInteraction extends AbstractInteraction {
  constructor() {
    super(EventType.CLICK);

    /**
     * @type {VcsEvent<import("ol/geom").Point|null>}
     */
    this.finished = new VcsEvent();
    /**
     * @type {VcsEvent<import("ol/geom").Point>}
     */
    this.created = new VcsEvent();
    /**
     * @type {import("ol/geom").Point}
     * @private
     */
    this._geometry = null;
    this.setActive();
  }

  /**
   * @param {InteractionEvent} event
   * @returns {Promise<InteractionEvent>}
   * @inheritDoc
   */
  async pipe(event) {
    this._geometry = new Point(event.positionOrPixel, 'XYZ');
    if (event.map instanceof ObliqueMap) {
      this._geometry[alreadyTransformedToImage] = true;
    } else {
      this._geometry[alreadyTransformedToMercator] = true;
    }
    this.created.raiseEvent(this._geometry);
    this.finish();
    return event;
  }

  /**
   * Finish the current creation. Calls finish and sets the interaction to be inactive
   */
  finish() {
    if (this.active !== EventType.NONE) {
      this.setActive(false);
      this.finished.raiseEvent(this._geometry);
    }
  }

  /**
   * @inheritDoc
   */
  destroy() {
    this.finished.destroy();
    this.created.destroy();
    super.destroy();
  }
}

export default CreatePointInteraction;
