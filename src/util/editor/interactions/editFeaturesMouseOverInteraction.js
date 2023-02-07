import { handlerSymbol } from '../editorSymbols.js';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import { ModificationKeyType, EventType } from '../../../interaction/interactionType.js';
import { vcsLayerName } from '../../../layer/layerSymbols.js';
import { cursorMap } from './editGeometryMouseOverInteraction.js';

/**
 * A class to handle mouse over effects on features for editor sessions.
 * @class
 * @extends {AbstractInteraction}
 */
class EditFeaturesMouseOverInteraction extends AbstractInteraction {
  /**
   * @param {string} layerName - the layer name of the currently editing layer
   * @param {import("@vcmap/core").SelectMultiFeatureInteraction} selectMultiFeatureInteraction
   */
  constructor(layerName, selectMultiFeatureInteraction) {
    super(EventType.MOVE, ModificationKeyType.ALL);
    /**
     * @type {import("ol").Feature|import("@vcmap-cesium/engine").Cesium3DTileFeature|import("@vcmap-cesium/engine").Cesium3DTilePointFeature|null}
     * @private
     */
    this._lastFeature = null;
    /**
     * @type {import("@vcmap/core").SelectMultiFeatureInteraction}
     * @private
     */
    this._selectMultiFeatureInteraction = selectMultiFeatureInteraction;
    /**
     * The layer name to react to
     * @type {string}
     */
    this.layerName = layerName;
    /**
     * @type {CSSStyleDeclaration}
     */
    this.cursorStyle = document.body.style;

    this.setActive();
  }

  /**
   * @inheritDoc
   * @param {InteractionEvent} event
   * @returns {Promise<InteractionEvent>}
   */
  async pipe(event) {
    if (
      event.feature &&
      (event.feature[vcsLayerName] === this.layerName || event.feature[handlerSymbol])
    ) {
      this._lastFeature = /** @type {import("ol").Feature|import("@vcmap-cesium/engine").Cesium3DTileFeature|import("@vcmap-cesium/engine").Cesium3DTilePointFeature} */
        (event.feature);
    } else {
      this._lastFeature = null;
    }
    this._evaluate(event.key);
    return event;
  }

  /**
   * @inheritDoc
   * @param {ModificationKeyType} modifier
   */
  modifierChanged(modifier) {
    this._evaluate(modifier);
  }

  /**
   * @inheritDoc
   * @param {(boolean|number)=} active
   */
  setActive(active) {
    super.setActive(active);
    this.reset();
  }

  /**
   * Reset the cursorStyle to auto
   */
  reset() {
    if (this.cursorStyle && this.cursorStyle.cursor) {
      this.cursorStyle.cursor = cursorMap.auto;
    }
  }

  /**
   * @param {ModificationKeyType} modifier
   * @private
   */
  _evaluate(modifier) {
    if (this._lastFeature) {
      if (this._lastFeature[handlerSymbol]) {
        this.cursorStyle.cursor = cursorMap.select;
      } else if (modifier === ModificationKeyType.CTRL) {
        if (!this._selectMultiFeatureInteraction.hasFeatureId(/** @type {string} */ (this._lastFeature.getId()))) {
          this.cursorStyle.cursor = cursorMap.addToSelection;
        } else {
          this.cursorStyle.cursor = cursorMap.removeFromSelection;
        }
      } else if (!this._selectMultiFeatureInteraction.hasFeatureId(/** @type {string} */ (this._lastFeature.getId()))) {
        this.cursorStyle.cursor = cursorMap.select;
      } else {
        this.cursorStyle.cursor = cursorMap.auto;
      }
    } else {
      this.cursorStyle.cursor = cursorMap.auto;
    }
  }

  /**
   * @inheritDoc
   */
  destroy() {
    this.cursorStyle = null;
    super.destroy();
  }
}

export default EditFeaturesMouseOverInteraction;
