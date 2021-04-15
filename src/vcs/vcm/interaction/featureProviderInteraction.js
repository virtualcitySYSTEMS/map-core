import AbstractInteraction from './abstractInteraction.js';
import { EventType, ModificationKeyType } from './interactionType.js';

/**
 * @class
 * @extends {vcs.vcm.interaction.AbstractInteraction}
 * @memberOf vcs.vcm.interaction
 */
class FeatureProviderInteraction extends AbstractInteraction {
  constructor() {
    super();
    /**
     * @inheritDoc
     * @type {vcs.vcm.interaction.ModificationKeyType|number}
     * @protected
     */
    this._defaultModificationKey = ModificationKeyType.ALL;
    /**
     * @inheritDoc
     * @type {vcs.vcm.interaction.ModificationKeyType|number}
     * @protected
     */
    this._defaultActive = EventType.CLICK;
    this.setActive();
  }

  /**
   * @inheritDoc
   * @param {vcs.vcm.interaction.Event} event
   * @returns {Promise.<vcs.vcm.interaction.Event>}
   */
  // eslint-disable-next-line class-methods-use-this
  async pipe(event) {
    if (!event.feature) {
      const layersWithProvider = [...event.map.layerCollection]
        .filter((l) => {
          return l.featureProvider && l.active && l.isSupported(event.map) && l.featureProvider.isSupported(event.map);
        });

      if (layersWithProvider.length > 0) {
        const resolution = event.map.getCurrentResolution(event.position);
        const features = (await Promise
          .all(layersWithProvider.map(l => l.featureProvider.getFeaturesByCoordinate(event.position, resolution))))
          .flat();

        if (features.length > 0) {
          event.feature = features[0];
        }
      }
    }
    return event;
  }
}

export default FeatureProviderInteraction;
