import AbstractInteraction from './abstractInteraction.js';
import { EventType, ModificationKeyType } from './interactionType.js';

/**
 * @class
 * @extends {AbstractInteraction}
 */
class FeatureProviderInteraction extends AbstractInteraction {
  constructor() {
    super(EventType.CLICK, ModificationKeyType.ALL);

    this.setActive();
  }

  /**
   * @inheritDoc
   * @param {InteractionEvent} event
   * @returns {Promise<InteractionEvent>}
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
