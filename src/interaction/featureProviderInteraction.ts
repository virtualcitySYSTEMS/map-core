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
 * @group Interaction
 */
class FeatureProviderInteraction extends AbstractInteraction {
  constructor() {
    super(EventType.CLICK, ModificationKeyType.ALL, PointerKeyType.ALL);

    this.setActive();
  }

  // eslint-disable-next-line class-methods-use-this
  async pipe(event: InteractionEvent): Promise<InteractionEvent> {
    if (!event.feature) {
      const layersWithProvider = [...event.map.layerCollection].filter((l) => {
        return (
          l.featureProvider &&
          l.active &&
          l.isSupported(event.map) &&
          l.featureProvider.isSupported(event.map)
        );
      });

      if (layersWithProvider.length > 0) {
        const resolution = event.map.getCurrentResolution(
          event.position as Coordinate,
        );
        const features = (
          await Promise.all(
            layersWithProvider.map((l) =>
              l.featureProvider?.getFeaturesByCoordinate?.(
                event.position as Coordinate,
                resolution,
              ),
            ),
          )
        ).flat();

        if (features.length > 0) {
          event.feature = features[0];
        }
      }
    }
    return event;
  }
}

export default FeatureProviderInteraction;
