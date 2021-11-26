import { PrimitiveCollection, BillboardCollection, LabelCollection } from '@vcmap/cesium';

/**
 * @typedef {Object} VectorContextFeatureCache
 * @property {Array<import("@vcmap/cesium").Primitive|import("@vcmap/cesium").GroundPrimitive|import("@vcmap/cesium").GroundPolylinePrimitive|import("@vcmap/cesium").ClassificationPrimitive|import("@vcmap/cesium").Model>|undefined} primitives
 * @property {Array<import("@vcmap/cesium").Billboard|import("@vcmap/cesium").Entity>|undefined} billboards
 * @property {Array<import("@vcmap/cesium").Label|import("@vcmap/cesium").Entity>|undefined} labels
 */

/**
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {import("@vcmap/cesium").Primitive|import("@vcmap/cesium").GroundPrimitive|import("@vcmap/cesium").GroundPolylinePrimitive|import("@vcmap/cesium").ClassificationPrimitive|import("@vcmap/cesium").Label|import("@vcmap/cesium").Billboard|import("@vcmap/cesium").Entity|import("@vcmap/cesium").Model} primitive
 */
export function setReferenceForPicking(feature, primitive) {
  primitive.olFeature = feature;
}

/**
 * @param {import("@vcmap/cesium").PrimitiveCollection|import("@vcmap/cesium").BillboardCollection|import("@vcmap/cesium").LabelCollection|import("@vcmap/cesium").EntityCollection=} collection
 * @param {Array<import("@vcmap/cesium").Primitive|import("@vcmap/cesium").GroundPrimitive|import("@vcmap/cesium").GroundPolylinePrimitive|import("@vcmap/cesium").ClassificationPrimitive|import("@vcmap/cesium").Billboard|import("@vcmap/cesium").Label|import("@vcmap/cesium").Entity|import("@vcmap/cesium").Model>=} array
 */
export function removeArrayFromCollection(collection, array) {
  if (array) {
    array.forEach((primitive) => {
      collection.remove(primitive);
    });
  }
}

/**
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {Map<import("ol").Feature<import("ol/geom/Geometry").default>, Array<import("@vcmap/cesium").Primitive|import("@vcmap/cesium").GroundPrimitive|import("@vcmap/cesium").GroundPolylinePrimitive|import("@vcmap/cesium").ClassificationPrimitive|import("@vcmap/cesium").Billboard|import("@vcmap/cesium").Label|import("@vcmap/cesium").Entity|import("@vcmap/cesium").Model>>} featuresMap
 * @param {import("@vcmap/cesium").PrimitiveCollection|import("@vcmap/cesium").BillboardCollection|import("@vcmap/cesium").LabelCollection|import("@vcmap/cesium").EntityCollection} primitiveCollection
 */
export function removeFeatureFromMap(feature, featuresMap, primitiveCollection) {
  removeArrayFromCollection(primitiveCollection, featuresMap.get(feature));
  featuresMap.delete(feature);
}

/**
 * @param {Array<import("@vcmap/cesium").Primitive|import("@vcmap/cesium").GroundPrimitive|import("@vcmap/cesium").GroundPolylinePrimitive|import("@vcmap/cesium").ClassificationPrimitive|import("@vcmap/cesium").Entity.ConstructorOptions|import("@vcmap/cesium").Model|Object>} primitives
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {boolean} allowPicking
 * @param {import("@vcmap/cesium").BillboardCollection|import("@vcmap/cesium").LabelCollection|import("@vcmap/cesium").PrimitiveCollection|import("@vcmap/cesium").EntityCollection} primitiveCollection
 * @param {Map<import("ol").Feature<import("ol/geom/Geometry").default>, Array<import("@vcmap/cesium").Billboard|import("@vcmap/cesium").Label|import("@vcmap/cesium").Primitive|import("@vcmap/cesium").GroundPrimitive|import("@vcmap/cesium").GroundPolylinePrimitive|import("@vcmap/cesium").ClassificationPrimitive|import("@vcmap/cesium").Entity|import("@vcmap/cesium").Model>>} featureMap
 */
