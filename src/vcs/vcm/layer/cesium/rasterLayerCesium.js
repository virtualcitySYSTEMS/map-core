import { vcsLayerName } from '../layerSymbols.js';
import LayerImplementation from '../layerImplementation.js';

/**
 * RasterLayer implementation for {@link vcs.vcm.maps.Openlayers}
 * @class
 * @export
 * @extends {vcs.vcm.layer.LayerImplementation<vcs.vcm.maps.CesiumMap>}
 * @implements {vcs.vcm.layer.RasterLayerImplementation}
 * @memberOf vcs.vcm.layer.cesium
 */
class RasterLayerCesium extends LayerImplementation {
  static get className() { return 'vcs.vcm.layer.cesium.RasterLayerCesium'; }

  /**
   * @param {vcs.vcm.maps.CesiumMap} map
   * @param {vcs.vcm.layer.RasterLayer.ImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);
    /** @type {Cesium/ImageryLayer|null} */
    this.cesiumLayer = null;
    /** @type {Cesium/ImagerySplitDirection} */
    this.splitDirection = options.splitDirection;
    /** @type {number} */
    this.minLevel = options.minLevel;
    /** @type {number} */
    this.maxLevel = options.maxLevel;
    /** @type {string} */
    this.tilingSchema = options.tilingSchema;
    /** @type {vcs.vcm.util.Extent} */
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
   * @param {Cesium/ImagerySplitDirection} splitDirection
   */
  updateSplitDirection(splitDirection) {
    this.splitDirection = splitDirection;
    if (this.initialized) {
      this.cesiumLayer.splitDirection = splitDirection;
    }
  }

  // eslint-disable-next-line jsdoc/require-returns-check
  /**
   * @returns {Cesium/ImageryLayer}
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

export default RasterLayerCesium;
