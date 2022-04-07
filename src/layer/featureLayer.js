import Style from 'ol/style/Style.js';

import { check } from '@vcsuite/check';
import { parseInteger } from '@vcsuite/parsers';
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
 * @property {Object|undefined} genericFeatureProperties - properties to add to generic features, eg for display in the balloon
 * @property {number} [balloonHeightOffset=10]
 * @property {FeatureVisibility|undefined} featureVisibility - vcs:undocumented
 * @api
 */

/**
 * @typedef {LayerImplementationOptions} FeatureLayerImplementationOptions
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
 */

/**
 * Base class for all layers representing features, e.g. VectorLayer, Buildings, POIs
 * @class
 * @abstract
 * @extends {Layer}
 * @export
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
      genericFeatureProperties: {},
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
     * @type {Object}
     * @private
     */
    this._genericFeatureProperties = options.genericFeatureProperties || defaultOptions.genericFeatureProperties;

    /**
     * a height offset for rendering of a balloon for a feature of this layer.
     * @type {number}
     * @api
     */
    this.balloonHeightOffset = parseInteger(options.balloonHeightOffset, defaultOptions.balloonHeightOffset);

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
   * Generic properties to be added to each feature. Use assignGenericFeatureProperties to change them.
   * @type {Object}
   * @readonly
   */
  get genericFeatureProperties() {
    return this._genericFeatureProperties;
  }

  /**
   * @returns {FeatureLayerImplementationOptions}
   */
  getImplementationOptions() {
    return {
      ...super.getImplementationOptions(),
      featureVisibility: this.featureVisibility,
      style: this.style,
    };
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
   * This is called by the selectBehavior to create generic features from clicked objects
   * needs to be implemented by each layer which has clickable objects
   * @param {Object|VectorClickedObject|import("ol").Feature<import("ol/geom/Geometry").default>} object
   * @returns {GenericFeature}
   */
  // eslint-disable-next-line no-unused-vars
  getGenericFeatureFromClickedObject(object) { // XXX remove after event implementation
    this.getLogger().warning('This method should be implemented by any specific layers');
    return null;
  }

  /**
   * Set properties, which are always added to the generic object, eg. for use in balloons
   * @param {Object} properties
   * @api
   */
  assignGenericFeatureProperties(properties) {
    check(properties, Object);
    Object.assign(this._genericFeatureProperties, properties);
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

    if (Object.keys(this._genericFeatureProperties).length > 0) {
      config.genericFeatureProperties = { ...this._genericFeatureProperties };
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
    super.destroy();
  }
}

layerClassRegistry.registerClass(FeatureLayer.className, FeatureLayer);
export default FeatureLayer;
