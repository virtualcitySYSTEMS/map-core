import {
  PrimitiveCollection,
  BillboardCollection,
  LabelCollection,
  Matrix4,
  Cartesian3,
  Math as CesiumMath,
  Model,
} from '@vcmap-cesium/engine';
import Viewpoint from '../../util/viewpoint.js';

/**
 * @typedef {Object} VectorContextFeatureCache
 * @property {Array<import("@vcmap-cesium/engine").Primitive|import("@vcmap-cesium/engine").GroundPrimitive|import("@vcmap-cesium/engine").GroundPolylinePrimitive|import("@vcmap-cesium/engine").ClassificationPrimitive|import("@vcmap-cesium/engine").Model>|undefined} primitives
 * @property {Array<import("@vcmap-cesium/engine").Primitive|import("@vcmap-cesium/engine").GroundPrimitive|import("@vcmap-cesium/engine").GroundPolylinePrimitive|import("@vcmap-cesium/engine").ClassificationPrimitive|import("@vcmap-cesium/engine").Model>|undefined} scaledPrimitives
 * @property {Array<import("@vcmap-cesium/engine").Billboard|import("@vcmap-cesium/engine").Entity>|undefined} billboards
 * @property {Array<import("@vcmap-cesium/engine").Label|import("@vcmap-cesium/engine").Entity>|undefined} labels
 */

/**
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {import("@vcmap-cesium/engine").Primitive|import("@vcmap-cesium/engine").GroundPrimitive|import("@vcmap-cesium/engine").GroundPolylinePrimitive|import("@vcmap-cesium/engine").ClassificationPrimitive|import("@vcmap-cesium/engine").Label|import("@vcmap-cesium/engine").Billboard|import("@vcmap-cesium/engine").Entity|import("@vcmap-cesium/engine").Model} primitive
 */
export function setReferenceForPicking(feature, primitive) {
  primitive.olFeature = feature;
}

/**
 * @param {import("@vcmap-cesium/engine").PrimitiveCollection|import("@vcmap-cesium/engine").BillboardCollection|import("@vcmap-cesium/engine").LabelCollection|import("@vcmap-cesium/engine").EntityCollection=} collection
 * @param {Array<import("@vcmap-cesium/engine").Primitive|import("@vcmap-cesium/engine").GroundPrimitive|import("@vcmap-cesium/engine").GroundPolylinePrimitive|import("@vcmap-cesium/engine").ClassificationPrimitive|import("@vcmap-cesium/engine").Billboard|import("@vcmap-cesium/engine").Label|import("@vcmap-cesium/engine").Entity|import("@vcmap-cesium/engine").Model>=} array
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
 * @param {Map<import("ol").Feature<import("ol/geom/Geometry").default>, Array<import("@vcmap-cesium/engine").Primitive|import("@vcmap-cesium/engine").GroundPrimitive|import("@vcmap-cesium/engine").GroundPolylinePrimitive|import("@vcmap-cesium/engine").ClassificationPrimitive|import("@vcmap-cesium/engine").Billboard|import("@vcmap-cesium/engine").Label|import("@vcmap-cesium/engine").Entity|import("@vcmap-cesium/engine").Model>>} featuresMap
 * @param {import("@vcmap-cesium/engine").PrimitiveCollection|import("@vcmap-cesium/engine").BillboardCollection|import("@vcmap-cesium/engine").LabelCollection|import("@vcmap-cesium/engine").EntityCollection} primitiveCollection
 * @returns {boolean} - if a feature was removed from the map
 */
export function removeFeatureFromMap(feature, featuresMap, primitiveCollection) {
  removeArrayFromCollection(primitiveCollection, featuresMap.get(feature));
  return featuresMap.delete(feature);
}

/**
 * @param {Array<import("@vcmap-cesium/engine").Primitive|import("@vcmap-cesium/engine").GroundPrimitive|import("@vcmap-cesium/engine").GroundPolylinePrimitive|import("@vcmap-cesium/engine").ClassificationPrimitive|import("@vcmap-cesium/engine").Entity.ConstructorOptions|import("@vcmap-cesium/engine").Model|Object>} primitives
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {boolean} allowPicking
 * @param {import("@vcmap-cesium/engine").BillboardCollection|import("@vcmap-cesium/engine").LabelCollection|import("@vcmap-cesium/engine").PrimitiveCollection|import("@vcmap-cesium/engine").EntityCollection} primitiveCollection
 * @param {Map<import("ol").Feature<import("ol/geom/Geometry").default>, Array<import("@vcmap-cesium/engine").Billboard|import("@vcmap-cesium/engine").Label|import("@vcmap-cesium/engine").Primitive|import("@vcmap-cesium/engine").GroundPrimitive|import("@vcmap-cesium/engine").GroundPolylinePrimitive|import("@vcmap-cesium/engine").ClassificationPrimitive|import("@vcmap-cesium/engine").Entity|import("@vcmap-cesium/engine").Model>>} featureMap
 * @param {import("@vcmap-cesium/engine").SplitDirection} [splitDirection]
 */
