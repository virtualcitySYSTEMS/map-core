import AbstractInteraction, {
  EventAfterEventHandler,
} from '../../../interaction/abstractInteraction.js';
import {
  EventType,
  ModificationKeyType,
} from '../../../interaction/interactionType.js';
import { vertexSymbol } from '../editorSymbols.js';
import VcsEvent from '../../../vcsEvent.js';
import type { Vertex } from '../editorHelpers.js';

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
    if (event.feature && (event.feature as Vertex)[vertexSymbol]) {
      this.vertexRemoved.raiseEvent(event.feature as Vertex);
    }
    return Promise.resolve(event);
  }

  destroy(): void {
    this.vertexRemoved.destroy();
    super.destroy();
  }
}

export default RemoveVertexInteraction;
