import { removeFeatureFromMap, addPrimitiveToContext, removeArrayFromCollection } from './vectorContext.js';

/**
 * @class
 */
class ClusterContext {
  /**
   * @param {import("@vcmap/cesium").CustomDataSource} dataSource
   */
  constructor(dataSource) {
    /** @type {import("@vcmap/cesium").EntityCollection} */
    this.entities = dataSource.entities;
    /** @type {Map<import("ol").Feature<import("ol/geom/Geometry").default>, Array<import("@vcmap/cesium").Entity>>} */
    this.featureToBillboardMap = new Map();
    /** @type {Map<import("ol").Feature<import("ol/geom/Geometry").default>, Array<import("@vcmap/cesium").Entity>>} */
    this.featureToLabelMap = new Map();
  }

  /**
   * @param {Array<import("@vcmap/cesium").Primitive|import("@vcmap/cesium").GroundPrimitive|import("@vcmap/cesium").GroundPolylinePrimitive|import("@vcmap/cesium").ClassificationPrimitive|import("@vcmap/cesium").Model>} primitives
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @param {boolean=} allowPicking
   */
  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  addPrimitives(primitives, feature, allowPicking) {}

  /**
   * @param {Array<Object>} billboardOptions
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
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
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
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
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   */
  removeFeature(feature) {
    removeFeatureFromMap(feature, this.featureToBillboardMap, this.entities);
    removeFeatureFromMap(feature, this.featureToLabelMap, this.entities);
  }

  /**
   * Caches the current cesium resources for a feature, removing them from the feature map
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>}feature
   * @returns {VectorContextFeatureCache}
   */
  createFeatureCache(feature) {
    /** @type {VectorContextFeatureCache} */
    const cache = {};
    cache.billboards = this.featureToBillboardMap.get(feature);
    this.featureToBillboardMap.delete(feature);
    cache.labels = this.featureToLabelMap.get(feature);
    this.featureToLabelMap.delete(feature);
    return cache;
  }

  /**
   * @param {VectorContextFeatureCache} cache
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
