import AbstractInteraction, {
  EventAfterEventHandler,
  EventFeature,
} from '../../../interaction/abstractInteraction.js';
import {
  EventType,
  ModificationKeyType,
} from '../../../interaction/interactionType.js';
import SelectMultiFeatureInteraction from './selectMultiFeatureInteraction.js';
import SelectSingleFeatureInteraction from './selectSingleFeatureInteraction.js';
import { cursorMap } from './editGeometryMouseOverInteraction.js';
import { vcsLayerName } from '../../../layer/layerSymbols.js';
import { mouseOverSymbol } from '../editorSymbols.js';

/**
 * Enumeration of editor selection modes.
 */
export enum SelectionMode {
  SINGLE = 'single',
  MULTI = 'multi',
}

/**
 * A class to handle mouse over effects on features for select sessions.
 */
class SelectFeatureMouseOverInteraction extends AbstractInteraction {
  private _selectFeatureInteraction:
    | SelectSingleFeatureInteraction
    | SelectMultiFeatureInteraction;

  selectionMode: SelectionMode;

  /**
   * The feature that is currently hovered and belongs to the layer with the layerName.
   */
  private _currentFeature: EventFeature | null = null;

  /**
   * The layer name to react to
   */
  layerName: string;

  private cursorStyle: CSSStyleDeclaration | undefined;

  constructor(
    layerName: string,
    selectFeatureInteraction:
      | SelectSingleFeatureInteraction
      | SelectMultiFeatureInteraction,
  ) {
    let modkeys;
    let selectionMode;
    if (selectFeatureInteraction instanceof SelectSingleFeatureInteraction) {
      modkeys = ModificationKeyType.NONE;
      selectionMode = SelectionMode.SINGLE;
    } else if (
      selectFeatureInteraction instanceof SelectMultiFeatureInteraction
    ) {
      modkeys = ModificationKeyType.NONE | ModificationKeyType.CTRL;
      selectionMode = SelectionMode.MULTI;
    } else {
      throw new Error('This interaction is not supported');
    }

    super(EventType.MOVE, modkeys);
    this._selectFeatureInteraction = selectFeatureInteraction;
    this.selectionMode = selectionMode;
    this.layerName = layerName;
  }

  pipe(event: EventAfterEventHandler): Promise<EventAfterEventHandler> {
    if (event.feature && event.feature[vcsLayerName] === this.layerName) {
      this._currentFeature = event.feature;
    } else {
      this._currentFeature = null;
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

  reset(): void {
    if (this.cursorStyle && this.cursorStyle.cursor) {
      this.cursorStyle.cursor = cursorMap.auto;
      this.cursorStyle = undefined;
    }
  }

  private _evaluate(modifier: ModificationKeyType): void {
    if (!this.cursorStyle) {
      return;
    }
    if (this._currentFeature) {
      const isCtrlPressed =
        this.selectionMode === SelectionMode.MULTI &&
        modifier & ModificationKeyType.CTRL;
      const isSelected = this._selectFeatureInteraction.hasFeatureId(
        this._currentFeature.getId() as string | number,
      );

      if (isCtrlPressed) {
        this.cursorStyle.cursor = isSelected
          ? cursorMap.removeFromSelection
          : cursorMap.addToSelection;
      } else {
        this.cursorStyle.cursor = cursorMap.select;
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

export default SelectFeatureMouseOverInteraction;
