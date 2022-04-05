import AbstractInteraction from './abstractInteraction.js';
import { EventType, ModificationKeyType, PointerKeyType } from './interactionType.js';

/**
 * @class
 * @extends {AbstractInteraction}
 * @export
 */
class InteractionChain extends AbstractInteraction {
  /**
   * @param {Array<AbstractInteraction>=} chain
   */
  constructor(chain) {
    super(EventType.ALL, ModificationKeyType.ALL, PointerKeyType.ALL);
    /**
     * The interactions to handle one after the other
     * @type {Array<AbstractInteraction>}
     * @api
     */
    this.chain = chain || [];
    this.setActive();
  }

  /**
   * Add an interaction to the chain. Optionally passing an index where to add the interaction to.
   * @param {AbstractInteraction} interaction
   * @param {number=} index
   * @api
   */
  addInteraction(interaction, index) {
    if (index != null) {
      this.chain.splice(index, 0, interaction);
    } else {
      this.chain.push(interaction);
    }
  }

  /**
   * Removes an interaction from the chain, returning the index from which it was removed
   * @param {AbstractInteraction} interaction
   * @returns {number}
   * @api
   */
  removeInteraction(interaction) {
    const index = this.chain.findIndex(candidate => candidate.id === interaction.id);
    if (index > -1) {
      this.chain.splice(index, 1);
    }
    return index;
  }

  /**
   * @inheritDoc
   * @param {InteractionEvent} event
   * @returns {Promise<InteractionEvent>}
   */
  async pipe(event) {
    let pipedEvent = event;
    const chainLength = this.chain.length;
    for (let i = 0; i < chainLength; i++) {
      const interaction = this.chain[i];
      if (
        (interaction.active & event.type) &&
        (interaction.modificationKey & event.key) &&
        (interaction.pointerKey & event.pointer)
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

  /**
   * You cannot set the modification of an interaction chain, only of its containing interactions
   * @override
   */
  setModification() {
    super.setModification();
  }

  /**
   * You cannot set the pointer of an interaction chain, only of its containing interactions
   * @override
   */
  setPointer() {
    super.setPointer();
  }

  /**
   * @inheritDoc
   */
  destroy() {
    this.chain.forEach((i) => { i.destroy(); });
    this.chain = [];
    super.destroy();
  }
}

export default InteractionChain;

