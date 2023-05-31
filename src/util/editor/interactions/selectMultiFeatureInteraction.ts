import type { Feature } from 'ol/index.js';
import type { Cesium3DTileFeature } from '@vcmap-cesium/engine';
import AbstractInteraction, {
  EventAfterEventHandler,
} from '../../../interaction/abstractInteraction.js';
import {
  EventType,
  ModificationKeyType,
} from '../../../interaction/interactionType.js';
import VcsEvent from '../../../vcsEvent.js';
import { vcsLayerName } from '../../../layer/layerSymbols.js';
import FeatureStoreLayer, {
  isTiledFeature,
} from '../../../layer/featureStoreLayer.js';
import type { SelectFeatureInteraction } from '../editorHelpers.js';
import type VectorLayer from '../../../layer/vectorLayer.js';
import { SelectableFeatureType } from '../editorHelpers.js';

/**
 * Interaction to create a selection set from the given layer.
 * Will use CTRL modifier key to add more features to the set.
 * Clears the set if not clicking a feature
 * Creates a new set when clicking a feature
 * FeatureStore features will be converted to their dynamic state on selection.
 */
class SelectMultiFeatureInteraction
  extends AbstractInteraction
  implements SelectFeatureInteraction
{
  private _layer: VectorLayer;

  private _selectedFeatures: Map<string | number, Feature> = new Map();

  /**
   * Event raised when the feature selection changes. Will be called with an array of features or an empty array, when no feature is selected
   */
  readonly featuresChanged = new VcsEvent<Feature[]>();

  constructor(layer: VectorLayer) {
    super(EventType.CLICK, ModificationKeyType.NONE | ModificationKeyType.CTRL);
    this._layer = layer;
    this.setActive();
  }

  get selected(): Feature[] {
    return [...this._selectedFeatures.values()];
  }

  /**
   * Checks if a feature with a spicific id is selected.
   */
  hasFeatureId(id: string | number): boolean {
    return this._selectedFeatures.has(id);
  }

  async pipe(event: EventAfterEventHandler): Promise<EventAfterEventHandler> {
    if (event.feature && event.feature[vcsLayerName] === this._layer.name) {
      if (event.key & ModificationKeyType.CTRL) {
        event.stopPropagation = true;
        await this._modifySelectionSet(event.feature as SelectableFeatureType);
      } else if (
        !this._selectedFeatures.has(event.feature.getId() as number | string) ||
        (this._selectedFeatures.has(event.feature.getId() as number | string) &&
          this._selectedFeatures.size > 1)
      ) {
        event.stopPropagation = true;
        await this.setSelected([event.feature as SelectableFeatureType]);
      }
    } else if (!(event.key & ModificationKeyType.CTRL)) {
      this.clear();
    }
    return event;
  }

  async setSelected(
    features: SelectableFeatureType[] | SelectableFeatureType,
  ): Promise<void> {
    this._selectedFeatures.clear();
    const featureArray = Array.isArray(features) ? features : [features];
    const olFeatures = await Promise.all(
      featureArray.map((f) => {
        if ((f as Cesium3DTileFeature)[isTiledFeature]) {
          return (
            this._layer as FeatureStoreLayer
          ).switchStaticFeatureToDynamic(
            f.getId() as number | string,
          ) as Promise<Feature>;
        }
        return f as Feature;
      }),
    );
    olFeatures.forEach((f) => {
      this._selectedFeatures.set(f.getId() as string | number, f);
    });

    this.featuresChanged.raiseEvent(this.selected);
  }

  private async _modifySelectionSet(
    feature: SelectableFeatureType,
  ): Promise<void> {
    const id = feature.getId() as string | number;
    if (this._selectedFeatures.has(id)) {
      this._selectedFeatures.delete(id);
    } else {
      let olFeature = feature;
      if ((feature as Cesium3DTileFeature)[isTiledFeature]) {
        olFeature = (await (
          this._layer as FeatureStoreLayer
        ).switchStaticFeatureToDynamic(id)) as Feature;
      }
      this._selectedFeatures.set(id, olFeature as Feature);
    }

    this.featuresChanged.raiseEvent(this.selected);
  }

  /**
   * Clears the interaction, removing all features and calling the featureChange event with an empty array
   */
  clear(): void {
    if (this._selectedFeatures.size > 0) {
      this._selectedFeatures.clear();
      this.featuresChanged.raiseEvent([]);
    }
  }

  destroy(): void {
    this._selectedFeatures.clear();
    this.featuresChanged.destroy();
    super.destroy();
  }
}

export default SelectMultiFeatureInteraction;
