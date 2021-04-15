import { removeFeatureFromMap, addPrimitiveToContext, removeArrayFromCollection } from './vectorContext.js';

/**
 * @class
 * @memberOf vcs.vcm.layer.cesium
 */
class ClusterContext {
  /**
   * @param {Cesium/CustomDataSource} dataSource
   */
  constructor(dataSource) {
    /** @type {Cesium/EntityCollection} */
    this.entities = dataSource.entities;
    /** @type {Map<ol/Feature, Array<Cesium/Entity>>} */
    this.featureToBillboardMap = new Map();
    /** @type {Map<ol/Feature, Array<Cesium/Entity>>} */
    this.featureToLabelMap = new Map();
  }

  /**
   * @param {Array<Cesium/Primitive|Cesium/GroundPrimitive|Cesium/GroundPolylinePrimitive|Cesium/ClassificationPrimitive|Cesium/Model>} primitives
   * @param {ol/Feature} feature
   * @param {boolean=} allowPicking
   */
  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  addPrimitives(primitives, feature, allowPicking) {}

  /**
   * @param {Array<Object>} billboardOptions
   * @param {ol/Feature} feature
   * @param {boolean=} allowPicking
   */
  addBillboards(billboardOptions, feature, allowPicking) {
    addPrimitiveToContext(
      billboardOptions.map(billboard => ({ billboard, position: billboard.position })),
      feature,
      allowPicking,
      this.entities,
      this.featureToBillboardMap,
    );
  }

  /**
   * @param {Array<Object>} labelOptions
   * @param {ol/Feature} feature
   * @param {boolean=} allowPicking
   */
  addLabels(labelOptions, feature, allowPicking) {
    addPrimitiveToContext(
      labelOptions.map(label => ({ label, position: label.position })),
      feature,
      allowPicking,
      this.entities,
      this.featureToLabelMap,
    );
  }

  /**
   * @param {ol/Feature} feature
   */
  removeFeature(feature) {
    removeFeatureFromMap(feature, this.featureToBillboardMap, this.entities);
    removeFeatureFromMap(feature, this.featureToLabelMap, this.entities);
  }

  /**
   * Caches the current cesium resources for a feature, removing them from the feature map
   * @param {ol/Feature}feature
   * @returns {vcs.vcm.layer.cesium.VectorContext.FeatureCache}
   */
  createFeatureCache(feature) {
    /** @type {vcs.vcm.layer.cesium.VectorContext.FeatureCache} */
    const cache = {};
    cache.billboards = this.featureToBillboardMap.get(feature);
    this.featureToBillboardMap.delete(feature);
    cache.labels = this.featureToLabelMap.get(feature);
    this.featureToLabelMap.delete(feature);
    return cache;
  }

  /**
   * @param {vcs.vcm.layer.cesium.VectorContext.FeatureCache} cache
   */
  clearFeatureCache(cache) {
    removeArrayFromCollection(this.entities, cache.billboards);
    removeArrayFromCollection(this.entities, cache.labels);
  }

  clear() {
    this.entities.removeAll();
    this.featureToBillboardMap.clear();
    this.featureToLabelMap.clear();
  }
}

export default ClusterContext;
