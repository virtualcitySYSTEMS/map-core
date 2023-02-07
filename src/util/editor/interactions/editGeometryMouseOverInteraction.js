import { vertexSymbol } from '../editorSymbols.js';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import { ModificationKeyType, EventType } from '../../../interaction/interactionType.js';
import { vcsLayerName } from '../../../layer/layerSymbols.js';

/**
 * only exported for tests
 * @type {Object}
 */
export const cursorMap = { // TODO these can now be designed custom. IE11 no linger required
  auto: 'auto',
  scaleNESW: 'nesw-resize',
  scaleNWSE: 'nwse-resize',
  rotate: 'crosshair',
  translate: 'move',
  select: 'pointer',
  edit: 'pointer', // fa pencil
  translateVertex: 'move', // fa-stack pointer-move
  removeVertex: 'pointer', // fa-stack pencil-minus
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
  /**
   * @param {string} layerName - the layer name of the currently editing layer
   */
  constructor(layerName) {
    super(EventType.MOVE, ModificationKeyType.ALL);
    /**
     * @type {import("ol").Feature|import("@vcmap-cesium/engine").Cesium3DTileFeature|import("@vcmap-cesium/engine").Cesium3DTilePointFeature|null}
     * @private
     */
    this._lastFeature = null;
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
      (
        event.feature[vcsLayerName] === this.layerName ||
        event.feature[vertexSymbol]
      )
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
      if (this._lastFeature[vertexSymbol]) {
        if (modifier === ModificationKeyType.SHIFT) {
          this.cursorStyle.cursor = cursorMap.removeVertex;
        } else {
          this.cursorStyle.cursor = cursorMap.translateVertex;
        }
      } else {
        this.cursorStyle.cursor = cursorMap.select;
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

export default EditGeometryMouseOverInteraction;
