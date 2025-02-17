import AbstractInteraction, {
  EventAfterEventHandler,
} from '../../../interaction/abstractInteraction.js';
import {
  EventType,
  ModificationKeyType,
} from '../../../interaction/interactionType.js';
import VcsEvent from '../../../vcsEvent.js';
import { isVertex, Vertex } from '../editorHelpers.js';
import { emptyStyle } from '../../../style/styleHelpers.js';

/**
 * Class to translate a vertex. Will call the passed in vertex changed event with the changed vertex.
 * Will modify the vertex in place
 */
class TranslateVertexInteraction extends AbstractInteraction {
  readonly vertexChanged = new VcsEvent<Vertex>();

  private _vertex: Vertex | null = null;

  constructor() {
    super(
      EventType.DRAGEVENTS,
      ModificationKeyType.NONE | ModificationKeyType.CTRL,
    );
    this.setActive();
  }

  pipe(event: EventAfterEventHandler): Promise<EventAfterEventHandler> {
    if (this._vertex) {
      this._vertex.getGeometry()!.setCoordinates(event.positionOrPixel);
      this.vertexChanged.raiseEvent(this._vertex);

      if (event.type & EventType.DRAGEND) {
        const vertex = this._vertex;
        setTimeout(() => {
          // timeout to avoid picking the vertex in pickFromRay on the next pass
          vertex.setStyle(undefined);
        });
        this._vertex = null;
      }
    } else if (event.type & EventType.DRAGSTART && isVertex(event.feature)) {
      this._vertex = event.feature;
      this._vertex.setStyle(emptyStyle);
    }
    return Promise.resolve(event);
  }

  destroy(): void {
    this.vertexChanged.destroy();
    super.destroy();
  }
}

export default TranslateVertexInteraction;
