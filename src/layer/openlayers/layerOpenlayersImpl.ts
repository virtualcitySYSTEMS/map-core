import { SplitDirection } from '@vcmap-cesium/engine';
import { unByKey } from 'ol/Observable.js';
import type { EventsKey } from 'ol/events.js';
import type OLLayer from 'ol/layer/Layer.js';
import RenderEvent from 'ol/render/Event.js';
import { vcsLayerName } from '../layerSymbols.js';
import LayerImplementation from '../layerImplementation.js';
import type OpenlayersMap from '../../map/openlayersMap.js';
import { LayerImplementationOptions } from '../layer.js';

export type LayerOpenlayersImplementationOptions =
  LayerImplementationOptions & {
    splitDirection: SplitDirection;
  };

/**
 * Layer implementation for {@link OpenlayersMap}.
 * @extends {LayerImplementation<import("@vcmap/core").OpenlayersMap>}}
 */
class LayerOpenlayersImpl extends LayerImplementation<OpenlayersMap> {
  static get className(): string {
    return 'LayerOpenlayersImpl';
  }

  olLayer: OLLayer | null = null;

  splitDirection: SplitDirection;

  private _splitDirectionRenderListeners: EventsKey[] | null = null;

  constructor(
    map: OpenlayersMap,
    options: LayerOpenlayersImplementationOptions,
  ) {
    super(map, options);
    this.splitDirection = options.splitDirection;
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      this.olLayer = this.getOLLayer();
      this.olLayer[vcsLayerName] = this.name;
      this.map.addOLLayer(this.olLayer);
    }
    await super.initialize();
    this.updateSplitDirection(this.splitDirection);
  }

  async activate(): Promise<void> {
    await super.activate();
    if (this.active) {
      this.olLayer!.setVisible(true);
    }
  }

  deactivate(): void {
    super.deactivate();
    if (this.olLayer) {
      this.olLayer.setVisible(false);
    }
  }

  /**
   * returns the ol Layer
   * @returns {import("ol/layer").Layer<import("ol/source/Source").default>}
   */
  // eslint-disable-next-line class-methods-use-this
  getOLLayer(): OLLayer {
    throw new Error();
  }

  updateSplitDirection(splitDirection: SplitDirection): void {
    this.splitDirection = splitDirection;
    if (this.initialized) {
      if (
        this.splitDirection === SplitDirection.NONE &&
        this._splitDirectionRenderListeners
      ) {
        unByKey(this._splitDirectionRenderListeners);
        this._splitDirectionRenderListeners = null;
        this.olLayer?.changed();
      } else if (
        splitDirection !== SplitDirection.NONE &&
        !this._splitDirectionRenderListeners
      ) {
        this._splitDirectionRenderListeners = [];
        this._splitDirectionRenderListeners.push(
          this.olLayer!.on('prerender', this._splitPreRender.bind(this)),
        );
        this._splitDirectionRenderListeners.push(
          this.olLayer!.on('postrender', (event) => {
            (event.context as CanvasRenderingContext2D).restore();
          }),
        );
        this.olLayer!.changed();
      }
    }
  }

  private _splitPreRender(event: RenderEvent): void {
    // eslint-disable-next-line prefer-destructuring
    const context = event.context as CanvasRenderingContext2D;
    const width = context.canvas.width * this.map.splitPosition;
    context.save();
    context.beginPath();

    if (this.splitDirection === SplitDirection.LEFT) {
      context.rect(0, 0, width, context.canvas.height);
    } else {
      context.rect(
        width,
        0,
        context.canvas.width - width,
        context.canvas.height,
      );
    }
    context.clip();
  }

  destroy(): void {
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
