import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import { EventType } from '../../../interaction/interactionType.js';
import { handlerSymbol } from '../editorSymbols.js';
import CesiumMap from '../../../map/cesiumMap.js';

/**
 * This interaction ensure a potential handler is dragged in 3D when it is obscured by a transparent feature.
 * It uses drillPick on MOVE if: the map is 3D, there is a feature at said position, there is a feature selected in
 * the feature selection & the feature at the position is _not_ a handler
 * @class
 */
class EnsureHandlerSelectionInteraction extends AbstractInteraction {
  /**
   * @param {Array<import("ol").Feature>} selectedFeatures Reference to the selected features.
   */
  constructor(selectedFeatures) {
    super(EventType.DRAGSTART | EventType.MOVE);
    /**
     * @type {Array<import("ol").Feature>}
     * @private
     */
    this._featureSelection = selectedFeatures;
  }

  /**
   * @param {InteractionEvent} event
   * @returns {Promise<InteractionEvent>}
   */
  async pipe(event) {
    if (
      event.feature &&
      this._featureSelection.length > 0 &&
      !event.feature[handlerSymbol] &&
      event.map instanceof CesiumMap
    ) {
      const handler = event.map
        .getScene()
        .drillPick(event.windowPosition, undefined, 10, 10)
        .find((p) => {
          return p?.primitive?.olFeature?.[handlerSymbol];
        });
      if (handler) {
        event.feature = handler.primitive.olFeature;
      }
    }
    return event;
  }
}

export default EnsureHandlerSelectionInteraction;
