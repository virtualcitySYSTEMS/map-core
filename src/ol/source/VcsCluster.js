import Cluster from 'ol/source/Cluster.js';

/**
 * @class
 * @extends {import("ol/source/Cluster").default}
 * @memberOf ol
 */
class VcsCluster extends Cluster {
  constructor(props) {
    super(props);
    /**
     * @type {boolean}
     */
    this._paused = false;
  }

  pause() {
    this._paused = true;
  }

  resume() {
    this._paused = false;
  }

  isPaused() {
    return this._paused;
  }

  refresh() {
    if (this._paused) {
      return;
    }
    super.refresh();
  }
}

export default VcsCluster;
