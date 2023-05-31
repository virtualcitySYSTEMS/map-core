import {
  Cesium3DTileStyle,
  Cesium3DTileColorBlendMode,
} from '@vcmap-cesium/engine';
import deepEqual from 'fast-deep-equal';
import type { StyleFunction } from 'ol/style/Style.js';
import type { Style } from 'ol/style.js';
import { parseEnumValue } from '@vcsuite/parsers';
import VcsObject, { type VcsObjectOptions } from '../vcsObject.js';
import VcsEvent from '../vcsEvent.js';
import { styleClassRegistry } from '../classRegistry.js';

export type StyleItemOptions = VcsObjectOptions & {
  colorBlendMode?: number;
};

/**
 * An abstract style definition which can be applied to a layer
 */
class StyleItem extends VcsObject {
  static get className(): string {
    return 'StyleItem';
  }

  supportedLayers: string[] = [];

  /**
   * The 3D representation of this style
   */
  cesiumStyle = new Cesium3DTileStyle({ show: true });

  /**
   * Fired on style updates
   */
  styleChanged: VcsEvent<void> = new VcsEvent();

  colorBlendMode: Cesium3DTileColorBlendMode;

  // eslint-disable-next-line class-methods-use-this
  protected _style: Style | StyleFunction = () => {};

  /**
   * @param  options
   */
  constructor(options: StyleItemOptions) {
    super(options);

    this.colorBlendMode = parseEnumValue(
      options.colorBlendMode,
      Cesium3DTileColorBlendMode,
      Cesium3DTileColorBlendMode.HIGHLIGHT,
    ) as Cesium3DTileColorBlendMode.HIGHLIGHT;
  }

  /**
   * The 2D representation of this style
   */
  get style(): Style | StyleFunction {
    return this._style;
  }

  set style(style: Style | StyleFunction) {
    this._style = style;
  }

  /**
   * @param  className
   * @todo redundant, remove
   */
  isSupported(className: string): boolean {
    return (
      this.supportedLayers.length === 0 ||
      this.supportedLayers.indexOf(className) > -1
    );
  }

  toJSON(): StyleItemOptions {
    const config: StyleItemOptions = super.toJSON();
    if (this.colorBlendMode !== Cesium3DTileColorBlendMode.HIGHLIGHT) {
      config.colorBlendMode = this.colorBlendMode;
    }

    return config;
  }

  /**
   * Clones this style. Does not pass the name property.
   * @param {StyleItem=} _result
   * @returns {StyleItem}
   */
  clone(_result?: StyleItem): StyleItem {
    return this;
  }

  /**
   * @param  styleItem
   */
  assign(styleItem: StyleItem): StyleItem {
    this.properties = JSON.parse(
      JSON.stringify(styleItem.properties),
    ) as Record<string, unknown>;
    return this;
  }

  /**
   * Tests if two styleItems are equivalent. Does not match the name property (e.g. identifier)
   * @param  styleItem
   */
  equals(styleItem: StyleItem): boolean {
    if (this !== styleItem) {
      const options = this.toJSON();
      delete options.name;
      const candidateOptions = styleItem.toJSON();
      delete candidateOptions.name;
      return deepEqual(options, candidateOptions);
    }

    return true;
  }

  protected _styleChanged(): void {
    this.styleChanged.raiseEvent();
  }

  destroy(): void {
    this.cesiumStyle = new Cesium3DTileStyle();
    this.styleChanged.destroy();
    super.destroy();
  }
}

export default StyleItem;
styleClassRegistry.registerClass(StyleItem.className, StyleItem);
