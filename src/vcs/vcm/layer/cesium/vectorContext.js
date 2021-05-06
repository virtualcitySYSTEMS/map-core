import PrimitiveCollection from '@vcmap/cesium/Source/Scene/PrimitiveCollection.js';
import BillboardCollection from '@vcmap/cesium/Source/Scene/BillboardCollection.js';
import LabelCollection from '@vcmap/cesium/Source/Scene/LabelCollection.js';

/**
 * @typedef {Object} vcs.vcm.layer.cesium.VectorContext.FeatureCache
 * @property {Array<Cesium/Primitive|Cesium/GroundPrimitive|Cesium/GroundPolylinePrimitive|Cesium/ClassificationPrimitive|Cesium/Model>|undefined} primitives
 * @property {Array<Cesium/Billboard|Cesium/Entity>|undefined} billboards
 * @property {Array<Cesium/Label|Cesium/Entity>|undefined} labels
 */

/**
 * @param {ol/Feature} feature
 * @param {Cesium/Primitive|Cesium/GroundPrimitive|Cesium/GroundPolylinePrimitive|Cesium/ClassificationPrimitive|Cesium/Label|Cesium/Billboard|Cesium/Entity|Cesium/Model} primitive
 */
export function setReferenceForPicking(feature, primitive) {
  primitive.olFeature = feature;
}

/**
 * @param {Cesium/PrimitiveCollection|Cesium/BillboardCollection|Cesium/LabelCollection|Cesium/EntityCollection=} collection
 * @param {Array<Cesium/Primitive|Cesium/GroundPrimitive|Cesium/GroundPolylinePrimitive|Cesium/ClassificationPrimitive|Cesium/Billboard|Cesium/Label|Cesium/Entity|Cesium/Model>=} array
 */
export function removeArrayFromCollection(collection, array) {
  if (array) {
    array.forEach((primitive) => {
      collection.remove(primitive);
    });
  }
}

/**
 * @param {ol/Feature} feature
 * @param {Map<ol/Feature, Array<Cesium/Primitive|Cesium/GroundPrimitive|Cesium/GroundPolylinePrimitive|Cesium/ClassificationPrimitive|Cesium/Billboard|Cesium/Label|Cesium/Entity|Cesium/Model>>} featuresMap
 * @param {Cesium/PrimitiveCollection|Cesium/BillboardCollection|Cesium/LabelCollection|Cesium/EntityCollection} primitiveCollection
 */
export function removeFeatureFromMap(feature, featuresMap, primitiveCollection) {
  removeArrayFromCollection(primitiveCollection, featuresMap.get(feature));
  featuresMap.delete(feature);
}

/**
 * @param {Array<Cesium/Primitive|Cesium/GroundPrimitive|Cesium/GroundPolylinePrimitive|Cesium/ClassificationPrimitive|Cesium/Entity.ConstructorOptions|Cesium/Model|Object>} primitives
 * @param {ol/Feature} feature
 * @param {boolean} allowPicking
 * @param {Cesium/BillboardCollection|Cesium/LabelCollection|Cesium/PrimitiveCollection|Cesium/EntityCollection} primitiveCollection
 * @param {Map<ol/Feature, Array<Cesium/Billboard|Cesium/Label|Cesium/Primitive|Cesium/GroundPrimitive|Cesium/GroundPolylinePrimitive|Cesium/ClassificationPrimitive|Cesium/Entity|Cesium/Model>>} featureMap
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
 * @memberOf vcs.vcm.layer.cesium
 */
class VectorContext {
  /**
   * @param {Cesium/Scene} scene
   * @param {Cesium/PrimitiveCollection} rootCollection
   */
  constructor(scene, rootCollection) {
    /** @type {Cesium/PrimitiveCollection} */
    this.primitives = new PrimitiveCollection();
    /** @type {Cesium/BillboardCollection} */
    this.billboards = new BillboardCollection({ scene });
    /** @type {Cesium/LabelCollection} */
    this.labels = new LabelCollection({ scene });
    /** @type {Map<ol/Feature, Array<Cesium/Primitive|Cesium/GroundPrimitive|Cesium/GroundPolylinePrimitive|Cesium/ClassificationPrimitive|Cesium/Model>>} */
    this.featureToPrimitiveMap = new Map();
    /** @type {Map<ol/Feature, Array<Cesium/Billboard>>} */
    this.featureToBillboardMap = new Map();
    /** @type {Map<ol/Feature, Array<Cesium/Label>>} */
    this.featureToLabelMap = new Map();

    rootCollection.add(this.primitives);
    rootCollection.add(this.billboards);
    rootCollection.add(this.labels);
  }

  /**
   * @param {Array<Cesium/Primitive|Cesium/GroundPrimitive|Cesium/GroundPolylinePrimitive|Cesium/ClassificationPrimitive|Cesium/Model>} primitives
   * @param {ol/Feature} feature
   * @param {boolean=} allowPicking
   */
  addPrimitives(primitives, feature, allowPicking) {
    addPrimitiveToContext(primitives, feature, allowPicking, this.primitives, this.featureToPrimitiveMap);
  }

  /**
   * @param {Array<Object>} billboardOptions
   * @param {ol/Feature} feature
   * @param {boolean=} allowPicking
   */
  addBillboards(billboardOptions, feature, allowPicking) {
    addPrimitiveToContext(billboardOptions, feature, allowPicking, this.billboards, this.featureToBillboardMap);
  }

  /**
   * @param {Array<Object>} labelOptions
   * @param {ol/Feature} feature
   * @param {boolean=} allowPicking
   */
  addLabels(labelOptions, feature, allowPicking) {
    addPrimitiveToContext(labelOptions, feature, allowPicking, this.labels, this.featureToLabelMap);
  }

  /**
   * @param {ol/Feature} feature
   */
  removeFeature(feature) {
    removeFeatureFromMap(feature, this.featureToPrimitiveMap, this.primitives);
    removeFeatureFromMap(feature, this.featureToBillboardMap, this.billboards);
    removeFeatureFromMap(feature, this.featureToLabelMap, this.labels);
  }

  /**
   * Caches the current cesium resources for a feature, removing them from the feature map
   * @param {ol/Feature}feature
   * @returns {vcs.vcm.layer.cesium.VectorContext.FeatureCache}
   */
  createFeatureCache(feature) {
    /** @type {vcs.vcm.layer.cesium.VectorContext.FeatureCache} */
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
   * @param {vcs.vcm.layer.cesium.VectorContext.FeatureCache} cache
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