export function addPrimitiveToContext(
  primitives,
  feature,
  allowPicking,
  primitiveCollection,
  featureMap,
  splitDirection = undefined,
) {
  if (primitives.length) {
    const cesiumPrimitives = primitives.map((primitiveOptions) => {
      const primitive = primitiveCollection.add(primitiveOptions);
      if (allowPicking) {
        setReferenceForPicking(feature, primitive);
      }
      if (splitDirection && primitive instanceof Model) {
        // Cesium currently only supports splitDirection on Model primitives
        primitive.splitDirection = splitDirection;
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
 * Sets splitDirection on primitives. Currently only Model primitives support splitting.
 * @param {import("@vcmap-cesium/engine").SplitDirection} splitDirection
 * @param {import("@vcmap-cesium/engine").PrimitiveCollection} primitives
 */
export function setSplitDirectionOnPrimitives(splitDirection, primitives) {
  for (let i = 0; i < primitives.length; i++) {
    const p = primitives.get(i);
    if (p instanceof Model) {
      p.splitDirection = splitDirection;
    }
  }
}

/**
 * Symbol used in self scaling
 * @type {symbol}
 */
const scaleSymbol = Symbol('Scale');
/**
 * self scaling scratch
 * @type {import("@vcmap-cesium/engine").Cartesian3}
 */
const scratchCenter = new Cartesian3();

/**
 * Creates a self scaling primitive collection. It will scale a primitive of model in the collection
 * in such a fashion, that the cartesian unit of 1 equals 1 pixel.
 * @param {import("@vcmap/core").CesiumMap} map
 * @param {import("@vcmap-cesium/engine").PrimitiveCollection} primitiveCollection
 * @param {{value: boolean}}dirtyRef
 * @returns {function():void}
 */
export function setupScalingPrimitiveCollection(map, primitiveCollection, dirtyRef) {
  let cachedVP = new Viewpoint({});
  return map.getScene().postRender.addEventListener(() => {
    const { length } = primitiveCollection;
    if (length === 0) {
      return;
    }

    const vp = map.getViewpointSync();
    if (!dirtyRef.value && cachedVP.equals(vp, CesiumMath.EPSILON5)) {
      return;
    }

    for (let i = 0; i < length; i++) {
      const primitive = primitiveCollection.get(i);
      if (!primitive.isDestroyed()) {
        const { modelMatrix } = primitive;
        const center = Matrix4.getTranslation(modelMatrix, scratchCenter);
        const res = map.getCurrentResolutionFromCartesian(center);
        if (primitive[scaleSymbol] !== res) {
          primitive.modelMatrix = Matrix4.setScale(modelMatrix, new Cartesian3(res, res, res), new Matrix4());
          primitive[scaleSymbol] = res;
        }
      }
    }
    dirtyRef.value = false;
    cachedVP = vp;
  });
}

/**
 * @class
 */
class VectorContext {
  /**
   * @param {import("@vcmap/core").CesiumMap} map
   * @param {import("@vcmap-cesium/engine").PrimitiveCollection} rootCollection
   * @param {import("@vcmap-cesium/engine").SplitDirection} splitDirection
   */
  constructor(map, rootCollection, splitDirection) {
    const scene = map.getScene();
    /** @type {import("@vcmap-cesium/engine").PrimitiveCollection} */
    this.primitives = new PrimitiveCollection();
    /** @type {import("@vcmap-cesium/engine").PrimitiveCollection} */
    this.scaledPrimitives = new PrimitiveCollection();
    /** @type {import("@vcmap-cesium/engine").BillboardCollection} */
    this.billboards = new BillboardCollection({ scene });
    /** @type {import("@vcmap-cesium/engine").LabelCollection} */
    this.labels = new LabelCollection({ scene });
    /** @type {Map<import("ol").Feature<import("ol/geom/Geometry").default>, Array<import("@vcmap-cesium/engine").Primitive|import("@vcmap-cesium/engine").GroundPrimitive|import("@vcmap-cesium/engine").GroundPolylinePrimitive|import("@vcmap-cesium/engine").ClassificationPrimitive|import("@vcmap-cesium/engine").Model>>} */
    this.featureToPrimitiveMap = new Map();
    /** @type {Map<import("ol").Feature<import("ol/geom/Geometry").default>, Array<import("@vcmap-cesium/engine").Primitive|import("@vcmap-cesium/engine").GroundPrimitive|import("@vcmap-cesium/engine").GroundPolylinePrimitive|import("@vcmap-cesium/engine").ClassificationPrimitive|import("@vcmap-cesium/engine").Model>>} */
    this.featureToScaledPrimitiveMap = new Map();
    /** @type {Map<import("ol").Feature<import("ol/geom/Geometry").default>, Array<import("@vcmap-cesium/engine").Billboard>>} */
    this.featureToBillboardMap = new Map();
    /** @type {Map<import("ol").Feature<import("ol/geom/Geometry").default>, Array<import("@vcmap-cesium/engine").Label>>} */
    this.featureToLabelMap = new Map();
    /** @type {import("@vcmap-cesium/engine").SplitDirection} */
    this.splitDirection = splitDirection;

    /**
     * @type {import("@vcmap-cesium/engine").PrimitiveCollection}
     * @private
     */
    this._rootCollection = rootCollection;
    this._rootCollection.add(this.primitives);
    this._rootCollection.add(this.scaledPrimitives);
    this._rootCollection.add(this.billboards);
    this._rootCollection.add(this.labels);

    this._scaledDirty = { value: true };
    this._postRenderListener = setupScalingPrimitiveCollection(map, this.scaledPrimitives, this._scaledDirty);
  }

  /**
   * @param {Array<import("@vcmap-cesium/engine").Primitive|import("@vcmap-cesium/engine").GroundPrimitive|import("@vcmap-cesium/engine").GroundPolylinePrimitive|import("@vcmap-cesium/engine").ClassificationPrimitive|import("@vcmap-cesium/engine").Model>} primitives
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @param {boolean=} allowPicking
   */
  addPrimitives(primitives, feature, allowPicking) {
    addPrimitiveToContext(
      primitives,
      feature,
      allowPicking,
      this.primitives,
      this.featureToPrimitiveMap,
      this.splitDirection,
    );
  }

  /**
   * @param {Array<import("@vcmap-cesium/engine").Primitive|import("@vcmap-cesium/engine").GroundPrimitive|import("@vcmap-cesium/engine").GroundPolylinePrimitive|import("@vcmap-cesium/engine").ClassificationPrimitive|import("@vcmap-cesium/engine").Model>} primitives
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @param {boolean=} allowPicking
   */
  addScaledPrimitives(primitives, feature, allowPicking) {
    addPrimitiveToContext(
      primitives,
      feature,
      allowPicking,
      this.scaledPrimitives,
      this.featureToScaledPrimitiveMap,
      this.splitDirection,
    );
    this._scaledDirty.value = true;
  }

  /**
   * @param {Array<Object>} billboardOptions
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @param {boolean=} allowPicking
   */
  addBillboards(billboardOptions, feature, allowPicking) {
    addPrimitiveToContext(
      billboardOptions,
      feature,
      allowPicking,
      this.billboards,
      this.featureToBillboardMap,
      this.splitDirection,
    );
  }

  /**
   * @param {Array<Object>} labelOptions
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @param {boolean=} allowPicking
   */
  addLabels(labelOptions, feature, allowPicking) {
    addPrimitiveToContext(
      labelOptions,
      feature,
      allowPicking,
      this.labels,
      this.featureToLabelMap,
      this.splitDirection,
    );
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   */
  removeFeature(feature) {
    removeFeatureFromMap(feature, this.featureToPrimitiveMap, this.primitives);
    this._scaledDirty.value = removeFeatureFromMap(feature, this.featureToScaledPrimitiveMap, this.scaledPrimitives);
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
    cache.scaledPrimitives = this.featureToScaledPrimitiveMap.get(feature);
    this.featureToScaledPrimitiveMap.delete(feature);
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
    removeArrayFromCollection(this.scaledPrimitives, cache.scaledPrimitives);
    removeArrayFromCollection(this.billboards, cache.billboards);
    removeArrayFromCollection(this.labels, cache.labels);
  }

  /**
   * Updates splitDirection on primitives. Currently only Model primitives support splitting.
   * @param {import("@vcmap-cesium/engine").SplitDirection} splitDirection
   */
  updateSplitDirection(splitDirection) {
    this.splitDirection = splitDirection;
    setSplitDirectionOnPrimitives(splitDirection, this.primitives);
    setSplitDirectionOnPrimitives(splitDirection, this.scaledPrimitives);
  }

  /**
   * Clears all collections and maps
   * @api
   */
  clear() {
    this.primitives.removeAll();
    this.scaledPrimitives.removeAll();
    this.billboards.removeAll();
    this.labels.removeAll();
    this.featureToBillboardMap.clear();
    this.featureToLabelMap.clear();
    this.featureToPrimitiveMap.clear();
    this._scaledDirty.value = this.featureToScaledPrimitiveMap.size > 0;
    this.featureToScaledPrimitiveMap.clear();
  }

  /**
   * Destroys this context and all its resources
   */
  destroy() {
    if (this._rootCollection) {
      this._rootCollection.remove(this.primitives);
      this._rootCollection.remove(this.scaledPrimitives);
      this._rootCollection.remove(this.billboards);
      this._rootCollection.remove(this.labels);
    }
    this._rootCollection = null;
    this.featureToBillboardMap.clear();
    this.featureToLabelMap.clear();
    this.featureToPrimitiveMap.clear();
    this.featureToScaledPrimitiveMap.clear();
    this._postRenderListener();
  }
}

export default VectorContext;
