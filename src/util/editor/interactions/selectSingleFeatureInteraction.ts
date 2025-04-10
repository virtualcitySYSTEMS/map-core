import type { Feature } from 'ol/index.js';
import type { Cesium3DTileFeature } from '@vcmap-cesium/engine';
import type { EventAfterEventHandler } from '../../../interaction/abstractInteraction.js';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import {
  EventType,
  ModificationKeyType,
} from '../../../interaction/interactionType.js';
import VcsEvent from '../../../vcsEvent.js';
import { vcsLayerName } from '../../../layer/layerSymbols.js';
import type FeatureStoreLayer from '../../../layer/featureStoreLayer.js';
import { isTiledFeature } from '../../../layer/featureStoreLayer.js';
import type {
  SelectableFeatureType,
  SelectFeatureInteraction,
} from '../editorHelpers.js';
import type VectorLayer from '../../../layer/vectorLayer.js';

/**
 * Class to select features for editing.
 * Static FeatureStore features will be converted into their dynamic form
 */
class SelectSingleFeatureInteraction
  extends AbstractInteraction
  implements SelectFeatureInteraction
{
  private _layer: VectorLayer;

  private _selectedFeature: Feature | null = null;

  /**
   * Event called when the feature changes. Called with null if the selection is cleared.
   */
  readonly featureChanged = new VcsEvent<Feature | null>();

  constructor(layer: VectorLayer) {
    super(EventType.CLICK, ModificationKeyType.NONE);

    this._layer = layer;
    this.setActive();
  }

  get selected(): Feature[] {
    return this._selectedFeature ? [this._selectedFeature] : [];
  }

  async pipe(event: EventAfterEventHandler): Promise<EventAfterEventHandler> {
    if (event.feature && event.feature[vcsLayerName] === this._layer.name) {
      if (
        !(
          this._selectedFeature &&
          event.feature.getId() === this._selectedFeature.getId()
        )
      ) {
        event.stopPropagation = true;
        await this.setSelected(event.feature as SelectableFeatureType);
      }
    } else {
      this.clear();
    }
    return event;
  }

  /**
   * Selects the given feature. if passed in a tiled feature store feature, it will be converted. Do not pass in uneditable features (feature which do not
   * belong to the layer for which this interaction was created)
   */
  async setSelected(
    feature: SelectableFeatureType[] | SelectableFeatureType,
  ): Promise<void> {
    let olFeature = Array.isArray(feature) ? feature[0] : feature;
    if ((feature as Cesium3DTileFeature)[isTiledFeature]) {
      olFeature = (await (
        this._layer as FeatureStoreLayer
      ).switchStaticFeatureToDynamic(olFeature.getId() as string)) as Feature;
    }

    this._selectedFeature = olFeature as Feature;
    this.featureChanged.raiseEvent(this._selectedFeature);
  }

  /**
   * Checks if a feature with a spicific id is selected.
   */
  hasFeatureId(id: string | number): boolean {
    return this._selectedFeature?.getId() === id;
  }

  /**
   * Clears the current selection, if there is one.
   */
  clear(): void {
    if (this._selectedFeature) {
      this._selectedFeature = null;
      this.featureChanged.raiseEvent(null);
    }
  }

  destroy(): void {
    this._selectedFeature = null;
    this.featureChanged.destroy();
    super.destroy();
  }
}

export default SelectSingleFeatureInteraction;
