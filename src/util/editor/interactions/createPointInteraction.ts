import Point from 'ol/geom/Point.js';
import type { EventAfterEventHandler } from '../../../interaction/abstractInteraction.js';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import VcsEvent from '../../../vcsEvent.js';
import { EventType } from '../../../interaction/interactionType.js';
import {
  alreadyTransformedToImage,
  alreadyTransformedToMercator,
} from '../../../layer/vectorSymbols.js';
import ObliqueMap from '../../../map/obliqueMap.js';
import type { CreateInteraction } from '../createFeatureSession.js';

/**
 * @extends {AbstractInteraction}
 * @implements {CreateInteraction<import("ol/geom").Point>}
 */
class CreatePointInteraction
  extends AbstractInteraction
  implements CreateInteraction<Point>
{
  private _geometry: Point | null = null;

  finished = new VcsEvent<Point | null>();

  created = new VcsEvent<Point>();

  constructor() {
    super(EventType.CLICK);
    this.setActive();
  }

  pipe(event: EventAfterEventHandler): Promise<EventAfterEventHandler> {
    this._geometry = new Point(event.positionOrPixel);
    if (event.map instanceof ObliqueMap) {
      this._geometry[alreadyTransformedToImage] = true;
    } else {
      this._geometry[alreadyTransformedToMercator] = true;
    }
    this.created.raiseEvent(this._geometry);
    this.finish();
    return Promise.resolve(event);
  }

  /**
   * Finish the current creation. Calls finish and sets the interaction to be inactive
   */
  finish(): void {
    if (this.active !== EventType.NONE) {
      this.setActive(false);
      this.finished.raiseEvent(this._geometry);
    }
  }

  destroy(): void {
    this.finished.destroy();
    this.created.destroy();
    super.destroy();
  }
}

export default CreatePointInteraction;
