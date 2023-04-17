import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import { EventType, ModificationKeyType } from '../../../interaction/interactionType.js';
import SelectMultiFeatureInteraction from './selectMultiFeatureInteraction.js';
import SelectSingleFeatureInteraction from './selectSingleFeatureInteraction.js';
import { cursorMap } from './editGeometryMouseOverInteraction.js';
import { vcsLayerName } from '../../../layer/layerSymbols.js';
import { mouseOverSymbol } from '../editorSymbols.js';

/**
 * Enumeration of editor selection modes.
 * @enum {string}
 * @property {string} SINGLE
 * @property {string} MULTI
 */
export const SelectionMode = {
  SINGLE: 'single',
  MULTI: 'multi',
};

/**
 * A class to handle mouse over effects on features for select sessions.
 * @class
 * @extends {AbstractInteraction}
 */
class SelectFeatureMouseOverInteraction extends AbstractInteraction {
  /**
   * @param {string} layerName Name of the layer for which the mouse over effect should accur.
   * @param {SelectSingleFeatureInteraction | SelectMultiFeatureInteraction} selectFeatureInteraction The select feature interaction that handles the feature selection. Supports both, single and multi selection.
   */
  constructor(layerName, selectFeatureInteraction) {
    let modkeys;
    let selectionMode;
    if (selectFeatureInteraction instanceof SelectSingleFeatureInteraction) {
      modkeys = ModificationKeyType.NONE;
      selectionMode = SelectionMode.SINGLE;
    } else if (selectFeatureInteraction instanceof SelectMultiFeatureInteraction) {
      modkeys = ModificationKeyType.NONE | ModificationKeyType.CTRL;
      selectionMode = SelectionMode.MULTI;
    } else {
      throw new Error('This interaction is not supported');
    }

    super(EventType.MOVE, modkeys);
    /** @type {SelectSingleFeatureInteraction | SelectMultiFeatureInteraction} */
    this._selectFeatureInteraction = selectFeatureInteraction;
    /** @type {SelectionMode} */
    this.selectionMode = selectionMode;
    /**
     * The feature that is currently hovered and belongs to the layer with the layerName.
     * @type {import("ol").Feature|import("@vcmap-cesium/engine").Cesium3DTileFeature|import("@vcmap-cesium/engine").Cesium3DTilePointFeature|null}
     * @private
     */
    this._currentFeature = null;
    /**
     * The layer name to react to
     * @type {string}
     */
    this.layerName = layerName;
    /**
     * @type {CSSStyleDeclaration}
     * @private
     */
    this.cursorStyle = document.body.style;
  }

  /**
   * @inheritDoc
   * @param {InteractionEvent} event
   * @returns {Promise<InteractionEvent>}
   */
  async pipe(event) {
    if (
      event.feature &&
      (event.feature[vcsLayerName] === this.layerName)
    ) {
      this._currentFeature = /** @type {import("ol").Feature|import("@vcmap-cesium/engine").Cesium3DTileFeature|import("@vcmap-cesium/engine").Cesium3DTilePointFeature} */
        (event.feature);
    } else {
      this._currentFeature = null;
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
    if (this._currentFeature) {
      const isCtrlPressed = this.selectionMode === SelectionMode.MULTI && (modifier & ModificationKeyType.CTRL);
      const isSelected = this._selectFeatureInteraction.hasFeatureId(this._currentFeature.getId());

      if (isCtrlPressed) {
        this.cursorStyle.cursor = isSelected ? cursorMap.removeFromSelection : cursorMap.addToSelection;
      } else {
        this.cursorStyle.cursor = cursorMap.select;
      }

      this.cursorStyle[mouseOverSymbol] = this.id;
    } else if (this.cursorStyle?.[mouseOverSymbol] === this.id) {
      this.cursorStyle.cursor = cursorMap.auto;
      delete this.cursorStyle[mouseOverSymbol];
    }
  }

  /**
   * @inheritDoc
   */
  destroy() {
    this.reset();
    this.cursorStyle = null;
    super.destroy();
  }
}

export default SelectFeatureMouseOverInteraction;
