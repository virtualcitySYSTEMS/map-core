import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import {
  EventType,
  ModificationKeyType,
} from '../../../interaction/interactionType.js';
import VcsEvent from '../../../vcsEvent.js';
import { vcsLayerName } from '../../../layer/layerSymbols.js';
import { isTiledFeature } from '../../../layer/featureStoreLayer.js';

/**
 * Class to select features for editing.
 * Static FeatureStore features will be converted into their dynamic form
 * @class
 * @extends {AbstractInteraction}
 * @implements {SelectFeatureInteraction}
 */
class SelectSingleFeatureInteraction extends AbstractInteraction {
  /**
   * @param {import("@vcmap/core").VectorLayer} layer
   */
  constructor(layer) {
    super(EventType.CLICK, ModificationKeyType.NONE);
    /**
     * @type {import("@vcmap/core").VectorLayer|import("@vcmap/core").FeatureStoreLayer}
     * @private
     */
    this._layer = layer;
    /**
     * @type {import("ol").Feature|null}
     * @private
     */
    this._selectedFeature = null;
    /**
     * Event called when the feature changes. Called with null if the selection is cleared.
     * @type {VcsEvent<import("ol").Feature|null>}
     */
    this.featureChanged = new VcsEvent();
    this.setActive();
  }

  /**
   * @returns {Array<import("ol").Feature>}
   */
  get selected() {
    return this._selectedFeature ? [this._selectedFeature] : [];
  }

  /**
   * @inheritDoc
   * @param {InteractionEvent} event
   * @returns {Promise<InteractionEvent>}
   */
  async pipe(event) {
    if (event.feature && event.feature[vcsLayerName] === this._layer.name) {
      if (
        !(
          this._selectedFeature &&
          event.feature.getId() === this._selectedFeature.getId()
        )
      ) {
        event.stopPropagation = true;
        await this.setSelected(
          /** @type {import("ol").Feature|import("@vcmap-cesium/engine").Cesium3DTileFeature|import("@vcmap-cesium/engine").Cesium3DTilePointFeature} */
          (event.feature),
        );
      }
    } else {
      this.clear();
    }
    return event;
  }

  /**
   * Selects the given feature. if passed in a tiled feature store feature, it will be converted. Do not pass in uneditable features (feature which do not
   * belong to the layer for which this interaction was created)
   * @param {Array<import("ol").Feature|import("@vcmap-cesium/engine").Cesium3DTileFeature|import("@vcmap-cesium/engine").Cesium3DTilePointFeature|import("@vcmap-cesium/engine").Entity> | import("ol").Feature|import("@vcmap-cesium/engine").Cesium3DTileFeature|import("@vcmap-cesium/engine").Cesium3DTilePointFeature|import("@vcmap-cesium/engine").Entity} feature
   * @returns {Promise<void>}
   */
  async setSelected(feature) {
    let olFeature = Array.isArray(feature) ? feature[0] : feature;
    if (feature[isTiledFeature]) {
      olFeature = await /** @type {import("@vcmap/core").FeatureStoreLayer} */ (
        this._layer
      ).switchStaticFeatureToDynamic(olFeature.getId());
    }

    this._selectedFeature = /** @type {import("ol").Feature} */ (olFeature);
    this.featureChanged.raiseEvent(this._selectedFeature);
  }

  /**
   * Checks if a feature with a spicific id is selected.
   * @param {string | number} id
   * @returns {boolean}
   */
  hasFeatureId(id) {
    return this._selectedFeature?.getId() === id;
  }

  /**
   * Clears the current selection, if there is one.
   */
  clear() {
    if (this._selectedFeature) {
      this._selectedFeature = null;
      this.featureChanged.raiseEvent(null);
    }
  }

  /**
   * @inheritDoc
   */
  destroy() {
    this._selectedFeature = null;
    this.featureChanged.destroy();
    super.destroy();
  }
}

export default SelectSingleFeatureInteraction;
