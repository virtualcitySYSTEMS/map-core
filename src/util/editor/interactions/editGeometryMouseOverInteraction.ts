import { mouseOverSymbol, vertexSymbol } from '../editorSymbols.js';
import AbstractInteraction, {
  EventAfterEventHandler,
} from '../../../interaction/abstractInteraction.js';
import {
  ModificationKeyType,
  EventType,
} from '../../../interaction/interactionType.js';
import { Vertex } from '../editorHelpers.js';

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
 * @extends {AbstractInteraction}
 */
class EditGeometryMouseOverInteraction extends AbstractInteraction {
  private _currentVertex: Vertex | null = null;

  cursorStyle: CSSStyleDeclaration;

  constructor() {
    super(EventType.MOVE, ModificationKeyType.NONE | ModificationKeyType.SHIFT);

    this.cursorStyle = document.body.style;

    this.setActive();
  }

  pipe(event: EventAfterEventHandler): Promise<EventAfterEventHandler> {
    if (event.feature && (event.feature as Vertex)[vertexSymbol]) {
      this._currentVertex = event.feature as Vertex;
    } else {
      this._currentVertex = null;
    }
    this._evaluate(event.key);
    return Promise.resolve(event);
  }

  modifierChanged(modifier: ModificationKeyType): void {
    this._evaluate(modifier);
  }

  setActive(active?: boolean | number): void {
    super.setActive(active);
    this.reset();
  }

  /**
   * Reset the cursorStyle to auto
   */
  reset(): void {
    if (this.cursorStyle && this.cursorStyle.cursor) {
      this.cursorStyle.cursor = cursorMap.auto;
    }
  }

  private _evaluate(modifier: ModificationKeyType): void {
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

  destroy(): void {
    this.reset();
    super.destroy();
  }
}

export default EditGeometryMouseOverInteraction;
