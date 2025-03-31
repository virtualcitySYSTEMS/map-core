import type {
  Primitive,
  Scene,
  SplitDirection,
  Entity,
  Label,
} from '@vcmap-cesium/engine';
import {
  Billboard,
  BillboardCollection,
  Cartesian3,
  LabelCollection,
  Math as CesiumMath,
  Matrix4,
  Model,
  PrimitiveCollection,
} from '@vcmap-cesium/engine';
import type { StyleLike } from 'ol/style/Style.js';
import type { Feature } from 'ol/index.js';

import Viewpoint from '../../util/viewpoint.js';
import type CesiumMap from '../../map/cesiumMap.js';
import type VectorProperties from '../vectorProperties.js';
import type {
  ConvertedItem,
  PrimitiveType,
} from '../../util/featureconverter/convert.js';
import convert from '../../util/featureconverter/convert.js';
import { primitives as primitivesSymbol } from '../vectorSymbols.js';

export function setReferenceForPicking(
  feature: Feature,
  primitive: PrimitiveType | Label | Billboard | Entity,
  allowPicking: boolean,
): void {
  if (allowPicking) {
    primitive.olFeature = feature;
  }
  const featurePrimitives = feature[primitivesSymbol] ?? [];
  if (!featurePrimitives.includes(primitive)) {
    featurePrimitives.push(primitive);
    feature[primitivesSymbol] = featurePrimitives;
  }
}

function getIndexOfPrimitive(
  item: PrimitiveType,
  collection: PrimitiveCollection,
): number {
  const { length } = collection;
  for (let i = 0; i < length; i++) {
    const p = collection.get(i) as PrimitiveType;
    if (p === item) {
      return i;
    }
  }
  return -1;
}

function addPrimitiveAtIndex(
  type: 'scaled' | 'primitive',
  item: PrimitiveType,
  collection: PrimitiveCollection,
  indices: ConvertedIndices,
): PrimitiveType {
  let index = indices[type];
  if (index != null) {
    if (index > collection.length) {
      index = undefined;
    }
  }

  return collection.add(item, index) as PrimitiveType;
}

/**
 * Sets splitDirection on primitives. Currently only Model primitives support splitting.
 */
export function setSplitDirectionOnPrimitives(
  splitDirection: SplitDirection,
  primitives: PrimitiveCollection | BillboardCollection,
): void {
  for (let i = 0; i < primitives.length; i++) {
    const p = primitives.get(i) as Primitive | Model | Billboard;
    if (p instanceof Model || p instanceof Billboard) {
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
            primitive.modelMatrix,
          );
          primitive[scaleSymbol] = res;
        }
      }
    }
    dirtyRef.value = false;
    cachedVP = vp;
  });
}

/**
 * The context for vector rendering in cesium.
 * Creates 1 to N primitives / models / billboards / labels for each feature
 * added to the context depending on its style & vector properties.
 * Uses the feature converters convert function under the hood to create the primitives.
 */
export interface CesiumVectorContext {
  addFeature(
    feature: Feature,
    style: StyleLike,
    vectorProperties: VectorProperties,
    scene: Scene,
  ): Promise<void>;
  hasFeature(feature: Feature): boolean;
  removeFeature(feature: Feature): void;
  clear(): void;
  destroy(): void;
}

type ConvertedItemIndex = { type: 'primitive' | 'scaled'; index: number };

type ConvertedIndices = { primitive?: number; scaled?: number };

/**
 * The generic implementation of the vector context for Cesium
 */
export default class VectorContext implements CesiumVectorContext {
  primitives = new PrimitiveCollection();

  scaledPrimitives = new PrimitiveCollection();

  billboards: BillboardCollection;

  labels: LabelCollection;

  private _featureItems = new Map<
    Feature,
    ((() => ConvertedItemIndex) | (() => void))[]
  >();

  private _convertingFeatures = new Map<Feature, (replace: boolean) => void>();

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
    const scene = map.getScene()!;
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

