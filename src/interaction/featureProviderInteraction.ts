import { parseBoolean } from '@vcsuite/parsers';
import type { Coordinate } from 'ol/coordinate.js';
import Point from 'ol/geom/Point.js';
import Feature from 'ol/Feature.js';
import AbstractInteraction, {
  type EventFeature,
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
import AbstractFeatureProvider from '../featureProvider/abstractFeatureProvider.js';
import { vcsLayerName } from '../layer/layerSymbols.js';
import CompositeFeatureProvider from '../featureProvider/compositeFeatureProvider.js';
import AbstractAttributeProvider from '../featureProvider/abstractAttributeProvider.js';

type FeatureProviderInteractionOptions = {
  /**
   * Whether to respect the rendering order of features. Defaults to false, but when set to true and `inRenderingOrder` is set to true on the FeatureProvider as well, only the first feature will be returned.
   * Used for MapboxFeatureProvider, to return only the top most feature on picking (respectRenderingOrder set to true in EventHandler), but return all the features for deep picking (respectRenderingOrder set to false in DeepPicking action)
   */
  respectRenderingOrder?: boolean;
};

/**
 * @group Interaction
 */
class FeatureProviderInteraction extends AbstractInteraction {
  static getDefaultOptions(): FeatureProviderInteractionOptions {
    return {
      respectRenderingOrder: false,
    };
  }

  private _respectRenderingOrder: boolean;
  constructor(options?: FeatureProviderInteractionOptions) {
    super(EventType.CLICK, ModificationKeyType.ALL, PointerKeyType.ALL);

    const defaultOptions = FeatureProviderInteraction.getDefaultOptions();

    this._respectRenderingOrder = parseBoolean(
      options?.respectRenderingOrder,
      defaultOptions.respectRenderingOrder,
    );

    this.setActive();
  }

  async pipe(event: InteractionEvent): Promise<InteractionEvent> {
    if (!event.feature) {
      const layersWithProvider = [...event.map.layerCollection]
        .filter((l) => {
          return (
            l.featureProvider instanceof AbstractFeatureProvider &&
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
            layersWithProvider.map(async (l) => {
              const featureProvider =
                l.featureProvider as AbstractFeatureProvider;
              const f = await featureProvider.getFeaturesByCoordinate?.(
                event.position as Coordinate,
                resolution,
                l,
              );
              if (
                this._respectRenderingOrder &&
                featureProvider.inRenderingOrder
              ) {
                return f.slice(0, 1);
              }
              return f;
            }),
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
    }

    if (event.feature) {
      const features = (event.feature as Feature)[isProvidedClusterFeature]
        ? ((event.feature as Feature).get('features') as EventFeature[])
        : [event.feature];

      const promises = features.map(async (feature) => {
        const layer = event.map.layerCollection.getByKey(feature[vcsLayerName]);
        if (
          layer?.featureProvider instanceof AbstractAttributeProvider ||
          layer?.featureProvider instanceof CompositeFeatureProvider
        ) {
          await layer.featureProvider.augmentFeature(feature);
        }
      });
      await Promise.all(promises);
    }

    return event;
  }
}

export default FeatureProviderInteraction;
