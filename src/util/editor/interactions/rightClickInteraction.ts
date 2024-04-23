import AbstractInteraction, {
  InteractionEvent,
} from '../../../interaction/abstractInteraction.js';
import {
  EventType,
  ModificationKeyType,
  PointerKeyType,
} from '../../../interaction/interactionType.js';
import VcsEvent from '../../../vcsEvent.js';

function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default class RightClickInteraction extends AbstractInteraction {
  rightClicked = new VcsEvent<void>();

  eventChainFinished = new VcsEvent<void>();

  constructor() {
    super(EventType.CLICK, ModificationKeyType.NONE, PointerKeyType.RIGHT);
  }

  async pipe(event: InteractionEvent): Promise<InteractionEvent> {
    this.rightClicked.raiseEvent();
    event.chainEnded?.addEventListener(() => {
      this.eventChainFinished.raiseEvent();
    });
    // we need to wait a bit, otherwise the changing features in the rightClicked Event do not take effect before
    // the next interaction.
    await timeout(0);
    return event;
  }

  destroy(): void {
    this.rightClicked.destroy();
    this.eventChainFinished.destroy();
    super.destroy();
  }
}
