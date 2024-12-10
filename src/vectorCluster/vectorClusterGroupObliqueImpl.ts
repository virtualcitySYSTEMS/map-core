import OLVectorLayer from 'ol/layer/Vector.js';
import VectorClusterGroupImpl from './vectorClusterGroupImpl.js';
import ObliqueMap from '../map/obliqueMap.js';
import VcsCluster from '../ol/source/VcsCluster.js';
import { VectorClusterGroupImplementationOptions } from './vectorClusterGroup.js';
import {
  createSourceObliqueSync,
  SourceObliqueSync,
} from '../layer/oblique/sourceObliqueSync.js';
import { vectorClusterGroupName } from './vectorClusterSymbols.js';

export default class VectorClusterGroupObliqueImpl extends VectorClusterGroupImpl<ObliqueMap> {
  private _clusterSource: VcsCluster;

  private _olLayer: OLVectorLayer | undefined;

  private _sourceObliqueSync: SourceObliqueSync;

  constructor(
    map: ObliqueMap,
    options: VectorClusterGroupImplementationOptions,
  ) {
    super(map, options);

    this._sourceObliqueSync = createSourceObliqueSync(options.source, map);
    this._clusterSource = new VcsCluster(
      {
        source: this._sourceObliqueSync.obliqueSource,
        distance: options.clusterDistance,
      },
      this.name,
    );
  }

  get clusterSource(): VcsCluster {
    return this._clusterSource;
  }

  get olLayer(): OLVectorLayer | undefined {
    return this._olLayer;
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      const olLayer = new OLVectorLayer({
        visible: false,
        source: this._clusterSource,
        style: this.style,
        zIndex: Number.MAX_SAFE_INTEGER,
      });
      olLayer[vectorClusterGroupName] = this.name;
      this._olLayer = olLayer;
      this.map.addOLLayer(this._olLayer);
    }
    await super.initialize();
  }

  async activate(): Promise<void> {
    await super.activate();
    if (this.active) {
      this._olLayer?.setVisible(true);
      this._clusterSource.paused = false;
      this._clusterSource.refresh();
      this._sourceObliqueSync.activate();
    }
  }

  deactivate(): void {
    super.deactivate();
    this._olLayer?.setVisible(false);
    this._clusterSource.paused = true;
    this._sourceObliqueSync.deactivate();
  }

  destroy(): void {
    if (this._olLayer) {
      this.map.removeOLLayer(this._olLayer);
    }
    this._olLayer = undefined;

    this._sourceObliqueSync.destroy();
    super.destroy();
  }
}
