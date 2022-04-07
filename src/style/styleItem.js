import { Cesium3DTileStyle, Cesium3DTileColorBlendMode } from '@vcmap/cesium';
import deepEqual from 'fast-deep-equal';

import { parseEnumValue } from '@vcsuite/parsers';
import VcsObject from '../vcsObject.js';
import VcsEvent from '../vcsEvent.js';
import { styleClassRegistry } from '../classRegistry.js';

/**
 * @typedef {Object} StyleItemLegendEntry
 * @property {string} color - the color to display
 * @property {string|Object<string, string>} name - the name to display for the given color
 * @api
 */

/**
 * @typedef {VcsObjectOptions} StyleItemOptions
 * @property {number} [colorBlendMode=import("@vcmap/cesium").Cesium3DTileColorBlendMode.HIGHLIGHT] - colorBlendMode for 3D Tiledataset @see https://cesiumjs.org/import("@vcmap/cesium").Build/Documentation/Cesium3DTileColorBlendMode.html
 * @api
 */

/**
 * @typedef {Object} StyleItemSections
 * @property {boolean|undefined} [meta]
 * @api
 */

/**
 * An abstract style definition which can be applied to a layer
 * @class
 * @export
 * @api
 * @abstract
 * @extends {VcsObject}
 */
class StyleItem extends VcsObject {
  static get className() { return 'StyleItem'; }

  /**
   * @param {StyleItemOptions} options
   */
  constructor(options) {
    super(options);

    /** @type {Array<string>} */
    this.supportedLayers = [];

    /**
     * The 3D representation of this style
     * @type {import("@vcmap/cesium").Cesium3DTileStyle}
     * @api
     */
    this.cesiumStyle = new Cesium3DTileStyle({ show: true });

    /**
     * Fired on style updates
     * @type {VcsEvent<void>}
     * @api
     */
    this.styleChanged = new VcsEvent();

    /** @type {import("@vcmap/cesium").Cesium3DTileColorBlendMode} */
    this.colorBlendMode = /** @type {import("@vcmap/cesium").Cesium3DTileColorBlendMode} */(parseEnumValue(
      options.colorBlendMode, Cesium3DTileColorBlendMode, Cesium3DTileColorBlendMode.HIGHLIGHT,
    ));

    /**
     * @type {import("ol/style/Style").default|import("ol/style/Style").StyleFunction}
     * @protected
     */
    this._style = null;
  }

  /**
   * The 2D representation of this style
   * @type {import("ol/style/Style").default|import("ol/style/Style").StyleFunction}
   * @api
   */
  get style() { return this._style; }

  /**
   * @param {import("ol/style/Style").default|import("ol/style/Style").StyleFunction} style
   */
  set style(style) { this._style = style; }

  /**
   * @param {string} className
   * @returns {boolean}
   * @todo redundant, remove
   */
  isSupported(className) {
    return this.supportedLayers.length === 0 ||
      this.supportedLayers.indexOf(className) > -1;
  }

  /**
   * @inheritDoc
   * @returns {StyleItemOptions}
   */
  toJSON() {
    const config = /** @type {StyleItemOptions} */ (super.toJSON());
    if (this.colorBlendMode !== Cesium3DTileColorBlendMode.HIGHLIGHT) {
      config.colorBlendMode = this.colorBlendMode;
    }

    return config;
  }

  /**
   * Clones this style. Does not pass the name property.
   * @param {StyleItem=} result
   * @returns {StyleItem}
   * @api
   */
  // eslint-disable-next-line class-methods-use-this
  clone(result) { return result; }

  /**
   * @param {StyleItem} styleItem
   * @returns {StyleItem}
   * @api
   */
  assign(styleItem) {
    this.properties = JSON.parse(JSON.stringify(styleItem.properties));
    return this;
  }

  /**
   * Tests if two styleItems are equivalent. Does not match the name property (e.g. identifier)
   * @param {StyleItem} styleItem
   * @returns {boolean}
   * @api
   */
  equals(styleItem) {
    if (this !== styleItem) {
      const options = this.toJSON();
      delete options.name;
      const candidateOptions = styleItem.toJSON();
      delete candidateOptions.name;
      return deepEqual(options, candidateOptions);
    }

    return true;
  }

  /**
   * @protected
   */
  _styleChanged() {
    this.styleChanged.raiseEvent();
  }

  /**
   * @api
   */
  destroy() {
    this.cesiumStyle = null;
    this.styleChanged.destroy();
    super.destroy();
  }
}

export default StyleItem;
styleClassRegistry.registerClass(StyleItem.className, StyleItem);