export function addPrimitiveToContext(primitives, feature, allowPicking, primitiveCollection, featureMap) {
  if (primitives.length) {
    const cesiumPrimitives = primitives.map((primitiveOptions) => {
      const primitive = primitiveCollection.add(primitiveOptions);
      if (allowPicking) {
        setReferenceForPicking(feature, primitive);
      }
      return primitive;
    });
    if (!featureMap.has(feature)) {
      featureMap.set(feature, cesiumPrimitives);
    } else {
      featureMap.get(feature).push(...cesiumPrimitives);
    }
  }
}

/**
 * @class
 */
class VectorContext {
  /**
   * @param {import("@vcmap/cesium").Scene} scene
   * @param {import("@vcmap/cesium").PrimitiveCollection} rootCollection
   */
  constructor(scene, rootCollection) {
    /** @type {import("@vcmap/cesium").PrimitiveCollection} */
    this.primitives = new PrimitiveCollection();
    /** @type {import("@vcmap/cesium").BillboardCollection} */
    this.billboards = new BillboardCollection({ scene });
    /** @type {import("@vcmap/cesium").LabelCollection} */
    this.labels = new LabelCollection({ scene });
    /** @type {Map<import("ol").Feature<import("ol/geom/Geometry").default>, Array<import("@vcmap/cesium").Primitive|import("@vcmap/cesium").GroundPrimitive|import("@vcmap/cesium").GroundPolylinePrimitive|import("@vcmap/cesium").ClassificationPrimitive|import("@vcmap/cesium").Model>>} */
    this.featureToPrimitiveMap = new Map();
    /** @type {Map<import("ol").Feature<import("ol/geom/Geometry").default>, Array<import("@vcmap/cesium").Billboard>>} */
    this.featureToBillboardMap = new Map();
    /** @type {Map<import("ol").Feature<import("ol/geom/Geometry").default>, Array<import("@vcmap/cesium").Label>>} */
    this.featureToLabelMap = new Map();

    rootCollection.add(this.primitives);
    rootCollection.add(this.billboards);
    rootCollection.add(this.labels);
  }

  /**
   * @param {Array<import("@vcmap/cesium").Primitive|import("@vcmap/cesium").GroundPrimitive|import("@vcmap/cesium").GroundPolylinePrimitive|import("@vcmap/cesium").ClassificationPrimitive|import("@vcmap/cesium").Model>} primitives
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @param {boolean=} allowPicking
   */
  addPrimitives(primitives, feature, allowPicking) {
    addPrimitiveToContext(primitives, feature, allowPicking, this.primitives, this.featureToPrimitiveMap);
  }

  /**
   * @param {Array<Object>} billboardOptions
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @param {boolean=} allowPicking
   */
  addBillboards(billboardOptions, feature, allowPicking) {
    addPrimitiveToContext(billboardOptions, feature, allowPicking, this.billboards, this.featureToBillboardMap);
  }

  /**
   * @param {Array<Object>} labelOptions
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @param {boolean=} allowPicking
   */
  addLabels(labelOptions, feature, allowPicking) {
    addPrimitiveToContext(labelOptions, feature, allowPicking, this.labels, this.featureToLabelMap);
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   */
  removeFeature(feature) {
    removeFeatureFromMap(feature, this.featureToPrimitiveMap, this.primitives);
    removeFeatureFromMap(feature, this.featureToBillboardMap, this.billboards);
    removeFeatureFromMap(feature, this.featureToLabelMap, this.labels);
  }

  /**
   * Caches the current cesium resources for a feature, removing them from the feature map
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>}feature
   * @returns {VectorContextFeatureCache}
   */
  createFeatureCache(feature) {
    /** @type {VectorContextFeatureCache} */
    const cache = {};
    cache.primitives = this.featureToPrimitiveMap.get(feature);
    this.featureToPrimitiveMap.delete(feature);
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
    removeArrayFromCollection(this.primitives, cache.primitives);
    removeArrayFromCollection(this.billboards, cache.billboards);
    removeArrayFromCollection(this.labels, cache.labels);
  }

  /**
   * Clears all collections and maps
   * @api
   */
  clear() {
    this.primitives.removeAll();
    this.billboards.removeAll();
    this.labels.removeAll();
    this.featureToBillboardMap.clear();
    this.featureToLabelMap.clear();
    this.featureToPrimitiveMap.clear();
  }
}

export default VectorContext;
