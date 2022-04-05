import OLVectorLayer from 'ol/layer/Vector.js';
import LayerOpenlayersImpl from './layerOpenlayersImpl.js';
import { synchronizeFeatureVisibilityWithSource } from '../vectorHelpers.js';
import { getGlobalHider } from '../globalHider.js';

/**
 * represents a specific vectorlayer for openlayers.
 * @class
 * @export
 * @implements {FeatureLayerImplementation}
 * @extends {LayerOpenlayersImpl}
 */
class VectorOpenlayersImpl extends LayerOpenlayersImpl {
  static get className() { return 'VectorOpenlayersImpl'; }

  /**
   * @param {import("@vcmap/core").OpenlayersMap} map
   * @param {VectorImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);
    /** @type {import("ol/source").Vector<import("ol/geom/Geometry").default>} */
    this.source = options.source;
    /** @type {import("@vcmap/core").StyleItem} */
    this.style = options.style;
    /** @type {number} */
    this.maxResolution = options.maxResolution;
    /** @type {number} */
    this.minResolution = options.minResolution;
    /** @type {import("@vcmap/core").FeatureVisibility} */
    this.featureVisibility = options.featureVisibility;
    /**
     * @type {Array<Function>}
     * @private
     */
    this._featureVisibilityListeners = [];
    /** @type {import("ol/layer/Vector").default<import("ol/source").Vector<import("ol/geom/Geometry").default>>|null} */
    this.olLayer = null;
    this.globalHider = getGlobalHider();
  }

  /**
   * @param {import("@vcmap/core").StyleItem} style
   * @param {boolean=} silent
   */
  // eslint-disable-next-line no-unused-vars
  updateStyle(style, silent) {
    this.style = style;
    if (this.initialized) {
      this.olLayer.setStyle(this.style.style);
    }
  }

  /**
   * @inheritDoc
   * @returns {import("ol/layer/Vector").default<import("ol/source").Vector<import("ol/geom/Geometry").default>>}
   */
  getOLLayer() {
    const olLayer = new OLVectorLayer({
      visible: false,
      source: this.source,
      style: this.style.style,
    });

    if (this.minResolution) {
      olLayer.setMinResolution(this.minResolution);
    }
    if (this.maxResolution) {
      olLayer.setMaxResolution(this.maxResolution);
    }
    return olLayer;
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  async activate() {
    if (!this.active) {
      await super.activate();
      if (this.active) {
        if (this._featureVisibilityListeners.length === 0) {
          this._featureVisibilityListeners =
            synchronizeFeatureVisibilityWithSource(this.featureVisibility, this.source, this.globalHider);
        }
      }
    }
  }

  /**
   * @inheritDoc
   */
  deactivate() {
    super.deactivate();
    this._featureVisibilityListeners.forEach((cb) => { cb(); });
    this._featureVisibilityListeners = [];
  }

  /**
   * @param {boolean} visibility
   */
  setVisibility(visibility) {
    if (this.initialized) {
      this.olLayer.setVisible(visibility);
    }
  }

  /**
   * @inheritDoc
   */
  destroy() {
    this._featureVisibilityListeners.forEach((cb) => { cb(); });
    this._featureVisibilityListeners = [];
    super.destroy();
  }
}

export default VectorOpenlayersImpl;
