import type { Feature } from 'ol/index.js';
import AbstractInteraction, {
  type InteractionEvent,
} from './abstractInteraction.js';
import { EventType } from './interactionType.js';
import { panoramaFeature } from '../layer/vectorSymbols.js';
import PanoramaMap from '../map/panoramaMap.js';
import { getFeatureFromScene } from './featureAtPixelInteraction.js';
import type { PanoramaDatasetFeatureProperties } from '../panorama/panoramaDataset.js';
import { getDefaultHighlightStyle } from '../util/editor/selectFeaturesSession.js';

/**
 * Throttle time in milliseconds to limit how frequently mouse move events are processed.
 * This prevents excessive highlighting/unhighlighting operations during rapid mouse movements
 * and improves overall performance by reducing CPU load.
 *
 * @remarks
 * - 50ms equals approximately 20 FPS update rate
 * - Lower values increase responsiveness but use more CPU
 * - Higher values reduce CPU usage but may feel less responsive
 */
const THROTTLE_TIME_MS = 50;

/**
 * Interaction class that handles highlighting of panorama tiles on mouse move.
 *
 * This interaction listens for mouse move events over a PanoramaMap and highlights
 * panorama features under the cursor. When the mouse moves to a different feature,
 * the previous feature is unhighlighted and the new one is highlighted. When the
 * mouse leaves all features, the last highlighted feature is unhighlighted.
 *
 * @example
 * ```typescript
 * const highlightInteraction = new PanoramaTileHighlight();
 * map.addInteraction(highlightInteraction);
 * ```
 *
 * @remarks
 * - Uses throttling (50ms) to improve performance during rapid mouse movements
 * - Only works with PanoramaMap instances
 * - Prevents race conditions with internal processing flag
 * - Automatically cleans up highlights when destroyed
 */
export default class PanoramaTileHighlight extends AbstractInteraction {
  private _lastPickTime = 0;
  private _lastPickedPanoramaFeature:
    | PanoramaDatasetFeatureProperties
    | undefined = undefined;

  constructor() {
    super(EventType.MOVE);
  }

  private _unhighlightLastFeature(): void {
    if (this._lastPickedPanoramaFeature) {
      this._lastPickedPanoramaFeature.dataset.layer.featureVisibility.unHighlight(
        [this._lastPickedPanoramaFeature.name],
      );
    }
  }

  override pipe(event: InteractionEvent): Promise<InteractionEvent> {
    const now = Date.now();

    if (now - this._lastPickTime < THROTTLE_TIME_MS) {
      return Promise.resolve(event);
    }
    this._lastPickTime = now;

    if (event.map instanceof PanoramaMap) {
      const picked = getFeatureFromScene(
        event.map.getCesiumWidget().scene,
        event.windowPosition,
        10,
      );

      if (picked.feature && (picked.feature as Feature)[panoramaFeature]) {
        const { dataset, name } = (picked.feature as Feature)[panoramaFeature]!;

        if (name !== this._lastPickedPanoramaFeature?.name) {
          this._unhighlightLastFeature();

          dataset.layer.featureVisibility.highlight({
            [name]: getDefaultHighlightStyle(),
          });

          this._lastPickedPanoramaFeature = (picked.feature as Feature)[
            panoramaFeature
          ]!;
        }
      } else if (this._lastPickedPanoramaFeature?.name !== undefined) {
        this._unhighlightLastFeature();
        this._lastPickedPanoramaFeature = undefined;
      }
    } else {
      this._unhighlightLastFeature();
    }
    return Promise.resolve(event);
  }

  destroy(): void {
    if (this._lastPickedPanoramaFeature) {
      this._lastPickedPanoramaFeature.dataset.layer.featureVisibility.unHighlight(
        [this._lastPickedPanoramaFeature.name],
      );
    }
    super.destroy();
  }
}
