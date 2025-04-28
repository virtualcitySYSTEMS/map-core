import type { Feature } from 'ol/index.js';
import type { Coordinate } from 'ol/coordinate.js';
import AbstractInteraction, {
  InteractionEvent,
} from './abstractInteraction.js';
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
      const coordinate = (event.feature as Feature)
        .getGeometry()
        ?.getCoordinates() as Coordinate;
      const panoramaImage = await dataset.createPanoramaImage(name, coordinate);
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
