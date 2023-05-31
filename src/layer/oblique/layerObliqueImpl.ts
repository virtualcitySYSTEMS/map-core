import type { Layer as OLLayer } from 'ol/layer.js';
import LayerImplementation from '../layerImplementation.js';
import { vcsLayerName } from '../layerSymbols.js';
import type ObliqueMap from '../../map/obliqueMap.js';

class LayerObliqueImpl extends LayerImplementation<ObliqueMap> {
  olLayer: OLLayer | null = null;

  initialize(): Promise<void> {
    if (!this.initialized) {
      this.olLayer = this.getOLLayer();
      this.olLayer[vcsLayerName] = this.name;
      this.map.addOLLayer(this.olLayer);
    }
    return super.initialize();
  }

  async activate(): Promise<void> {
    await super.activate();
    if (this.active && this.olLayer) {
      this.olLayer.setVisible(true);
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
   */
  // eslint-disable-next-line class-methods-use-this
  getOLLayer(): OLLayer {
    throw new Error();
  }

  destroy(): void {
    if (this.olLayer) {
      this.map.removeOLLayer(this.olLayer);
    }
    this.olLayer = null;
    super.destroy();
  }
}

export default LayerObliqueImpl;
