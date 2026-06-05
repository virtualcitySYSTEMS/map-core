import type { Feature } from 'ol/index.js';
import type { EventFeature, InteractionEvent } from './abstractInteraction.js';
import AbstractInteraction from './abstractInteraction.js';
import { EventType } from './interactionType.js';
import PanoramaMap from '../map/panoramaMap.js';
import type MapCollection from '../util/mapCollection.js';
import { panoramaFeature } from '../layer/vectorSymbols.js';
import { isProvidedClusterFeature } from '../featureProvider/featureProviderSymbols.js';
import type { PanoramaDatasetFeatureProperties } from '../layer/panoramaDatasetLayer.js';
import { vcsLayerName } from '../layer/layerSymbols.js';

/**
 * get a panorama dataset associated with the event feature in the following cases:
 * - there is only one feature, and this feature is a panorama feature
 * - there is a cluster feature and the following is true: all features in the cluster belong to the same layer and all features belong to a panorama dataset
 * @param feature
 */
function getPanoramaDatasetProperties(
  feature?: EventFeature,
): PanoramaDatasetFeatureProperties | null {
  if (!feature) {
    return null;
  }

  if ((feature as Feature)[panoramaFeature]) {
    return (feature as Feature)[panoramaFeature]!;
  }

  if ((feature as Feature)[isProvidedClusterFeature]) {
    let layerName: string | undefined;
    let firstPanoramaDatasetFeatureProperties: PanoramaDatasetFeatureProperties | null =
      null;
    const features = (feature.getProperty('features') as Feature[]) ?? [];
    for (const f of features) {
      const fLayerName = f[vcsLayerName];
      if (fLayerName == null) {
        return null;
      }

      if (layerName == null) {
        layerName = fLayerName;
      } else if (layerName !== fLayerName) {
        return null;
      }

      const fPanoramaDatasetFeatureProperties = f[panoramaFeature];
      if (!fPanoramaDatasetFeatureProperties) {
        return null;
      } else if (!firstPanoramaDatasetFeatureProperties) {
        firstPanoramaDatasetFeatureProperties =
          fPanoramaDatasetFeatureProperties;
      }
    }

    return firstPanoramaDatasetFeatureProperties;
  }

  return null;
}

export default class PanoramaImageSelection extends AbstractInteraction {
  constructor(private _mapCollection: MapCollection) {
    super(EventType.CLICK);
  }

  override async pipe(event: InteractionEvent): Promise<InteractionEvent> {
    const panoramaDatasetProperties = getPanoramaDatasetProperties(
      event.feature,
    );
    if (panoramaDatasetProperties) {
      const { dataset, name, time } = panoramaDatasetProperties;
      const panoramaImage = await dataset.createPanoramaImage(name, time);
      event.stopPropagation = true;

      if (event.map instanceof PanoramaMap) {
        event.map.setCurrentImage(panoramaImage);
      } else {
        const firstPanoramaMap = this._mapCollection.getByType(
          PanoramaMap.className,
        )[0];
        if (firstPanoramaMap) {
          await this._mapCollection.activatePanoramaMap(
            firstPanoramaMap as PanoramaMap,
            panoramaImage,
          );
        }
      }
    }

    return event;
  }
}
