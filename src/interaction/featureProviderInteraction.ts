import type { Coordinate } from 'ol/coordinate.js';

import Point from 'ol/geom/Point.js';
import Feature from 'ol/Feature.js';
import AbstractInteraction, {
  type InteractionEvent,
} from './abstractInteraction.js';
import {
  EventType,
  ModificationKeyType,
  PointerKeyType,
} from './interactionType.js';
import {
  isProvidedClusterFeature,
  isProvidedFeature,
} from '../featureProvider/featureProviderSymbols.js';

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
    if (event.feature) {
      return event;
    }

    const layersWithProvider = [...event.map.layerCollection]
      .filter((l) => {
        return (
          l.featureProvider &&
          l.active &&
          l.isSupported(event.map) &&
          l.featureProvider.isSupported(event.map)
        );
      })
      .reverse();

    if (layersWithProvider.length > 0) {
      const resolution = event.map.getCurrentResolution(
        event.position as Coordinate,
      );
      // TODO make sure the layers are rendered, check min/max RenderingResolution
      const features = (
        await Promise.all(
          layersWithProvider.map(
            (l) =>
              l.featureProvider?.getFeaturesByCoordinate?.(
                event.position as Coordinate,
                resolution,
                l.headers,
              ),
          ),
        )
      )
        .filter((f) => !!f)
        .flat();
      if (features.length === 1) {
        event.feature = features[0];
      } else if (features.length > 1) {
        const feature = new Feature({ features });
        feature[isProvidedFeature] = true; // backward compatibility, may remove in future
        feature[isProvidedClusterFeature] = true;
        feature.setGeometry(new Point(event.position as Coordinate));
        event.feature = feature;
      }
    }

    return event;
  }
}

export default FeatureProviderInteraction;
