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
  Scene,
} from '@vcmap-cesium/engine';
import { Style } from 'ol/style.js';
import { StyleFunction } from 'ol/style/Style.js';
import type { Feature } from 'ol/index.js';
import Viewpoint from '../../util/viewpoint.js';
import type CesiumMap from '../../map/cesiumMap.js';
import VectorProperties from '../vectorProperties.js';
import convert from '../../util/featureconverter/convert.js';

type PrimitiveType =
  | Primitive
  | GroundPrimitive
  | GroundPolylinePrimitive
  | ClassificationPrimitive
  | Model;

export type VectorContextFeatureCache = {
  primitives?: PrimitiveType[];
  scaledPrimitives?: PrimitiveType[];
  billboards?: (Billboard | Entity)[];
  labels?: (Label | Entity)[];
};

export function setReferenceForPicking(
  feature: Feature,
  primitive: PrimitiveType | Label | Billboard | Entity,
): void {
  primitive.olFeature = feature;
}

export function removeArrayFromCollection(
  collection:
    | PrimitiveCollection
    | BillboardCollection
    | LabelCollection
    | EntityCollection,
  array?: (PrimitiveType | Billboard | Label | Entity)[],
): void {
  if (array) {
    array.forEach((primitive) => {
      collection.remove(primitive);
    });
  }
}

export function removeFeatureFromMap(
  feature: Feature,
  featuresMap: Map<Feature, (PrimitiveType | Billboard | Label | Entity)[]>,
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
  primitives: (PrimitiveType | Entity.ConstructorOptions)[],
  feature: Feature,
  allowPicking: boolean,
  primitiveCollection:
    | BillboardCollection
    | LabelCollection
    | PrimitiveCollection
    | EntityCollection,
  featureMap: Map<Feature, (Billboard | Label | PrimitiveType | Entity)[]>,
  splitDirection?: SplitDirection,
): void {
  if (primitives.length) {
    const cesiumPrimitives = primitives.map((primitiveOptions) => {
      const primitive = primitiveCollection.add(primitiveOptions) as
        | Billboard
        | Label
        | PrimitiveType
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

export interface AsyncCesiumVectorContext {
  addPrimitives(
    primitives: PrimitiveType[],
    feature: Feature,
    allowPicking: boolean,
  ): void;
  addScaledPrimitives(
    primitives: PrimitiveType[],
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
}

export interface CesiumVectorContext extends AsyncCesiumVectorContext {
  removeFeature(feature: Feature): void;
  createFeatureCache(feature: Feature): VectorContextFeatureCache;
  clearFeatureCache(cache: VectorContextFeatureCache): void;
  updateSplitDirection(splitDirection: SplitDirection): void;
  clear(): void;
}

function createAsyncFeatureConvert(
  feature: Feature,
  style: Style | StyleFunction,
  vectorProperties: VectorProperties,
  context: CesiumVectorContext,
  scene: Scene,
): () => void {
  let isDestroyed = false;
  const primitivesArray: {
    primitives: PrimitiveType[];
    allowPicking: boolean;
  }[] = [];
  const scaledPrimitives: {
    primitives: PrimitiveType[];
    allowPicking: boolean;
  }[] = [];
  const billboards: { billboardOptions: object[]; allowPicking: boolean }[] =
    [];
  const labels: { labelOptions: object[]; allowPicking: boolean }[] = [];

  const asyncContext: AsyncCesiumVectorContext = {
    addPrimitives(
      primitives: PrimitiveType[],
      _feature: Feature,
      allowPicking: boolean,
    ): void {
      primitivesArray.push({ primitives, allowPicking });
    },
    addScaledPrimitives(
      primitives: PrimitiveType[],
      _feature: Feature,
      allowPicking: boolean,
    ): void {
      scaledPrimitives.push({ primitives, allowPicking });
    },
    addBillboards(
      billboardOptions: object[],
      _feature: Feature,
      allowPicking: boolean,
    ): void {
      billboards.push({ billboardOptions, allowPicking });
    },
    addLabels(
      labelOptions: object[],
      _feature: Feature,
      allowPicking: boolean,
    ): void {
      labels.push({ labelOptions, allowPicking });
    },
  };

  convert(feature, style, vectorProperties, asyncContext, scene)
    .then(() => {
      if (!isDestroyed) {
        primitivesArray.forEach(({ primitives, allowPicking }) => {
          context.addPrimitives(primitives, feature, allowPicking);
        });
        scaledPrimitives.forEach(({ primitives, allowPicking }) => {
          context.addScaledPrimitives(primitives, feature, allowPicking);
        });
        billboards.forEach(({ billboardOptions, allowPicking }) => {
          context.addBillboards(billboardOptions, feature, allowPicking);
        });
        labels.forEach(({ labelOptions, allowPicking }) => {
          context.addLabels(labelOptions, feature, allowPicking);
        });
      } else {
        primitivesArray.forEach(({ primitives }) => {
          primitives.forEach((p) => {
            p.destroy();
          });
        });
        scaledPrimitives.forEach(({ primitives }) => {
          primitives.forEach((p) => {
            p.destroy();
          });
        });
      }
    })
    .catch((err) => {
      console.error('feature conversion failed');
      console.error(err);
    })
    .finally(() => {
      primitivesArray.splice(0);
      scaledPrimitives.splice(0);
      billboards.splice(0);
      labels.splice(0);
    });

  return () => {
    isDestroyed = true;
  };
}

class VectorContext implements CesiumVectorContext {
  primitives = new PrimitiveCollection();

  scaledPrimitives = new PrimitiveCollection();

  billboards: BillboardCollection;

  labels: LabelCollection;

  featureToPrimitiveMap: Map<Feature, PrimitiveType[]> = new Map();

  featureToScaledPrimitiveMap: Map<Feature, PrimitiveType[]> = new Map();

  featureToBillboardMap: Map<Feature, Array<Billboard>> = new Map();

  featureToLabelMap: Map<Feature, Array<Label>> = new Map();

  _features: Map<Feature, () => void> = new Map();

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
    primitives: PrimitiveType[],
    feature: Feature,
    allowPicking = false,
  ): void {
    addPrimitiveToContext(
      primitives,
      feature,
      allowPicking,
      this.primitives,
      this.featureToPrimitiveMap,
      this.splitDirection,
    );
  }

  addScaledPrimitives(
    primitives: PrimitiveType[],
    feature: Feature,
    allowPicking = false,
  ): void {
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

  addBillboards(
    billboardOptions: object[],
    feature: Feature,
    allowPicking = false,
  ): void {
    addPrimitiveToContext(
      billboardOptions,
      feature,
      allowPicking,
      this.billboards,
      this.featureToBillboardMap,
      this.splitDirection,
    );
  }

  addLabels(
    labelOptions: object[],
    feature: Feature,
    allowPicking = false,
  ): void {
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
   * @param  feature
   */
  removeFeature(feature: Feature): void {
    this._features.get(feature)?.();
    this._features.delete(feature);
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
    this._features.forEach((destroy) => {
      destroy();
    });
    this._features.clear();
  }

  convertFeature(
    feature: Feature,
    style: Style | StyleFunction,
    vectorProperties: VectorProperties,
    scene: Scene,
  ): void {
    this._features.get(feature)?.();
    this._features.set(
      feature,
      createAsyncFeatureConvert(feature, style, vectorProperties, this, scene),
    );
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
    this._features.forEach((destroy) => {
      destroy();
    });
    this._features.clear();
    this.featureToScaledPrimitiveMap.clear();
    this._postRenderListener();
  }
}

export default VectorContext;
