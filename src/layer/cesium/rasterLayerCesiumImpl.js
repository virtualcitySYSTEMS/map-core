import { vcsLayerName } from '../layerSymbols.js';
import LayerImplementation from '../layerImplementation.js';

/**
 * RasterLayer implementation for {@link Openlayers}
 * @class
 * @export
 * @extends {LayerImplementation<import("@vcmap/core").CesiumMap>}}
 * @implements {RasterLayerImplementation}
 */
class RasterLayerCesiumImpl extends LayerImplementation {
  static get className() { return 'RasterLayerCesiumImpl'; }

  /**
   * @param {import("@vcmap/core").CesiumMap} map
   * @param {RasterLayerImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);
    /** @type {import("@vcmap/cesium").ImageryLayer|null} */
    this.cesiumLayer = null;
    /** @type {import("@vcmap/cesium").SplitDirection} */
    this.splitDirection = options.splitDirection;
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
   * @inheritDoc
   * @returns {Promise<void>}
   */
  initialize() {
    if (!this.initialized) {
      this.cesiumLayer = this.getCesiumLayer();
      this.cesiumLayer[vcsLayerName] = this.name;
      this.cesiumLayer.show = false;
      this.map.addImageryLayer(this.cesiumLayer);
    }
    return super.initialize();
  }

  /**
   * @param {import("@vcmap/cesium").SplitDirection} splitDirection
   */
  updateSplitDirection(splitDirection) {
    this.splitDirection = splitDirection;
    if (this.initialized) {
      this.cesiumLayer.splitDirection = splitDirection;
    }
  }

  // eslint-disable-next-line jsdoc/require-returns-check
  /**
   * @returns {import("@vcmap/cesium").ImageryLayer}
   */
  // eslint-disable-next-line class-methods-use-this
  getCesiumLayer() { throw new Error('implementation error'); }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  async activate() {
    await super.activate();
    if (this.active) {
      this.cesiumLayer.show = true;
    }
  }

  /**
   * @inheritDoc
   */
  deactivate() {
    super.deactivate();
    if (this.cesiumLayer) {
      this.cesiumLayer.show = false;
    }
  }

  /**
   * @param {number} opacity
   */
  updateOpacity(opacity) {
    this.opacity = opacity;
    if (this.initialized && this.cesiumLayer) {
      this.cesiumLayer.alpha = opacity;
    }
  }

  /**
   * @inheritDoc
   */
  destroy() {
    if (this.cesiumLayer) {
      this.map.removeImageryLayer(this.cesiumLayer);
    }
    this.cesiumLayer = null;
    super.destroy();
  }
}

export default RasterLayerCesiumImpl;
