import { vcsLayerName } from '../layerSymbols.js';
import LayerImplementation from '../layerImplementation.js';

/**
 * Layer implementation for {@link CesiumMap}.
 * @class
 * @export
 * @extends {LayerImplementation<import("@vcmap/core").OpenlayersMap>}}
 */
class LayerOpenlayersImpl extends LayerImplementation {
  static get className() { return 'LayerOpenlayersImpl'; }

  /**
   * @param {import("@vcmap/core").OpenlayersMap} map
   * @param {LayerImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);
    /**
     * @type {import("ol/layer").Layer<import("ol/source/Source").default>|null}
     */
    this.olLayer = null;
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  initialize() {
    if (!this.initialized) {
      this.olLayer = this.getOLLayer();
      this.olLayer[vcsLayerName] = this.name;
      this.map.addOLLayer(this.olLayer);
    }
    return super.initialize();
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  async activate() {
    await super.activate();
    if (this.active) {
      this.olLayer.setVisible(true);
    }
  }

  /**
   * @inheritDoc
   */
  deactivate() {
    super.deactivate();
    if (this.olLayer) {
      this.olLayer.setVisible(false);
    }
  }

  // eslint-disable-next-line jsdoc/require-returns-check
  /**
   * returns the ol Layer
   * @returns {import("ol/layer").Layer<import("ol/source/Source").default>}
   */
  // eslint-disable-next-line class-methods-use-this
  getOLLayer() { throw new Error(); }

  /**
   * @inheritDoc
   */
  destroy() {
    if (this.olLayer) {
      this.map.removeOLLayer(this.olLayer);
    }
    this.olLayer = null;
    super.destroy();
  }
}

export default LayerOpenlayersImpl;
