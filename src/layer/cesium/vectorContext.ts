import {
  PrimitiveCollection,
  BillboardCollection,
  LabelCollection,
  Matrix4,
  Cartesian3,
  Math as CesiumMath,
  Model,
  type Primitive,
  type GroundPrimitive,
  type GroundPolylinePrimitive,
  type ClassificationPrimitive,
  type Billboard,
  type Entity,
  type Label,
  type EntityCollection,
  SplitDirection,
} from '@vcmap-cesium/engine';
import type { Feature } from 'ol/index.js';
import Viewpoint from '../../util/viewpoint.js';
import type CesiumMap from '../../map/cesiumMap.js';

export type VectorContextFeatureCache = {
  primitives?: (
    | Primitive
    | GroundPrimitive
    | GroundPolylinePrimitive
    | ClassificationPrimitive
    | Model
  )[];
  scaledPrimitives?: (
    | Primitive
    | GroundPrimitive
    | GroundPolylinePrimitive
    | ClassificationPrimitive
    | Model
  )[];
  billboards?: (Billboard | Entity)[];
  labels?: (Label | Entity)[];
};

export function setReferenceForPicking(
  feature: Feature,
  primitive:
    | Primitive
    | GroundPrimitive
    | GroundPolylinePrimitive
    | ClassificationPrimitive
    | Label
    | Billboard
    | Entity
    | Model,
): void {
  primitive.olFeature = feature;
}

export function removeArrayFromCollection(
  collection:
    | PrimitiveCollection
    | BillboardCollection
    | LabelCollection
    | EntityCollection,
  array?: (
    | Primitive
    | GroundPrimitive
    | GroundPolylinePrimitive
    | ClassificationPrimitive
    | Billboard
    | Label
    | Entity
    | Model
  )[],
): void {
  if (array) {
    array.forEach((primitive) => {
      collection.remove(primitive);
    });
  }
}

export function removeFeatureFromMap(
  feature: Feature,
  featuresMap: Map<
    Feature,
    (
      | Primitive
      | GroundPrimitive
      | GroundPolylinePrimitive
      | ClassificationPrimitive
      | Billboard
      | Label
      | Entity
      | Model
    )[]
  >,
  primitiveCollection:
    | PrimitiveCollection
    | BillboardCollection
    | LabelCollection
    | EntityCollection,
): boolean {
  removeArrayFromCollection(primitiveCollection, featuresMap.get(feature));
  return featuresMap.delete(feature);
}

