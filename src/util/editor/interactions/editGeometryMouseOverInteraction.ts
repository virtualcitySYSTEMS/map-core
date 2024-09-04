import { mouseOverSymbol, vertexSymbol } from '../editorSymbols.js';
import AbstractInteraction, {
  EventAfterEventHandler,
} from '../../../interaction/abstractInteraction.js';
import {
  ModificationKeyType,
  EventType,
} from '../../../interaction/interactionType.js';
import { Vertex } from '../editorHelpers.js';

const pointerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 19 19">
  <g id="pen">
    <path d=" M 14.744 18.702 L 12.814 16.772 L 16.773 12.814 L 18.703 14.744 C 19.099 15.159 19.099 15.812 18.703 16.228 L 16.228 18.702 C 15.813 19.097 15.16 19.097 14.744 18.702 Z  M 3.959 0.002 L 15.635 11.679 L 11.678 15.637 L 0 3.962 L 0 0.002 L 3.959 0.002 Z " fill="rgb(0,0,0)"/>
    <path d=" M 0.75 0.846 L 3.641 0.846 L 14.532 11.768 L 11.641 14.659 L 0.75 3.581 L 0.75 0.846 Z " fill="rgb(255,255,255)"/>
    <path d=" M 16.75 14.018 L 18.242 15.511 L 15.414 18.339 L 13.881 16.805 L 16.75 14.018 Z " fill="rgb(255,255,255)"/>
  </g>
</svg>`;

export const cursorMap = {
  // TODO these can now be designed custom. IE11 no linger required
  auto: 'auto',
  scaleNESW: 'nesw-resize',
  scaleNWSE: 'nwse-resize',
  rotate: 'crosshair',
  translate: 'move',
  select: 'pointer',
  edit: `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    pointerSvg,
  )}"), pointer`, // fa pencil
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

  cursorStyle: CSSStyleDeclaration | undefined;

  constructor(denyRemoval?: boolean) {
    super(
      EventType.MOVE,
      (denyRemoval
        ? ModificationKeyType.NONE
        : ModificationKeyType.NONE | ModificationKeyType.SHIFT) |
        ModificationKeyType.CTRL,
    );

    this.setActive();
  }

  pipe(event: EventAfterEventHandler): Promise<EventAfterEventHandler> {
    if (event.feature && (event.feature as Vertex)[vertexSymbol]) {
      this._currentVertex = event.feature as Vertex;
    } else {
      this._currentVertex = null;
    }
    if (!this.cursorStyle && event.map?.target) {
      this.cursorStyle = event.map.target.style;
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
    if (!this.cursorStyle) {
      return;
    }
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
