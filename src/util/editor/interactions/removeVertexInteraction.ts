import type { EventAfterEventHandler } from '../../../interaction/abstractInteraction.js';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import {
  EventType,
  ModificationKeyType,
} from '../../../interaction/interactionType.js';
import VcsEvent from '../../../vcsEvent.js';
import type { Vertex } from '../editorHelpers.js';
import { isVertex } from '../editorHelpers.js';

/**
 * This interaction will raise the passed in event for each feature clicked with the vertex symbol
 * @extends {AbstractInteraction}
 */
class RemoveVertexInteraction extends AbstractInteraction {
  vertexRemoved = new VcsEvent<Vertex>();

  constructor() {
    super(EventType.CLICK, ModificationKeyType.SHIFT);
    this.setActive();
  }

  pipe(event: EventAfterEventHandler): Promise<EventAfterEventHandler> {
    if (isVertex(event.feature)) {
      this.vertexRemoved.raiseEvent(event.feature);
    }
    return Promise.resolve(event);
  }

  destroy(): void {
    this.vertexRemoved.destroy();
    super.destroy();
  }
}

export default RemoveVertexInteraction;
