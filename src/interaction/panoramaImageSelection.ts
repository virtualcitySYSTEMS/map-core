import type { Feature } from 'ol/index.js';
import type { InteractionEvent } from './abstractInteraction.js';
import AbstractInteraction from './abstractInteraction.js';
import { EventType } from './interactionType.js';
import PanoramaMap from '../map/panoramaMap.js';
import type MapCollection from '../util/mapCollection.js';
import { panoramaFeature } from '../layer/vectorSymbols.js';

export default class PanoramaImageSelection extends AbstractInteraction {
  constructor(private _mapCollection: MapCollection) {
    super(EventType.CLICK);
  }

  override async pipe(event: InteractionEvent): Promise<InteractionEvent> {
    if (event.feature && (event.feature as Feature)[panoramaFeature]) {
      const { dataset, name } = (event.feature as Feature)[panoramaFeature]!;
      const panoramaImage = await dataset.createPanoramaImage(name);
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
