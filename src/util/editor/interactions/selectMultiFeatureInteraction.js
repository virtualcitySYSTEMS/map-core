import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import { EventType, ModificationKeyType } from '../../../interaction/interactionType.js';
import VcsEvent from '../../../vcsEvent.js';
import { vcsLayerName } from '../../../layer/layerSymbols.js';
import { isTiledFeature } from '../../../layer/featureStoreLayer.js';

/**
 * Interaction to create a selection set from the given layer.
 * Will use CTRL modifier key to add more features to the set.
 * Clears the set if not clicking a feature
 * Creates a new set when clicking a feature
 * FeatureStore features will be converted to their dynamic state on selection.
 * @class
 * @extends {AbstractInteraction}
 * @implements {SelectFeatureInteraction}
 */
class SelectMultiFeatureInteraction extends AbstractInteraction {
  /**
   * @param {import("@vcmap/core").VectorLayer} layer
   */
  constructor(layer) {
    super(EventType.CLICK, ModificationKeyType.NONE | ModificationKeyType.CTRL);
    /**
     * @type {import("@vcmap/core").VectorLayer|import("@vcmap/core").FeatureStoreLayer}
     * @private
     */
    this._layer = layer;
    /**
     * @type {Map<string|number, import("ol").Feature>}
     * @private
     */
    this._selectedFeatures = new Map();
    /**
     * @type {VcsEvent<Array<import("ol").Feature>>}
     * @private
     */
    this._featuresChanged = new VcsEvent();
    this.setActive();
  }

  /**
   * Event raised when the feature selection changes. Will be called with an array of features or an empty array, when no feature is selected
   * @type {VcsEvent<Array<import("ol").Feature>>}
   * @readonly
   */
  get featuresChanged() { return this._featuresChanged; }

  /**
   * @returns {Array<import("ol").Feature>}
   */
  get selected() {
    return [...this._selectedFeatures.values()];
  }

  /**
   * Checks if a feature with a spicific id is selected.
   * @param {string | number} id
   * @returns {boolean}
   */
  hasFeatureId(id) {
    return this._selectedFeatures.has(id);
  }

  /**
   * @inheritDoc
   * @param {InteractionEvent} event
   * @returns {Promise<InteractionEvent>}
   */
  async pipe(event) {
    if (
      event.feature &&
      event.feature[vcsLayerName] === this._layer.name
    ) {
      if (event.key & ModificationKeyType.CTRL) {
        event.stopPropagation = true;
        await this._modifySelectionSet(event.feature);
      } else if (
        !this._selectedFeatures.has(event.feature.getId()) ||
        (this._selectedFeatures.has(event.feature.getId()) && this._selectedFeatures.size > 1)
      ) {
        event.stopPropagation = true;
        await this.setSelected([event.feature]);
      }
    } else if (!(event.key & ModificationKeyType.CTRL)) {
      this.clear();
    }
    return event;
  }

  /**
   * @param {Array<import("ol").Feature|import("@vcmap-cesium/engine").Cesium3DTileFeature|import("@vcmap-cesium/engine").Cesium3DTilePointFeature|import("@vcmap-cesium/engine").Entity> | import("ol").Feature|import("@vcmap-cesium/engine").Cesium3DTileFeature|import("@vcmap-cesium/engine").Cesium3DTilePointFeature|import("@vcmap-cesium/engine").Entity} features
   * @returns {Promise<void>}
   */
  async setSelected(features) {
    this._selectedFeatures.clear();
    const featureArray = Array.isArray(features) ? features : [features];
    const olFeatures = await Promise.all(featureArray.map((f) => {
      if (f[isTiledFeature]) {
        return /** @type {import("@vcmap/core").FeatureStoreLayer} */ (this._layer)
          .switchStaticFeatureToDynamic(f.getId());
      }
      return f;
    }));
    olFeatures.forEach(/** @param {import("ol").Feature} f */ (f) => {
      this._selectedFeatures.set(f.getId(), f);
    });

    this._featuresChanged.raiseEvent(this.selected);
  }

  /**
   * @param {import("ol").Feature|import("@vcmap-cesium/engine").Cesium3DTileFeature|import("@vcmap-cesium/engine").Cesium3DTilePointFeature|import("@vcmap-cesium/engine").Entity} feature
   * @returns {Promise<void>}
   * @private
   */
  async _modifySelectionSet(feature) {
    const id = feature.getId();
    if (this._selectedFeatures.has(id)) {
      this._selectedFeatures.delete(id);
    } else {
      let olFeature = feature;
      if (feature[isTiledFeature]) {
        olFeature = await /** @type {import("@vcmap/core").FeatureStoreLayer} */ (this._layer)
          .switchStaticFeatureToDynamic(id);
      }
      this._selectedFeatures.set(id, /** @type {import("ol").Feature} */ (olFeature));
    }

    this._featuresChanged.raiseEvent(this.selected);
  }

  /**
   * Clears the interaction, removing all features and calling the featureChange event with an empty array
   */
  clear() {
    if (this._selectedFeatures.size > 0) {
      this._selectedFeatures.clear();
      this._featuresChanged.raiseEvent([]);
    }
  }

  /**
   * @inheritDoc
   */
  destroy() {
    this._selectedFeatures.clear();
    this._featuresChanged.destroy();
    super.destroy();
  }
}

export default SelectMultiFeatureInteraction;
