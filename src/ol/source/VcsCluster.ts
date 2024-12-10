import Cluster, { type Options } from 'ol/source/Cluster.js';
import Feature from 'ol/Feature.js';
import { Point } from 'ol/geom.js';
import { vectorClusterGroupName } from '../../vectorCluster/vectorClusterSymbols.js';
import { hidden } from '../../layer/featureVisibility.js';

/**
 * @class
 * @extends {import("ol/source/Cluster").default}
 * @memberOf ol
 */
class VcsCluster extends Cluster<Feature> {
  private _paused = false;

  constructor(
    props: Options<Feature>,
    private _name: string,
  ) {
    props.geometryFunction =
      props.geometryFunction ??
      ((feature: Feature): Point | null => {
        if (feature[hidden]) {
          return null;
        }
        return feature.getGeometry() as Point;
      });

    super(props);
    /**
     * @type {boolean}
     */
    this._paused = false;
  }

  addFeatures(features: Feature[]): void {
    features.forEach((f) => {
      f[vectorClusterGroupName] = this._name;
    });
    super.addFeatures(features);
  }

  get paused(): boolean {
    return this._paused;
  }

  set paused(pause: boolean) {
    this._paused = pause;
  }

  refresh(): void {
    if (this._paused) {
      return;
    }
    super.refresh();
  }
}

export default VcsCluster;
