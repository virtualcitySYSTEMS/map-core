import type { Coordinate } from 'ol/coordinate.js';
import AbstractInteraction, {
  type InteractionEvent,
} from './abstractInteraction.js';
import {
  EventType,
  ModificationKeyType,
  PointerKeyType,
} from './interactionType.js';

/**
 * An interaction that ensures events without a position are stopped.
 * It will set event.stopPropagation = true if event.position is undefined.
 * Furthermore, it ensures the integrity of drag events by: a) remembering the last position
 * on DRAGSTART and reusing it on DRAGEND if no position is provided and b) stopping propagation of drag events, if
 * drag start did not provide a position.
 */
class EnsurePositionInteraction extends AbstractInteraction {
  private _lastDragPosition: Coordinate | undefined;

  constructor() {
    super(EventType.ALL, ModificationKeyType.ALL, PointerKeyType.ALL);

    this.setActive();
  }

  pipe(event: InteractionEvent): Promise<InteractionEvent> {
    if (event.type & EventType.DRAGSTART) {
      this._lastDragPosition = event.position?.slice();
    } else if (event.type & EventType.DRAG) {
      if (this._lastDragPosition && event.position) {
        this._lastDragPosition = event.position.slice();
      } else if (!this._lastDragPosition) {
        event.stopPropagation = true;
      }
    } else if (event.type & EventType.DRAGEND) {
      if (this._lastDragPosition && !event.position) {
        event.position = this._lastDragPosition;
      } else if (!this._lastDragPosition) {
        event.stopPropagation = true;
      }
      this._lastDragPosition = undefined;
    }

    event.stopPropagation = event.stopPropagation || !event.position;
    return Promise.resolve(event);
  }
}

export default EnsurePositionInteraction;