  private _addConvertedItems(
    feature: Feature,
    allowPicking: boolean,
    items: ConvertedItem[],
    indices: ConvertedIndices,
  ): void {
    const removeItems = items
      .map((item) => {
        let instance: PrimitiveType | Label | Billboard | undefined;
        let removeItem: (() => ConvertedItemIndex) | (() => void) | undefined;
        if (item.type === 'primitive') {
          if (item.autoScale) {
            instance = addPrimitiveAtIndex(
              'scaled',
              item.item,
              this.scaledPrimitives,
              indices,
            );

            if (instance) {
              removeItem = (): ConvertedItemIndex | undefined => {
                const currentIndex = getIndexOfPrimitive(
                  instance as PrimitiveType,
                  this.scaledPrimitives,
                );
                if (currentIndex > -1) {
                  this._scaledDirty.value =
                    this.scaledPrimitives.remove(instance);

                  return {
                    type: 'scaled',
                    index: currentIndex,
                  };
                }
                return undefined;
              };
              this._scaledDirty.value = true;
            }
          } else {
            instance = addPrimitiveAtIndex(
              'primitive',
              item.item,
              this.primitives,
              indices,
            );

            if (instance) {
              removeItem = (): ConvertedItemIndex | undefined => {
                const currentIndex = getIndexOfPrimitive(
                  instance as PrimitiveType,
                  this.primitives,
                );

                if (currentIndex > -1) {
                  this.primitives.remove(instance);
                  return {
                    type: 'primitive',
                    index: currentIndex,
                  };
                }
                return undefined;
              };
            }
          }
        } else if (item.type === 'billboard') {
          instance = this.billboards.add(item.item);
          if (instance) {
            removeItem = (): void => {
              this.billboards.remove(instance as Billboard);
            };
          }
        } else if (item.type === 'label') {
          instance = this.labels.add(item.item);
          if (instance) {
            removeItem = (): void => {
              this.labels.remove(instance as Label);
            };
          }
        }

        if (instance) {
          setReferenceForPicking(feature, instance, allowPicking);

          if (
            this.splitDirection &&
            (instance instanceof Model || instance instanceof Billboard)
          ) {
            // Cesium currently only supports splitDirection on Model & Billboard Primitives
            instance.splitDirection = this.splitDirection;
          }
        }
        return removeItem;
      })
      .filter((i) => i != null);

    removeItems.push(() => {
      feature[primitivesSymbol] = undefined;
    });
    this._featureItems.set(feature, removeItems);
  }

  async addFeature(
    feature: Feature,
    style: StyleLike,
    vectorProperties: VectorProperties,
    scene: Scene,
  ): Promise<void> {
    this._convertingFeatures.get(feature)?.(true);
    let deleted = false;
    let replaced = false;
    this._convertingFeatures.set(feature, (isReplacement?: boolean) => {
      if (isReplacement) {
        replaced = true;
      } else {
        deleted = true;
      }
    });

    const convertedItems = await convert(
      feature,
      style,
      vectorProperties,
      scene,
    );

    if (replaced) {
      convertedItems.forEach((item) => {
        if (item.type === 'primitive') {
          item.item.destroy();
        }
      });
      return;
    }

    const convertedIndices: ConvertedIndices =
      this._featureItems
        .get(feature)
        ?.map((removeItem) => removeItem())
        ?.filter((i) => i != null)
        ?.reduce<ConvertedIndices>((items, current) => {
          const minIndex = items[current.type];
          if (minIndex != null) {
            items[current.type] =
              current.index != null && current.index < minIndex
                ? current.index
                : items[current.type];
          } else {
            items[current.type] = current.index;
          }
          return items;
        }, {}) ?? {};
    this._featureItems.delete(feature);

    if (deleted) {
      convertedItems.forEach((item) => {
        if (item.type === 'primitive') {
          item.item.destroy();
        }
      });
    } else {
      this._addConvertedItems(
        feature,
        vectorProperties.getAllowPicking(feature),
        convertedItems,
        convertedIndices,
      );
    }
  }

  hasFeature(feature: Feature): boolean {
    return (
      this._featureItems.has(feature) || this._convertingFeatures.has(feature)
    );
  }

  removeFeature(feature: Feature): void {
    this._convertingFeatures.get(feature)?.(false);
    this._convertingFeatures.delete(feature);
    this._featureItems.get(feature)?.forEach((removeItem) => removeItem());
    this._featureItems.delete(feature);
  }

  updateSplitDirection(splitDirection: SplitDirection): void {
    this.splitDirection = splitDirection;
    setSplitDirectionOnPrimitives(splitDirection, this.primitives);
    setSplitDirectionOnPrimitives(splitDirection, this.scaledPrimitives);
    setSplitDirectionOnPrimitives(splitDirection, this.billboards);
  }

  clear(): void {
    this.primitives.removeAll();
    this._scaledDirty.value = this.scaledPrimitives.length > 0;
    this.scaledPrimitives.removeAll();
    this.billboards.removeAll();
    this.labels.removeAll();
    this._featureItems.clear();
    this._convertingFeatures.forEach((destroy) => {
      destroy(true);
    });
    this._convertingFeatures.clear();
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
    this._convertingFeatures.forEach((destroy) => {
      destroy(true);
    });
    this._convertingFeatures.clear();
    this._featureItems.clear();
    this._postRenderListener();
  }
}
