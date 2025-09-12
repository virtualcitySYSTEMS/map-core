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
 */
class EnsurePositionInteraction extends AbstractInteraction {
  constructor() {
    super(EventType.ALL, ModificationKeyType.ALL, PointerKeyType.ALL);

    this.setActive();
  }

  // eslint-disable-next-line class-methods-use-this
  pipe(event: InteractionEvent): Promise<InteractionEvent> {
    event.stopPropagation = !event.position;
    return Promise.resolve(event);
  }
}

export default EnsurePositionInteraction;
