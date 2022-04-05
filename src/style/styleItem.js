import { Cesium3DTileStyle, Cesium3DTileColorBlendMode } from '@vcmap/cesium';
import deepEqual from 'fast-deep-equal';

import { parseEnumValue } from '@vcsuite/parsers';
import VcsObject from '../vcsObject.js';
import VcsEvent from '../vcsEvent.js';
import { VcsClassRegistry } from '../classRegistry.js';

/**
 * @namespace style
 * @export
 * @api
 */

/**
 * @typedef {Object} StyleItemLegendEntry
 * @property {string} color - the color to display
 * @property {string|Object<string, string>} name - the name to display for the given color
 * @api
 */

/**
 * @typedef {VcsObjectOptions} StyleItemOptions
 * @property {string|undefined} [type] - used in configuration to differentiate vector from declarative styles
 * @property {string|Object<string, string>|undefined} title - name is used when none is specifies
 * @property {Array<StyleItemLegendEntry>|undefined} [legend]
 * @property {number} [colorBlendMode=import("@vcmap/cesium").Cesium3DTileColorBlendMode.HIGHLIGHT] - colorBlendMode for 3D Tiledataset @see https://cesiumjs.org/import("@vcmap/cesium").Build/Documentation/Cesium3DTileColorBlendMode.html
 * @api
 */

/**
 * @typedef {Object} Reference
 * @property {string} [type=StyleType.REFERENCE]
 * @property {string} name
 * @property {string|undefined} [url] - vcs:undocumented this is not yet implemented
 * @api
 */

/**
 * @typedef {Object} StyleItemSections
 * @property {boolean|undefined} [meta]
 * @api
 */

/**
 * Enumeration of possible style types.
 * @enum {string}
 * @property {string} VECTOR
 * @property {string} DECLARATIVE
 * @property {string} REFERENCE
 * @export
 * @api
 */
export const StyleType = {
  VECTOR: 'vector',
  DECLARATIVE: 'declarative',
  REFERENCE: 'reference',
  CLUSTER: 'cluster',
};

/**
 * indicates, that this style is part of the config and can be referenced by name
 * @type {symbol}
 * @export
 * @api
 */
export const referenceableStyleSymbol = Symbol('referencableStyleSymbol');

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

    /**
     * @type {string|Object<string, string>}
     */
    this.title = options.title || this.name.toString();

    /**
     * Legend entries
     * @type {Array<StyleItemLegendEntry>}
     * @api
     */
    this.legend = options.legend || [];

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
   * Gets the options for this style item to be used in a config or vcsMeta
   * @param {(VectorStyleItemSections|DeclarativeStyleItemSections)=} sections
   * @returns {VectorStyleItemOptions|DeclarativeStyleItemOptions}
   * @api
   */
  getOptions(sections) {
    if (sections && sections.meta) {
      return {
        name: this.name.toString(),
        title: this.title,
        legend: this.legend.length ? this.legend : undefined,
      };
    }
    return {};
  }

  /**
   * @inheritDoc
   * @returns {StyleItemOptions}
   */
  toJSON() {
    const config = { ...super.toJSON(), ...this.getOptions() };
    if (this.title) {
      config.title = this.title;
    }

    if (this.legend.length > 0) {
      config.legend = this.legend.slice();
    }

    return config;
  }

  /**
   * Clones this style
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
  // eslint-disable-next-line class-methods-use-this
  assign(styleItem) { return styleItem; }

  /**
   * @param {StyleItem} styleItem
   * @returns {boolean}
   * @api
   */
  equals(styleItem) {
    if (this !== styleItem) {
      const options = this.getOptions();
      const candidateOptions = styleItem.getOptions();
      return deepEqual(options, candidateOptions);
    }

    return true;
  }

  /**
   * gets a reference to this style by its name. should only be used for static styles, aka styles already part of the config
   * @returns {Reference}
   * @api
   */
  getReference() {
    return {
      type: StyleType.REFERENCE,
      name: this.name.toString(),
    };
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
VcsClassRegistry.registerClass(StyleItem.className, StyleItem);
