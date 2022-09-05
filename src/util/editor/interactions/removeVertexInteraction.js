import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import { EventType, ModificationKeyType } from '../../../interaction/interactionType.js';
import { vertexSymbol } from '../editorSymbols.js';
import VcsEvent from '../../../vcsEvent.js';

/**
 * This interaction will raise the passed in event for each feature clicked with the vertex symbol
 * @class
 * @extends {AbstractInteraction}
 */
class RemoveVertexInteraction extends AbstractInteraction {
  constructor() {
    super(EventType.CLICK, ModificationKeyType.SHIFT);
    /**
     * @type {import("@vcmap/core").VcsEvent<Vertex>}
     */
    this.vertexRemoved = new VcsEvent();
    this.setActive();
  }

  /**
   * @inheritDoc
   * @param {InteractionEvent} event
   * @returns {Promise<InteractionEvent>}
   */
  async pipe(event) {
    if (event.feature && event.feature[vertexSymbol]) {
      this.vertexRemoved.raiseEvent(/** @type {Vertex} */ (event.feature));
    }
    return event;
  }

  destroy() {
    this.vertexRemoved.destroy();
    super.destroy();
  }
}

export default RemoveVertexInteraction;
