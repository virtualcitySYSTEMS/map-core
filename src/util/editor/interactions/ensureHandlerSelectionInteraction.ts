import type { Feature } from 'ol/index.js';
import type { Scene } from '@vcmap-cesium/engine';
import type { EventAfterEventHandler } from '../../../interaction/abstractInteraction.js';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import { EventType } from '../../../interaction/interactionType.js';
import { handlerSymbol } from '../editorSymbols.js';
import CesiumMap from '../../../map/cesiumMap.js';

/**
 * This interaction ensure a potential handler is dragged in 3D when it is obscured by a transparent feature.
 * It uses drillPick on MOVE if: the map is 3D, there is a feature at said position, there is a feature selected in
 * the feature selection & the feature at the position is _not_ a handler
 */
class EnsureHandlerSelectionInteraction extends AbstractInteraction {
  private _featureSelection: Feature[];

  /**
   * @param  selectedFeatures Reference to the selected features.
   */
  constructor(selectedFeatures: Feature[]) {
    super(EventType.DRAGSTART | EventType.MOVE);

    this._featureSelection = selectedFeatures;
  }

  pipe(event: EventAfterEventHandler): Promise<EventAfterEventHandler> {
    if (
      event.feature &&
      this._featureSelection.length > 0 &&
      !(event.feature as Feature)[handlerSymbol] &&
      event.map instanceof CesiumMap
    ) {
      const scene = event.map.getScene() as Scene;
      const drillPicks = scene.drillPick(
        event.windowPosition,
        undefined,
        10,
        10,
      ) as { primitive?: { olFeature?: Feature } }[];
      const handler = drillPicks.find((p) => {
        return p?.primitive?.olFeature?.[handlerSymbol];
      });
      if (handler) {
        event.feature = handler.primitive!.olFeature;
      }
    }
    return Promise.resolve(event);
  }
}

export default EnsureHandlerSelectionInteraction;
