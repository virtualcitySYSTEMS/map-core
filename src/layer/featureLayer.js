import Style from 'ol/style/Style.js';

import { check } from '@vcsuite/check';
import { parseInteger } from '@vcsuite/parsers';
import { SplitDirection } from '@vcmap/cesium';
import Layer from './layer.js';
import StyleItem from '../style/styleItem.js';
import VectorStyleItem from '../style/vectorStyleItem.js';
import FeatureVisibility from './featureVisibility.js';
import { getStyleOrDefaultStyle } from '../style/styleFactory.js';
import VcsEvent from '../vcsEvent.js';
import { layerClassRegistry } from '../classRegistry.js';

/**
 * @typedef {LayerOptions} FeatureLayerOptions
 * @property {DeclarativeStyleItemOptions|VectorStyleItemOptions|import("@vcmap/core").StyleItem|undefined} style
 * @property {number} [balloonHeightOffset=10]
 * @property {string|undefined} splitDirection - either 'left' or 'right', if omitted none is applied (for 3D Vector currently only Models are split-able)
 * @property {FeatureVisibility|undefined} featureVisibility - vcs:undocumented
 * @api
 */

/**
 * @typedef {LayerImplementationOptions} FeatureLayerImplementationOptions
 * @property {GlobalHider} globalHider
 * @property {import("@vcmap/cesium").SplitDirection} splitDirection
 * @property {FeatureVisibility} featureVisibility
 * @property {import("@vcmap/core").StyleItem} style
 * @api
 */

/**
 * Event called on a layers <b>styleChanged</b> property, when a layers style changes, with the following parameters.
 * @typedef {Object} FeatureLayer.StyleChangedEvent
 * @property {import("@vcmap/core").StyleItem} newStyle
 * @property {import("@vcmap/core").StyleItem|undefined} oldStyle
 * @api
 */

/**
 * @typedef {import("@vcmap/core").LayerImplementation<import("@vcmap/core").VcsMap>} FeatureLayerImplementation
 * @property {function(import("@vcmap/core").StyleItem, boolean=):void} updateStyle
 * @property {function(import("@vcmap/cesium").SplitDirection):void} updateSplitDirection
 */

/**
 * Base class for all layers representing features, e.g. VectorLayer, Buildings, POIs
 * @class
 * @abstract
 * @extends {Layer}
 * @implements {SplitLayer}
 * @api
 */
class FeatureLayer extends Layer {
  /** @type {string} */
  static get className() { return 'FeatureLayer'; }

  /**
   * @returns {FeatureLayerOptions}
   */
  static getDefaultOptions() {
    return {
      ...Layer.getDefaultOptions(),
      style: undefined,
      balloonHeightOffset: 10,
      splitDirection: undefined,
    };
  }

  /**
   * @param {FeatureLayerOptions} options
   */
  constructor(options) {
    super(options);
    const defaultOptions = FeatureLayer.getDefaultOptions();

    /**
     * @type {import("@vcmap/core").StyleItem}
     * @private
     */
    this._style = this.getStyleOrDefaultStyle(options.style);
    /**
     * @type {import("@vcmap/core").StyleItem}
     * @private
     */
    this._defaultStyle = this._style;
    /**
     * An event, called when the style of the layer changes. Is passed the new style item as its value.
     * @type {VcsEvent<import("@vcmap/core").StyleItem>}
     * @api
     */
    this.styleChanged = new VcsEvent();
    /**
     * a height offset for rendering of a balloon for a feature of this layer.
     * @type {number}
     * @api
     */
    this.balloonHeightOffset = parseInteger(options.balloonHeightOffset, defaultOptions.balloonHeightOffset);
    /** @type {import("@vcmap/cesium").SplitDirection} */
    this._splitDirection = SplitDirection.NONE;

    if (options.splitDirection) {
      this._splitDirection = options.splitDirection === 'left' ?
        SplitDirection.LEFT :
        SplitDirection.RIGHT;
    }

    /**
     * raised if the split direction changes, is passed the split direction as its only argument
     * @type {VcsEvent<import("@vcmap/cesium").SplitDirection>}
     * @api
     */
    this.splitDirectionChanged = new VcsEvent();
    /**
     * FeatureVisibility tracks the highlighting and hiding of features on this layer
     * @type {FeatureVisibility}
     */
    this.featureVisibility = options.featureVisibility || new FeatureVisibility();
  }

