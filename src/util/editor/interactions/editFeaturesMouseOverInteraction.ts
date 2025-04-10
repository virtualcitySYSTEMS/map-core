import type { Feature } from 'ol/index.js';
import { handlerSymbol, mouseOverSymbol } from '../editorSymbols.js';
import type { EventAfterEventHandler } from '../../../interaction/abstractInteraction.js';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import {
  ModificationKeyType,
  EventType,
} from '../../../interaction/interactionType.js';
import { cursorMap } from './editGeometryMouseOverInteraction.js';

/**
 * A class to handle mouse over effects on features for editor sessions.
 * @extends {AbstractInteraction}
 */
class EditFeaturesMouseOverInteraction extends AbstractInteraction {
  private _currentHandler: Feature | null = null;

  cursorStyle: CSSStyleDeclaration | undefined;

  constructor() {
    super(EventType.MOVE, ModificationKeyType.NONE);

    this.setActive();
  }

  pipe(event: EventAfterEventHandler): Promise<EventAfterEventHandler> {
    if (event.feature && (event.feature as Feature)[handlerSymbol]) {
      this._currentHandler = event.feature as Feature;
    } else {
      this._currentHandler = null;
    }
    if (!this.cursorStyle && event.map?.target) {
      this.cursorStyle = event.map.target.style;
    }
    this._evaluate();
    return Promise.resolve(event);
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
      this.cursorStyle = undefined;
    }
  }

  private _evaluate(): void {
    if (!this.cursorStyle) {
      return;
    }
    if (this._currentHandler) {
      this.cursorStyle.cursor = cursorMap.translate;
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

export default EditFeaturesMouseOverInteraction;
