import OLVectorLayer from 'ol/layer/Vector.js';
import LayerOpenlayers from './layerOpenlayers.js';
import { synchronizeFeatureVisibility } from '../vectorHelpers.js';
import { getGlobalHider } from '../globalHider.js';

/**
 * represents a specific vectorlayer for openlayers.
 * @class
 * @export
 * @implements {vcs.vcm.layer.FeatureLayerImplementation}
 * @extends {vcs.vcm.layer.openlayers.LayerOpenlayers}
 * @memberOf vcs.vcm.layer.openlayers
 */
class VectorOpenlayers extends LayerOpenlayers {
  static get className() { return 'vcs.vcm.layer.openlayers.VectorOpenlayers'; }

  /**
   * @param {vcs.vcm.maps.Openlayers} map
   * @param {vcs.vcm.layer.Vector.ImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);
    /** @type {ol/source/Vector} */
    this.source = options.source;
    /** @type {vcs.vcm.util.style.StyleItem} */
    this.style = options.style;
    /** @type {number} */
    this.maxResolution = options.maxResolution;
    /** @type {number} */
    this.minResolution = options.minResolution;
    /** @type {vcs.vcm.layer.FeatureVisibility} */
    this.featureVisibility = options.featureVisibility;
    /**
     * @type {Array<Function>}
     * @private
     */
    this._featureVisibilityListeners = [];
    /** @type {ol/layer/Vector|null} */
    this.olLayer = null;
    this.globalHider = getGlobalHider();
  }

  /**
   * @param {vcs.vcm.util.style.StyleItem} style
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
   * @returns {ol/layer/Vector}
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
            synchronizeFeatureVisibility(this.featureVisibility, this.source, this.globalHider);
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

export default VectorOpenlayers;
