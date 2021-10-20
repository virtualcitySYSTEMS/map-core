import { ImagerySplitDirection } from '@vcmap/cesium';
import { unByKey } from 'ol/Observable.js';
import LayerOpenlayers from './layerOpenlayers.js';

/**
 * RasterLayer implementation for {@link vcs.vcm.maps.Openlayers}
 * @class
 * @memberOf vcs.vcm.layer.openlayers
 * @extends {vcs.vcm.layer.openlayers.LayerOpenlayers}
 * @implements {vcs.vcm.layer.RasterLayerImplementation}
 * @abstract
 */
class RasterLayerOpenlayers extends LayerOpenlayers {
  static get className() { return 'vcs.vcm.layer.openlayers.RasterLayerOpenlayers'; }

  /**
   * @param {vcs.vcm.maps.Openlayers} map
   * @param {vcs.vcm.layer.RasterLayer.ImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);
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
    /**
     * @type {Array<ol/events/EventsKey>|null}
     * @private
     */
    this._splitDirectionRenderListeners = null;
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  initialize() {
    return super.initialize()
      .then(() => {
        this.updateSplitDirection(this.splitDirection);
      });
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

  /**
   * @param {Cesium/ImagerySplitDirection} splitDirection
   */
  updateSplitDirection(splitDirection) {
    this.splitDirection = splitDirection;
    if (this.initialized) {
      if (this.splitDirection === ImagerySplitDirection.NONE && this._splitDirectionRenderListeners) {
        unByKey(this._splitDirectionRenderListeners);
        this._splitDirectionRenderListeners = null;
        this.olLayer.changed();
      } else if (splitDirection !== ImagerySplitDirection.NONE && !this._splitDirectionRenderListeners) {
        this._splitDirectionRenderListeners = [];
        this._splitDirectionRenderListeners
          .push(/** @type {ol/events/EventsKey} */ (this.olLayer.on('prerender', this._splitPreCompose.bind(this))));
        this._splitDirectionRenderListeners
          .push(/** @type {ol/events/EventsKey} */ (this.olLayer.on('postrender', (/** @type {ol/render/Event} */ event) => {
            event.context.restore();
          })));
        this.olLayer.changed();
      }
    }
  }

  /**
   * @param {ol/render/Event} event
   * @private
   */
  _splitPreCompose(event) {
    if (!this.map.splitScreen) {
      return;
    }
    const { context } = event;
    const width = context.canvas.width * this.map.splitScreen.position;
    context.save();
    context.beginPath();

    if (this.splitDirection === ImagerySplitDirection.LEFT) {
      context.rect(0, 0, width, context.canvas.height);
    } else {
      context.rect(width, 0, context.canvas.width - width, context.canvas.height);
    }
    context.clip();
  }

  /**
   * @inheritDoc
   */
  destroy() {
    if (this._splitDirectionRenderListeners) {
      unByKey(this._splitDirectionRenderListeners);
      this._splitDirectionRenderListeners = null;
    }
    super.destroy();
  }
}

export default RasterLayerOpenlayers;
