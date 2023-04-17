import { handlerSymbol, mouseOverSymbol } from '../editorSymbols.js';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import { ModificationKeyType, EventType } from '../../../interaction/interactionType.js';
import { cursorMap } from './editGeometryMouseOverInteraction.js';

/**
 * A class to handle mouse over effects on features for editor sessions.
 * @class
 * @extends {AbstractInteraction}
 */
class EditFeaturesMouseOverInteraction extends AbstractInteraction {
  constructor() {
    super(EventType.MOVE, ModificationKeyType.NONE);
    /**
     * @type {import("ol").Feature|import("@vcmap-cesium/engine").Cesium3DTileFeature|import("@vcmap-cesium/engine").Cesium3DTilePointFeature|null}
     * @private
     */
    this._currentHandler = null;
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
      event.feature && event.feature[handlerSymbol]
    ) {
      this._currentHandler = /** @type {import("ol").Feature|import("@vcmap-cesium/engine").Cesium3DTileFeature|import("@vcmap-cesium/engine").Cesium3DTilePointFeature} */
        (event.feature);
    } else {
      this._currentHandler = null;
    }
    this._evaluate();
    return event;
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
   * @private
   */
  _evaluate() {
    if (this._currentHandler) {
      this.cursorStyle.cursor = cursorMap.translate;
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

export default EditFeaturesMouseOverInteraction;
