import VectorSource from 'ol/source/Vector.js';
import type Feature from 'ol/Feature.js';

/**
 * @class
 * @extends {import("ol/source").Vector<import("ol/geom/Geometry").default>}
 * @memberOf ol
 */
class ClusterEnhancedVectorSource extends VectorSource {
  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @param {boolean=} silent
   */
  removeFeature(feature: Feature, silent?: boolean): void {
    if (!feature) {
      return;
    }
    const removed = this.removeFeatureInternal(feature);
    if (removed && !silent) {
      this.changed();
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @param {boolean=} silent
   */
  addFeature(feature: Feature, silent?: boolean): void {
    this.addFeatureInternal(feature);
    if (!silent) {
      this.changed();
    }
  }
}

export default ClusterEnhancedVectorSource;
