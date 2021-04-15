import Style from 'ol/style/Style.js';

import { check } from '@vcs/check';
import { parseInteger } from '@vcs/parsers';
import Layer from './layer.js';
import StyleItem, { referenceableStyleSymbol } from '../util/style/styleItem.js';
import VectorStyleItem from '../util/style/vectorStyleItem.js';
import FeatureVisibility from './featureVisibility.js';
import { getStyleOrDefaultStyle } from '../util/style/styleFactory.js';
import VcsEvent from '../event/vcsEvent.js';
import { styleCollection } from '../globalCollections.js';

/**
 * @typedef {vcs.vcm.layer.Layer.Options} vcs.vcm.layer.FeatureLayer.Options
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.Options|vcs.vcm.util.style.VectorStyleItem.Options|vcs.vcm.util.style.ClusterStyleItem.Options|vcs.vcm.util.style.StyleItem|string|undefined} style
 * @property {string|undefined} activeStyleName - vcs:undocumented
 * @property {Object|undefined} genericFeatureProperties - properties to add to generic features, eg for display in the balloon
 * @property {number} [balloonHeightOffset=10]
 * @property {vcs.vcm.layer.FeatureVisibility|undefined} featureVisibility - vcs:undocumented
 * @api
 */

/**
 * @typedef {vcs.vcm.layer.Layer.ImplementationOptions} vcs.vcm.layer.FeatureLayer.ImplementationOptions
 * @property {vcs.vcm.layer.FeatureVisibility} featureVisibility
 * @property {vcs.vcm.util.style.StyleItem} style
 * @api
 */

/**
 * Event called on a layers <b>styleChanged</b> property, when a layers style changes, with the following parameters.
 * @typedef {Object} vcs.vcm.layer.FeatureLayer.StyleChangedEvent
 * @property {vcs.vcm.util.style.StyleItem} newStyle
 * @property {vcs.vcm.util.style.StyleItem|undefined} oldStyle
 * @api
 */

/**
 * @typedef {vcs.vcm.layer.LayerImplementation<vcs.vcm.maps.VcsMap>} vcs.vcm.layer.FeatureLayerImplementation
 * @property {function(vcs.vcm.util.style.StyleItem, boolean=):void} updateStyle
 */

/**
 * Base class for all layers representing features, e.g. Vector, Buildings, POIs
 * @class
 * @memberOf vcs.vcm.layer
 * @abstract
 * @extends {vcs.vcm.layer.Layer}
 * @export
 * @api
 */
class FeatureLayer extends Layer {
  /** @type {string} */
  static get className() { return 'vcs.vcm.layer.FeatureLayer'; }

  /**
   * @returns {vcs.vcm.layer.FeatureLayer.Options}
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
   * @param {vcs.vcm.layer.FeatureLayer.Options} options
   */
  constructor(options) {
    super(options);
    const defaultOptions = FeatureLayer.getDefaultOptions();

    /**
     * @type {vcs.vcm.util.style.StyleItem}
     * @private
     */
    this._style = this.getStyleOrDefaultStyle(options.activeStyleName || options.style);
    /**
     * @type {vcs.vcm.util.style.StyleItem}
     * @private
     */
    this._defaultStyle = this._style;
    /**
     * An event, called when the style of the layer changes. Is passed the new style item as its value.
     * @type {vcs.vcm.event.VcsEvent<vcs.vcm.util.style.StyleItem>}
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
     * @type {vcs.vcm.layer.FeatureVisibility}
     */
    this.featureVisibility = options.featureVisibility || new FeatureVisibility();
  }

  /**
   * The style the layer had at construction
   * @type {vcs.vcm.util.style.StyleItem}
   * @api
   * @readonly
   */
  get defaultStyle() {
    return this._defaultStyle;
  }

  /**
   * style, use setStyle to change
   * @api
   * @type {vcs.vcm.util.style.StyleItem}
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
   * @returns {vcs.vcm.layer.FeatureLayer.ImplementationOptions}
   */
  getImplementationOptions() {
    return {
      ...super.getImplementationOptions(),
      featureVisibility: this.featureVisibility,
      style: this.style,
    };
  }

  /**
   * @param {Object|ol/Feature|Cesium/Cesium3DTilePointFeature|Cesium/Cesium3DTileFeature|vcs.vcm.layer.DataSource.PickedObject} object
   * @returns {?Object}
   */
  // eslint-disable-next-line no-unused-vars,class-methods-use-this
  objectClickedHandler(object) { // XXX remove after event implementation
    return null;
  }

  /**
   * This is called by the selectBehavior to create generic features from clicked objects
   * needs to be implemented by each layer which has clickable objects
   * @param {Object|vcs.vcm.layer.Vector.ClickedObject|ol/Feature} object
   * @returns {vcs.vcm.layer.GenericFeature}
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
   * @param {(vcs.vcm.util.style.Reference|vcs.vcm.util.style.DeclarativeStyleItem.Options|vcs.vcm.util.style.VectorStyleItem.Options|vcs.vcm.util.style.ClusterStyleItem.Options|vcs.vcm.util.style.StyleItem|string)=} styleOptions
   * @param {(vcs.vcm.util.style.VectorStyleItem|vcs.vcm.util.style.ClusterStyleItem|vcs.vcm.util.style.DeclarativeStyleItem)=} defaultStyle
   * @returns {vcs.vcm.util.style.StyleItem}
   */
  // eslint-disable-next-line class-methods-use-this
  getStyleOrDefaultStyle(styleOptions, defaultStyle) {
    return getStyleOrDefaultStyle(styleOptions, defaultStyle);
  }

  /**
   * Sets the style based on a styleName on a layer
   * @param {string|ol/style/Style|ol/style/StyleFunction|vcs.vcm.util.style.StyleItem} style
   * @param {boolean=} silent
   * @api
   */
  setStyle(style, silent) {
    check(style, [Style, StyleItem, Function, String]);

    if (typeof style === 'string') {
      const styleItem = styleCollection.getByKey(style);
      if (!styleItem) {
        this.getLogger().warning(`could not find style with name ${style}`);
        return;
      }
      this._style = styleItem;
    } else if (style instanceof StyleItem) {
      this._style = style;
    } else {
      this._style = new VectorStyleItem({});
      this._style.style = /** @type {ol/style/Style} */ (style);
    }
    this.getImplementations()
      .forEach((impl) => {
        /** @type {vcs.vcm.layer.FeatureLayerImplementation} */ (impl).updateStyle(this._style, silent);
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
   * @returns {vcs.vcm.layer.FeatureLayer.Options}
   */
  getConfigObject() {
    const config = /** @type {vcs.vcm.layer.FeatureLayer.Options} */ (super.getConfigObject());
    if (!this.getStyleOrDefaultStyle().equals(this._style)) {
      if (this._style[referenceableStyleSymbol]) {
        config.style = this.style.getReference();
      } else {
        config.style = this.style.getOptions();
      }
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

export default FeatureLayer;
