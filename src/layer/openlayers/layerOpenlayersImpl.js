import { SplitDirection } from '@vcmap-cesium/engine';
import { unByKey } from 'ol/Observable.js';
import { vcsLayerName } from '../layerSymbols.js';
import LayerImplementation from '../layerImplementation.js';

/**
 * @typedef {LayerImplementationOptions} LayerOpenlayersImplementationOptions
 * @property {import("@vcmap-cesium/engine").SplitDirection} splitDirection
 */

/**
 * Layer implementation for {@link OpenlayersMap}.
 * @class
 * @extends {LayerImplementation<import("@vcmap/core").OpenlayersMap>}}
 */
class LayerOpenlayersImpl extends LayerImplementation {
  static get className() { return 'LayerOpenlayersImpl'; }

  /**
   * @param {import("@vcmap/core").OpenlayersMap} map
   * @param {LayerOpenlayersImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);
    /**
     * @type {import("ol/layer").Layer<import("ol/source/Source").default>|null}
     */
    this.olLayer = null;
    /** @type {import("@vcmap-cesium/engine").SplitDirection} */
    this.splitDirection = options.splitDirection;
    /**
     * @type {Array<import("ol/events").EventsKey>|null}
     * @private
     */
    this._splitDirectionRenderListeners = null;
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.initialized) {
      this.olLayer = this.getOLLayer();
      this.olLayer[vcsLayerName] = this.name;
      this.map.addOLLayer(this.olLayer);
    }
    await super.initialize();
    this.updateSplitDirection(this.splitDirection);
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
   * @param {import("@vcmap-cesium/engine").SplitDirection} splitDirection
   */
  updateSplitDirection(splitDirection) {
    this.splitDirection = splitDirection;
    if (this.initialized) {
      if (this.splitDirection === SplitDirection.NONE && this._splitDirectionRenderListeners) {
        unByKey(this._splitDirectionRenderListeners);
        this._splitDirectionRenderListeners = null;
        this.olLayer.changed();
      } else if (splitDirection !== SplitDirection.NONE && !this._splitDirectionRenderListeners) {
        this._splitDirectionRenderListeners = [];
        this._splitDirectionRenderListeners
          .push(/** @type {import("ol/events").EventsKey} */
            (this.olLayer.on('prerender', this._splitPreRender.bind(this))),
          );
        this._splitDirectionRenderListeners
          .push(/** @type {import("ol/events").EventsKey} */
            (this.olLayer.on('postrender', (/** @type {import("ol/render/Event").default} */ event) => {
              /** @type {CanvasRenderingContext2D} */ (event.context).restore();
            })),
          );
        this.olLayer.changed();
      }
    }
  }

  /**
   * @param {import("ol/render/Event").default} event
   * @private
   */
  _splitPreRender(event) {
    // eslint-disable-next-line prefer-destructuring
    const context = /** @type {CanvasRenderingContext2D} */ (event.context);
    const width = context.canvas.width * this.map.splitPosition;
    context.save();
    context.beginPath();

    if (this.splitDirection === SplitDirection.LEFT) {
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
    if (this.olLayer) {
      this.map.removeOLLayer(this.olLayer);
    }
    this.olLayer = null;
    if (this._splitDirectionRenderListeners) {
      unByKey(this._splitDirectionRenderListeners);
      this._splitDirectionRenderListeners = null;
    }
    super.destroy();
  }
}

export default LayerOpenlayersImpl;
