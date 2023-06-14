import AbstractInteraction, {
  type InteractionEvent,
} from './abstractInteraction.js';
import {
  EventType,
  ModificationKeyType,
  PointerKeyType,
} from './interactionType.js';

/**
 * @group Interaction
 */
class InteractionChain extends AbstractInteraction {
  /**
   * The interactions to handle one after the other
   */
  chain: AbstractInteraction[];

  constructor(chain?: AbstractInteraction[]) {
    super(EventType.ALL, ModificationKeyType.ALL, PointerKeyType.ALL);

    this.chain = chain || [];
    this.setActive();
  }

  /**
   * Add an interaction to the chain. Optionally passing an index where to add the interaction to.
   */
  addInteraction(interaction: AbstractInteraction, index?: number): void {
    if (index != null) {
      this.chain.splice(index, 0, interaction);
    } else {
      this.chain.push(interaction);
    }
  }

  /**
   * Removes an interaction from the chain, returning the index from which it was removed
   */
  removeInteraction(interaction: AbstractInteraction): number {
    const index = this.chain.findIndex(
      (candidate) => candidate.id === interaction.id,
    );
    if (index > -1) {
      this.chain.splice(index, 1);
    }
    return index;
  }

  async pipe(event: InteractionEvent): Promise<InteractionEvent> {
    let pipedEvent = event;
    const chain = this.chain.slice();
    const chainLength = chain.length;
    for (let i = 0; i < chainLength; i++) {
      const interaction = chain[i];
      if (
        interaction.active & event.type &&
        interaction.modificationKey & event.key &&
        interaction.pointerKey & event.pointer
      ) {
        // eslint-disable-next-line no-await-in-loop
        pipedEvent = await interaction.pipe(pipedEvent);
        if (pipedEvent.stopPropagation) {
          break;
        }
      }
    }
    return pipedEvent;
  }

  modifierChanged(modifier: ModificationKeyType): void {
    this.chain
      .filter((i) => i.active !== EventType.NONE)
      .forEach((i) => {
        i.modifierChanged(modifier);
      });
  }

  /**
   * You cannot set the modification of an interaction chain, only of its containing interactions
   */
  setModification(): void {
    super.setModification();
  }

  /**
   * You cannot set the pointer of an interaction chain, only of its containing interactions
   */
  setPointer(): void {
    super.setPointer();
  }

  destroy(): void {
    this.chain.forEach((i) => {
      i.destroy();
    });
    this.chain = [];
    super.destroy();
  }
}

export default InteractionChain;
