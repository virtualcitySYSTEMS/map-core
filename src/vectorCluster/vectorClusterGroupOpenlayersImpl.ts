import OLVectorLayer from 'ol/layer/Vector.js';
import { VectorClusterGroupImplementationOptions } from './vectorClusterGroup.js';
import OpenlayersMap from '../map/openlayersMap.js';
import VcsCluster from '../ol/source/VcsCluster.js';
import VectorClusterGroupImpl from './vectorClusterGroupImpl.js';
import { vectorClusterGroupName } from './vectorClusterSymbols.js';

export default class VectorClusterGroupOpenlayersImpl extends VectorClusterGroupImpl<OpenlayersMap> {
  static get className(): string {
    return 'VectorClusterGroupOpenlayersImpl';
  }

  private _clusterSource: VcsCluster;

  private _olLayer: OLVectorLayer | undefined;

  constructor(
    map: OpenlayersMap,
    options: VectorClusterGroupImplementationOptions,
  ) {
    super(map, options);
    this._clusterSource = new VcsCluster(
      {
        source: options.source,
        distance: options.clusterDistance,
      },
      this.name,
    );
    this._clusterSource.paused = true;
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      const olLayer = new OLVectorLayer({
        visible: false,
        source: this._clusterSource,
        style: this.style,
      });

      olLayer[vectorClusterGroupName] = this.name;
      this._olLayer = olLayer;
      this.map.addOLLayer(this._olLayer);
    }
    await super.initialize();
  }

  get clusterSource(): VcsCluster {
    return this._clusterSource;
  }

  get olLayer(): OLVectorLayer | undefined {
    return this._olLayer;
  }

  async activate(): Promise<void> {
    await super.activate();
    if (this.active) {
      this._olLayer?.setVisible(true);
      this._clusterSource.paused = false;
      this._clusterSource.refresh();
    }
  }

  deactivate(): void {
    super.deactivate();
    this._olLayer?.setVisible(false);
    this._clusterSource.paused = true;
  }

  destroy(): void {
    if (this._olLayer) {
      this.map.removeOLLayer(this._olLayer);
    }
    this._olLayer = undefined;

    this._clusterSource.clear(true);
    this._clusterSource.dispose();
    super.destroy();
  }
}
