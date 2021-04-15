import { getUid } from 'ol/util.js';
import VectorSource from 'ol/source/Vector.js';

/**
 * @class
 * @extends {ol/source/VectorSource}
 * @memberOf ol
 */
class ClusterEnhancedVectorSource extends VectorSource {
  /**
   * @param {ol/Feature} feature
   * @param {boolean=} silent
   */
  removeFeature(feature, silent) {
    const featureKey = getUid(feature);
    if (featureKey in this.nullGeometryFeatures_) {
      delete this.nullGeometryFeatures_[featureKey];
    } else if (this.featuresRtree_) {
      this.featuresRtree_.remove(feature);
    }
    this.removeFeatureInternal(feature);
    if (!silent) {
      this.changed();
    }
  }

  /**
   * @param {ol/Feature} feature
   * @param {boolean=} silent
   */
  addFeature(feature, silent) {
    this.addFeatureInternal(feature);
    if (!silent) {
      this.changed();
    }
  }
}

export default ClusterEnhancedVectorSource;
