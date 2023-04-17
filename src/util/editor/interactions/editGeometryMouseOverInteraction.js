import { mouseOverSymbol, vertexSymbol } from '../editorSymbols.js';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import {
  ModificationKeyType,
  EventType,
} from '../../../interaction/interactionType.js';

/**
 * @type {Object}
 */
export const cursorMap = {
  // TODO these can now be designed custom. IE11 no linger required
  auto: 'auto',
  scaleNESW: 'nesw-resize',
  scaleNWSE: 'nwse-resize',
  rotate: 'crosshair',
  translate: 'move',
  select: 'pointer',
  edit: 'pointer', // fa pencil
  translateVertex: 'move', // fa-stack pointer-move
  removeVertex: 'no-drop', // fa-stack pencil-minus
  insertVertex: 'cell', // fa-stack pencil-plus
  addToSelection: 'cell', // fa-stack pointer-black
  removeFromSelection: 'not-allowed',
};

/**
 * A class to handle mouse over effects on features for editor sessions.
 * @class
 * @extends {AbstractInteraction}
 */
class EditGeometryMouseOverInteraction extends AbstractInteraction {
  constructor() {
    super(EventType.MOVE, ModificationKeyType.NONE | ModificationKeyType.SHIFT);
    /**
     * @type {import("ol").Feature|import("@vcmap-cesium/engine").Cesium3DTileFeature|import("@vcmap-cesium/engine").Cesium3DTilePointFeature|null}
     * @private
     */
    this._currentVertex = null;
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
    if (event.feature && event.feature[vertexSymbol]) {
      this._currentVertex =
        /** @type {import("ol").Feature|import("@vcmap-cesium/engine").Cesium3DTileFeature|import("@vcmap-cesium/engine").Cesium3DTilePointFeature} */
        (event.feature);
    } else {
      this._currentVertex = null;
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
    if (this._currentVertex) {
      if (modifier === ModificationKeyType.SHIFT) {
        this.cursorStyle.cursor = cursorMap.removeVertex;
      } else {
        this.cursorStyle.cursor = cursorMap.translateVertex;
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

export default EditGeometryMouseOverInteraction;