export function addPrimitiveToContext(
  primitives: (
    | Primitive
    | GroundPrimitive
    | GroundPolylinePrimitive
    | ClassificationPrimitive
    | Entity.ConstructorOptions
    | Model
  )[],
  feature: Feature,
  allowPicking: boolean,
  primitiveCollection:
    | BillboardCollection
    | LabelCollection
    | PrimitiveCollection
    | EntityCollection,
  featureMap: Map<
    Feature,
    (
      | Billboard
      | Label
      | Primitive
      | GroundPrimitive
      | GroundPolylinePrimitive
      | ClassificationPrimitive
      | Entity
      | Model
    )[]
  >,
  splitDirection?: SplitDirection,
): void {
  if (primitives.length) {
    const cesiumPrimitives = primitives.map((primitiveOptions) => {
      const primitive = primitiveCollection.add(primitiveOptions) as
        | Billboard
        | Label
        | Primitive
        | GroundPrimitive
        | GroundPolylinePrimitive
        | ClassificationPrimitive
        | Entity
        | Model;
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
      featureMap.get(feature)!.push(...cesiumPrimitives);
    }
  }
}

/**
 * Sets splitDirection on primitives. Currently only Model primitives support splitting.
 */
export function setSplitDirectionOnPrimitives(
  splitDirection: SplitDirection,
  primitives: PrimitiveCollection,
): void {
  for (let i = 0; i < primitives.length; i++) {
    const p = primitives.get(i) as Primitive | Model;
    if (p instanceof Model) {
      p.splitDirection = splitDirection;
    }
  }
}

export const scaleSymbol: unique symbol = Symbol('Scale');

/**
 * self scaling scratch
 */
const scratchCenter = new Cartesian3();

/**
 * Creates a self scaling primitive collection. It will scale a primitive of model in the collection
 * in such a fashion, that the cartesian unit of 1 equals 1 pixel.
 */
export function setupScalingPrimitiveCollection(
  map: CesiumMap,
  primitiveCollection: PrimitiveCollection,
  dirtyRef: { value: boolean },
): () => void {
  let cachedVP = new Viewpoint({});
  return map.getScene()!.postRender.addEventListener(() => {
    const { length } = primitiveCollection;
    if (length === 0) {
      return;
    }

    const vp = map.getViewpointSync() as Viewpoint;
    if (!dirtyRef.value && cachedVP.equals(vp, CesiumMath.EPSILON5)) {
      return;
    }

    for (let i = 0; i < length; i++) {
      const primitive = primitiveCollection.get(i) as Model;
      if (!primitive.isDestroyed()) {
        const { modelMatrix } = primitive;
        const center = Matrix4.getTranslation(modelMatrix, scratchCenter);
        const res = map.getCurrentResolutionFromCartesian(center);
        if (primitive[scaleSymbol] !== res) {
          primitive.modelMatrix = Matrix4.setScale(
            modelMatrix,
            new Cartesian3(res, res, res),
            new Matrix4(),
          );
          primitive[scaleSymbol] = res;
        }
      }
    }
    dirtyRef.value = false;
    cachedVP = vp;
  });
}

export interface CesiumVectorContext {
  addPrimitives(
    primitives: (
      | Primitive
      | GroundPrimitive
      | GroundPolylinePrimitive
      | ClassificationPrimitive
      | Model
    )[],
    feature: Feature,
    allowPicking: boolean,
  ): void;
  addScaledPrimitives(
    primitives: (
      | Primitive
      | GroundPrimitive
      | GroundPolylinePrimitive
      | ClassificationPrimitive
      | Model
    )[],
    feature: Feature,
    allowPicking: boolean,
  ): void;
  addBillboards(
    billboardOptions: object[],
    feature: Feature,
    allowPicking: boolean,
  ): void;
  addLabels(
    labelOptions: object[],
    feature: Feature,
    allowPicking: boolean,
  ): void;
  removeFeature(feature: Feature): void;
  createFeatureCache(feature: Feature): VectorContextFeatureCache;
  clearFeatureCache(cache: VectorContextFeatureCache): void;
  updateSplitDirection(splitDirection: SplitDirection): void;
  clear(): void;
}

class VectorContext implements CesiumVectorContext {
  primitives = new PrimitiveCollection();

  scaledPrimitives = new PrimitiveCollection();

  billboards: BillboardCollection;

  labels: LabelCollection;

  featureToPrimitiveMap: Map<
    Feature,
    Array<
      | Primitive
      | GroundPrimitive
      | GroundPolylinePrimitive
      | ClassificationPrimitive
      | Model
    >
  > = new Map();

  featureToScaledPrimitiveMap: Map<
    Feature,
    Array<
      | Primitive
      | GroundPrimitive
      | GroundPolylinePrimitive
      | ClassificationPrimitive
      | Model
    >
  > = new Map();

  featureToBillboardMap: Map<Feature, Array<Billboard>> = new Map();

  featureToLabelMap: Map<Feature, Array<Label>> = new Map();

  features: Set<Feature> = new Set();

  splitDirection: SplitDirection;

  private _rootCollection: PrimitiveCollection;

  private _scaledDirty: {
    value: boolean;
  };

  private _postRenderListener: () => void;

  constructor(
    map: CesiumMap,
    rootCollection: PrimitiveCollection,
    splitDirection: SplitDirection,
  ) {
    const scene = map.getScene();
    this.billboards = new BillboardCollection({ scene });
    this.labels = new LabelCollection({ scene });
    this.splitDirection = splitDirection;

    this._rootCollection = rootCollection;
    this._rootCollection.add(this.primitives);
    this._rootCollection.add(this.scaledPrimitives);
    this._rootCollection.add(this.billboards);
    this._rootCollection.add(this.labels);

    this._scaledDirty = { value: true };
    this._postRenderListener = setupScalingPrimitiveCollection(
      map,
      this.scaledPrimitives,
      this._scaledDirty,
    );
  }

  addPrimitives(
    primitives: (
      | Primitive
      | GroundPrimitive
      | GroundPolylinePrimitive
      | ClassificationPrimitive
      | Model
    )[],
    feature: Feature,
    allowPicking = false,
  ): void {
    if (this.features.has(feature)) {
      addPrimitiveToContext(
        primitives,
        feature,
        allowPicking,
        this.primitives,
        this.featureToPrimitiveMap,
        this.splitDirection,
      );
    }
  }

  addScaledPrimitives(
    primitives: (
      | Primitive
      | GroundPrimitive
      | GroundPolylinePrimitive
      | ClassificationPrimitive
      | Model
    )[],
    feature: Feature,
    allowPicking = false,
  ): void {
    if (this.features.has(feature)) {
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
  }

  addBillboards(
    billboardOptions: object[],
    feature: Feature,
    allowPicking = false,
  ): void {
    if (this.features.has(feature)) {
      addPrimitiveToContext(
        billboardOptions,
        feature,
        allowPicking,
        this.billboards,
        this.featureToBillboardMap,
        this.splitDirection,
      );
    }
  }

  addLabels(
    labelOptions: object[],
    feature: Feature,
    allowPicking = false,
  ): void {
    if (this.features.has(feature)) {
      addPrimitiveToContext(
        labelOptions,
        feature,
        allowPicking,
        this.labels,
        this.featureToLabelMap,
        this.splitDirection,
      );
    }
  }

  /**
   * @param  feature
   */
  removeFeature(feature: Feature): void {
    this.features.delete(feature);
    removeFeatureFromMap(feature, this.featureToPrimitiveMap, this.primitives);
    this._scaledDirty.value = removeFeatureFromMap(
      feature,
      this.featureToScaledPrimitiveMap,
      this.scaledPrimitives,
    );
    removeFeatureFromMap(feature, this.featureToBillboardMap, this.billboards);
    removeFeatureFromMap(feature, this.featureToLabelMap, this.labels);
  }

  /**
   * Caches the current cesium resources for a feature, removing them from the feature map
   * @param feature
   */
  createFeatureCache(feature: Feature): VectorContextFeatureCache {
    const cache: VectorContextFeatureCache = {};
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
   * @param  cache
   */
  clearFeatureCache(cache: VectorContextFeatureCache): void {
    removeArrayFromCollection(this.primitives, cache.primitives);
    removeArrayFromCollection(this.scaledPrimitives, cache.scaledPrimitives);
    removeArrayFromCollection(this.billboards, cache.billboards);
    removeArrayFromCollection(this.labels, cache.labels);
  }

  /**
   * Updates splitDirection on primitives. Currently only Model primitives support splitting.
   * @param  splitDirection
   */
  updateSplitDirection(splitDirection: SplitDirection): void {
    this.splitDirection = splitDirection;
    setSplitDirectionOnPrimitives(splitDirection, this.primitives);
    setSplitDirectionOnPrimitives(splitDirection, this.scaledPrimitives);
  }

  /**
   * Clears all collections and maps
   */
  clear(): void {
    this.primitives.removeAll();
    this.scaledPrimitives.removeAll();
    this.billboards.removeAll();
    this.labels.removeAll();
    this.featureToBillboardMap.clear();
    this.featureToLabelMap.clear();
    this.featureToPrimitiveMap.clear();
    this._scaledDirty.value = this.featureToScaledPrimitiveMap.size > 0;
    this.featureToScaledPrimitiveMap.clear();
    this.features.clear();
  }

  /**
   * Destroys this context and all its resources
   */
  destroy(): void {
    if (this._rootCollection) {
      this._rootCollection.remove(this.primitives);
      this._rootCollection.remove(this.scaledPrimitives);
      this._rootCollection.remove(this.billboards);
      this._rootCollection.remove(this.labels);
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this._rootCollection = null;
    this.featureToBillboardMap.clear();
    this.featureToLabelMap.clear();
    this.featureToPrimitiveMap.clear();
    this.features.clear();
    this.featureToScaledPrimitiveMap.clear();
    this._postRenderListener();
  }
}

export default VectorContext;
