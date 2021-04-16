import Cesium3DTileStyle from 'cesium/Source/Scene/Cesium3DTileStyle.js';
import Cesium3DTileColorBlendMode from 'cesium/Source/Scene/Cesium3DTileColorBlendMode.js';
import deepEqual from 'fast-deep-equal';

import { parseEnumValue } from '@vcsuite/parsers';
import VcsObject from '../../object.js';
import VcsEvent from '../../event/vcsEvent.js';

/**
 * @namespace style
 * @memberOf vcs.vcm.util
 * @export
 * @api
 */

/**
 * @typedef {Object} vcs.vcm.util.style.StyleItem.LegendEntry
 * @property {string} color - the color to display
 * @property {string|Object<string, string>} name - the name to display for the given color
 * @api
 */

/**
 * @typedef {vcs.vcm.VcsObject.Options} vcs.vcm.util.style.StyleItem.Options
 * @property {string|undefined} type - used in configuration to differentiate vector from declarative styles
 * @property {string|Object<string, string>|undefined} title - name is used when none is specifies
 * @property {Array<vcs.vcm.util.style.StyleItem.LegendEntry>|undefined} legend
 * @property {number} [colorBlendMode=Cesium/Cesium3DTileColorBlendMode.HIGHLIGHT] - colorBlendMode for 3D Tiledataset @see https://cesiumjs.org/Cesium/Build/Documentation/Cesium3DTileColorBlendMode.html
 * @api
 */

/**
 * @typedef {Object} vcs.vcm.util.style.Reference
 * @property {string} [type=vcs.vcm.util.style.StyleType.REFERENCE]
 * @property {string} name
 * @property {string|undefined} url - vcs:undocumented this is not yet implemented
 * @api
 */

/**
 * @typedef {Object} vcs.vcm.util.style.StyleItem.Sections
 * @property {boolean|undefined} meta
 * @api
 */

/**
 * @enum {string}
 * @property {string} VECTOR
 * @property {string} DECLARATIVE
 * @property {string} REFERENCE
 * @memberOf vcs.vcm.util.style
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
 * @memberOf vcs.vcm.util.style
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
 * @extends {vcs.vcm.VcsObject}
 * @memberOf vcs.vcm.util.style
 */
class StyleItem extends VcsObject {
  static get className() { return 'vcs.vcm.util.style.StyleItem'; }

  /**
   * @param {vcs.vcm.util.style.StyleItem.Options} options
   */
  constructor(options) {
    super(options);

    /**
     * @type {string|Object<string, string>}
     */
    this.title = options.title || this.name.toString();

    /**
     * Legend entries
     * @type {Array<vcs.vcm.util.style.StyleItem.LegendEntry>}
     * @api
     */
    this.legend = options.legend || [];

    /** @type {Array<string>} */
    this.supportedLayers = [];

    /**
     * The 3D representation of this style
     * @type {Cesium/Cesium3DTileStyle}
     * @api
     */
    this.cesiumStyle = new Cesium3DTileStyle({ show: true });

    /**
     * Fired on style updates
     * @type {vcs.vcm.event.VcsEvent<void>}
     * @api
     */
    this.styleChanged = new VcsEvent();

    /** @type {Cesium/Cesium3DTileColorBlendMode} */
    this.colorBlendMode = parseEnumValue(
      options.colorBlendMode, Cesium3DTileColorBlendMode, Cesium3DTileColorBlendMode.HIGHLIGHT,
    );

    /**
     * @type {ol/style/Style|ol/style/StyleFunction}
     * @protected
     */
    this._style = null;
  }

  /**
   * The 2D representation of this style
   * @type {ol/style/Style|ol/style/StyleFunction}
   * @api
   */
  get style() { return this._style; }

  /**
   * @param {ol/style/Style|ol/style/StyleFunction} style
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
   * @param {(vcs.vcm.util.style.VectorStyleItem.Sections|vcs.vcm.util.style.DeclarativeStyleItem.Sections)=} sections
   * @returns {vcs.vcm.util.style.VectorStyleItem.Options|vcs.vcm.util.style.DeclarativeStyleItem.Options|vcs.vcm.util.style.ClusterStyleItem.Options}
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
   * Clones this style
   * @param {vcs.vcm.util.style.StyleItem=} result
   * @returns {vcs.vcm.util.style.StyleItem}
   * @api
   */
  // eslint-disable-next-line class-methods-use-this
  clone(result) { return result; }

  /**
   * @param {vcs.vcm.util.style.StyleItem} styleItem
   * @returns {vcs.vcm.util.style.StyleItem}
   * @api
   */
  // eslint-disable-next-line class-methods-use-this
  assign(styleItem) { return styleItem; }

  /**
   * @param {vcs.vcm.util.style.StyleItem} styleItem
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
   * @returns {vcs.vcm.util.style.Reference}
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
