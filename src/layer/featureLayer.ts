import Style, { type StyleFunction } from 'ol/style/Style.js';

import { check, oneOf } from '@vcsuite/check';
import { parseInteger } from '@vcsuite/parsers';
import { SplitDirection } from '@vcmap-cesium/engine';
import type {
  LayerImplementationOptions,
  LayerOptions,
  SplitLayer,
} from './layer.js';
import Layer from './layer.js';
import type { StyleItemOptions } from '../style/styleItem.js';
import StyleItem from '../style/styleItem.js';
import VectorStyleItem, {
  type VectorStyleItemOptions,
} from '../style/vectorStyleItem.js';
import FeatureVisibility from './featureVisibility.js';
import { getStyleOrDefaultStyle } from '../style/styleFactory.js';
import VcsEvent from '../vcsEvent.js';
import { layerClassRegistry } from '../classRegistry.js';
import type GlobalHider from './globalHider.js';
import type LayerImplementation from './layerImplementation.js';
import type VcsMap from '../map/vcsMap.js';
import type { DeclarativeStyleItemOptions } from '../style/declarativeStyleItem.js';

export type FeatureLayerOptions = LayerOptions & {
  style?: VectorStyleItemOptions | DeclarativeStyleItemOptions | StyleItem;
  balloonHeightOffset?: number;
  splitDirection?: string;
  featureVisibility?: FeatureVisibility;
};

export type FeatureLayerImplementationOptions = LayerImplementationOptions & {
  globalHider?: GlobalHider;
  splitDirection: SplitDirection;
  featureVisibility: FeatureVisibility;
  style: StyleItem;
};

export interface FeatureLayerImplementation {
  updateStyle(style: StyleItem, silent?: boolean): void;
  updateSplitDirection(direction: SplitDirection): void;
}

/**
 * Base class for all layers representing features, e.g. VectorLayer, Buildings, POIs
 * @group Layer
 */
class FeatureLayer<
    T extends LayerImplementation<VcsMap> & FeatureLayerImplementation,
  >
  extends Layer<T>
  implements SplitLayer
{
  static get className(): string {
    return 'FeatureLayer';
  }

  static getDefaultOptions(): FeatureLayerOptions {
    return {
      ...Layer.getDefaultOptions(),
      style: undefined,
      balloonHeightOffset: 10,
      splitDirection: undefined,
    };
  }

  private _style: StyleItem;

  protected _defaultStyle: StyleItem;

  /**
   * An event, called when the style of the layer changes. Is passed the new style item as its value.
   */
  readonly styleChanged = new VcsEvent<StyleItem>();

  /**
   * a height offset for rendering of a balloon for a feature of this layer.
   */
  balloonHeightOffset: number;

  private _splitDirection: SplitDirection = SplitDirection.NONE;

  /**
   * raised if the split direction changes, is passed the split direction as its only argument
   */
  readonly splitDirectionChanged = new VcsEvent<SplitDirection>();

  /**
   * FeatureVisibility tracks the highlighting and hiding of features on this layer
   */
  featureVisibility: FeatureVisibility;

  /**
   * @param  options
   */
  constructor(options: FeatureLayerOptions) {
    super(options);
    const defaultOptions = FeatureLayer.getDefaultOptions();

    this._style = this.getStyleOrDefaultStyle(options.style);
    this._defaultStyle = this._style;

    this.balloonHeightOffset = parseInteger(
      options.balloonHeightOffset,
      defaultOptions.balloonHeightOffset,
    );

    if (options.splitDirection) {
      this._splitDirection =
        options.splitDirection === 'left'
          ? SplitDirection.LEFT
          : SplitDirection.RIGHT;
    }

    this.featureVisibility =
      options.featureVisibility || new FeatureVisibility();
  }

  /**
   * The style the layer had at construction
   */
  get defaultStyle(): StyleItem {
    return this._defaultStyle;
  }

  /**
   * style, use setStyle to change
   */
  get style(): StyleItem {
    return this._style;
  }

  /**
   * The splitDirection to be applied - for 3D vector features currently only working on points with a Model
   */
  get splitDirection(): SplitDirection {
    return this._splitDirection;
  }

  set splitDirection(direction: SplitDirection) {
    if (direction !== this._splitDirection) {
      this.getImplementations().forEach((impl) => {
        (
          impl as LayerImplementation<VcsMap> & FeatureLayerImplementation
        ).updateSplitDirection(direction);
      });
      this._splitDirection = direction;
      this.splitDirectionChanged.raiseEvent(this._splitDirection);
    }
  }

  getImplementationOptions(): FeatureLayerImplementationOptions {
    return {
      ...super.getImplementationOptions(),
      globalHider: this.globalHider,
      featureVisibility: this.featureVisibility,
      style: this.style,
      splitDirection: this.splitDirection,
    };
  }

  setGlobalHider(globalHider: GlobalHider): void {
    super.setGlobalHider(globalHider);
    // eslint-disable-next-line no-void
    void this.forceRedraw();
  }

  // eslint-disable-next-line class-methods-use-this
  getStyleOrDefaultStyle(
    styleOptions?: StyleItemOptions | StyleItem,
    defaultStyle?: StyleItem,
  ): StyleItem {
    return getStyleOrDefaultStyle(styleOptions, defaultStyle);
  }

  /**
   * Sets the style based on a styleName on a layer
   */
  setStyle(style: Style | StyleFunction | StyleItem, silent?: boolean): void {
    check(style, oneOf(Style, StyleItem, Function));

    if (style instanceof StyleItem) {
      this._style = style;
    } else {
      this._style = new VectorStyleItem({});
      this._style.style = style;
    }
    this.getImplementations().forEach((impl) => {
      (
        impl as LayerImplementation<VcsMap> & FeatureLayerImplementation
      ).updateStyle(this._style, silent);
    });
    this.styleChanged.raiseEvent(this._style);
  }

  /**
   * Clears the style of this layer
   */
  clearStyle(): void {
    this.setStyle(this.defaultStyle);
  }

  toJSON(): FeatureLayerOptions {
    const config: FeatureLayerOptions = super.toJSON();
    if (!this.getStyleOrDefaultStyle().equals(this._style)) {
      config.style = this.style.toJSON();
    }
    if (this._splitDirection !== SplitDirection.NONE) {
      config.splitDirection =
        this._splitDirection === SplitDirection.RIGHT ? 'right' : 'left';
    }
    return config;
  }

  destroy(): void {
    if (this.featureVisibility) {
      this.featureVisibility.destroy();
    }
    this.styleChanged.destroy();
    this.splitDirectionChanged.destroy();
    super.destroy();
  }
}

layerClassRegistry.registerClass(FeatureLayer.className, FeatureLayer);
export default FeatureLayer;