  /**
   * The style the layer had at construction
   * @type {import("@vcmap/core").StyleItem}
   * @api
   * @readonly
   */
  get defaultStyle() {
    return this._defaultStyle;
  }

  /**
   * style, use setStyle to change
   * @api
   * @type {import("@vcmap/core").StyleItem}
   * @readonly
   */
  get style() {
    return this._style;
  }

  /**
   * @api
   * The splitDirection to be applied - for 3D vector features currently only working on points with a Model
   * @type {import("@vcmap/cesium").SplitDirection}
   */
  get splitDirection() { return this._splitDirection; }

  /**
   * @param {import("@vcmap/cesium").SplitDirection} direction
   */
  set splitDirection(direction) {
    if (direction !== this._splitDirection) {
      this.getImplementations().forEach((impl) => {
        /** @type {FeatureLayerImplementation} */ (impl).updateSplitDirection(direction);
      });
      this._splitDirection = direction;
      this.splitDirectionChanged.raiseEvent(this._splitDirection);
    }
  }

  /**
   * @returns {FeatureLayerImplementationOptions}
   */
  getImplementationOptions() {
    return {
      ...super.getImplementationOptions(),
      globalHider: this.globalHider,
      featureVisibility: this.featureVisibility,
      style: this.style,
      splitDirection: this.splitDirection,
    };
  }

  /**
   * @param {import("@vcmap/core").GlobalHider} globalHider
   */
  setGlobalHider(globalHider) {
    super.setGlobalHider(globalHider);
    this.forceRedraw();
  }

  /**
   * @param {Object|import("ol").Feature<import("ol/geom/Geometry").default>|import("@vcmap/cesium").Cesium3DTilePointFeature|import("@vcmap/cesium").Cesium3DTileFeature|DataSourcePickedObject} object
   * @returns {?Object}
   */
  // eslint-disable-next-line no-unused-vars,class-methods-use-this
  objectClickedHandler(object) { // XXX remove after event implementation
    return null;
  }

  /**
   * @param {(DeclarativeStyleItemOptions|VectorStyleItemOptions|import("@vcmap/core").StyleItem)=} styleOptions
   * @param {(import("@vcmap/core").VectorStyleItem|import("@vcmap/core").DeclarativeStyleItem)=} defaultStyle
   * @returns {import("@vcmap/core").StyleItem}
   */
  // eslint-disable-next-line class-methods-use-this
  getStyleOrDefaultStyle(styleOptions, defaultStyle) {
    return getStyleOrDefaultStyle(styleOptions, defaultStyle);
  }

  /**
   * Sets the style based on a styleName on a layer
   * @param {import("ol/style/Style").default|import("ol/style/Style").StyleFunction|import("@vcmap/core").StyleItem} style
   * @param {boolean=} silent
   * @api
   */
  setStyle(style, silent) {
    check(style, [Style, StyleItem, Function]);

    if (style instanceof StyleItem) {
      this._style = style;
    } else {
      this._style = new VectorStyleItem({});
      this._style.style = /** @type {import("ol/style/Style").default} */ (style);
    }
    this.getImplementations()
      .forEach((impl) => {
        /** @type {FeatureLayerImplementation} */ (impl).updateStyle(this._style, silent);
      });
    this.styleChanged.raiseEvent(this._style);
  }

  /**
   * Clears the style of this layer
   * @api stable
   */
  clearStyle() {
    this.setStyle(this.defaultStyle);
  }

  /**
   * @returns {FeatureLayerOptions}
   */
  toJSON() {
    const config = /** @type {FeatureLayerOptions} */ (super.toJSON());
    if (!this.getStyleOrDefaultStyle().equals(this._style)) {
      config.style = this.style.toJSON();
    }
    if (this._splitDirection !== SplitDirection.NONE) {
      config.splitDirection = this._splitDirection === SplitDirection.RIGHT ?
        'right' :
        'left';
    }
    return config;
  }

  /**
   * @inheritDoc
   */
  destroy() {
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
