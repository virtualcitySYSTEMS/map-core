import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import { EventType } from '../../../interaction/interactionType.js';
import { vertexSymbol } from '../editorSymbols.js';
import { emptyStyle } from '../../../style/styleHelpers.js';
import VcsEvent from '../../../vcsEvent.js';

/**
 * Class to translate a vertex. Will call the passed in vertex changed event with the changed vertex.
 * Will modify the vertex in place
 * @class
 * @extends {AbstractInteraction}
 */
class TranslateVertexInteraction extends AbstractInteraction {
  constructor() {
    super(EventType.DRAGEVENTS);
    /**
     * @type {import("@vcmap/core").VcsEvent<Vertex>}
     */
    this.vertexChanged = new VcsEvent();
    /**
     * @type {Vertex|null}
     * @private
     */
    this._vertex = null;
    this.setActive();
  }

  /**
   * @inheritDoc
   * @param {InteractionEvent} event
   * @returns {Promise<InteractionEvent>}
   */
  async pipe(event) {
    if (this._vertex) {
      this._vertex.getGeometry().setCoordinates(event.positionOrPixel);
      this.vertexChanged.raiseEvent(this._vertex);

      if (event.type & EventType.DRAGEND) {
        this._vertex.setStyle(null);
        this._vertex = null;
      }
      event.stopPropagation = true;
    } else if (
      event.type & EventType.DRAGSTART &&
      event.feature &&
      event.feature[vertexSymbol]
    ) {
      this._vertex = /** @type {Vertex} */ (event.feature);
      this._vertex.setStyle(emptyStyle);
      event.stopPropagation = true;
    }
    return event;
  }

  destroy() {
    this.vertexChanged.destroy();
    super.destroy();
  }
}

export default TranslateVertexInteraction;
