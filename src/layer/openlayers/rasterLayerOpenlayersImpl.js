import LayerOpenlayersImpl from './layerOpenlayersImpl.js';

/**
 * RasterLayer implementation for {@link Openlayers}
 * @class
 * @extends {LayerOpenlayersImpl}
 * @implements {RasterLayerImplementation}
 * @abstract
 */
class RasterLayerOpenlayersImpl extends LayerOpenlayersImpl {
  static get className() {
    return 'RasterLayerOpenlayersImpl';
  }

  /**
   * @param {import("@vcmap/core").OpenlayersMap} map
   * @param {RasterLayerImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);
    /** @type {number} */
    this.minLevel = options.minLevel;
    /** @type {number} */
    this.maxLevel = options.maxLevel;
    /** @type {string} */
    this.tilingSchema = options.tilingSchema;
    /** @type {import("@vcmap/core").Extent} */
    this.extent = options.extent;
    /** @type {number} */
    this.opacity = options.opacity;
  }

  /**
   * @param {number} opacity
   */
  updateOpacity(opacity) {
    this.opacity = opacity;
    if (this.initialized) {
      this.olLayer.setOpacity(this.opacity);
    }
  }
}

export default RasterLayerOpenlayersImpl;
