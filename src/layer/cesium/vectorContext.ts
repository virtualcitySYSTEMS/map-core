import {
  Billboard,
  BillboardCollection,
  Cartesian3,
  type Entity,
  type Label,
  LabelCollection,
  Math as CesiumMath,
  Matrix4,
  Model,
  Primitive,
  PrimitiveCollection,
  Scene,
  SplitDirection,
} from '@vcmap-cesium/engine';
import { StyleLike } from 'ol/style/Style.js';
import type { Feature } from 'ol/index.js';

import Viewpoint from '../../util/viewpoint.js';
import type CesiumMap from '../../map/cesiumMap.js';
import VectorProperties from '../vectorProperties.js';
import convert, {
  ConvertedItem,
  PrimitiveType,
} from '../../util/featureconverter/convert.js';

export function setReferenceForPicking(
  feature: Feature,
  primitive: PrimitiveType | Label | Billboard | Entity,
): void {
  primitive.olFeature = feature;
}

/**
 * Sets splitDirection on primitives. Currently only Model primitives support splitting.
 */
export function setSplitDirectionOnPrimitives<
  T extends PrimitiveCollection | BillboardCollection,
>(splitDirection: SplitDirection, primitives: T): void {
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

export interface CesiumVectorContext {
  addFeature(
    feature: Feature,
    style: StyleLike,
    vectorProperties: VectorProperties,
    scene: Scene,
  ): Promise<void>;
  removeFeature(feature: Feature): void;
  updateSplitDirection(splitDirection: SplitDirection): void;
  clear(): void;
}

export default class VectorContext implements CesiumVectorContext {
  primitives = new PrimitiveCollection();

  scaledPrimitives = new PrimitiveCollection();

  billboards: BillboardCollection;

  labels: LabelCollection;

  private _featureItems = new Map<Feature, (() => void)[]>();

  private _convertingFeatures: Map<Feature, () => void> = new Map();

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
  ): void {
    const removeItems = items
      .map((item) => {
        let instance: PrimitiveType | Label | Billboard | undefined;
        let removeItem: (() => void) | undefined;
        if (item.type === 'primitive') {
          if (item.autoScale) {
            instance = this.scaledPrimitives.add(item.item) as PrimitiveType;
            if (instance) {
              removeItem = (): void => {
                this._scaledDirty.value =
                  this.scaledPrimitives.remove(instance);
              };
              this._scaledDirty.value = true;
            }
          } else {
            instance = this.primitives.add(item.item) as PrimitiveType;
            if (instance) {
              removeItem = (): void => {
                this.primitives.remove(instance);
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
          if (allowPicking) {
            setReferenceForPicking(feature, instance);
          }

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
      .filter((i): i is () => void => i != null);

    this._featureItems.set(feature, removeItems);
  }

  async addFeature(
    feature: Feature,
    style: StyleLike,
    vectorProperties: VectorProperties,
    scene: Scene,
  ): Promise<void> {
    this._convertingFeatures.get(feature)?.();
    let deleted = false;
    this._convertingFeatures.set(feature, () => {
      deleted = true;
    });

    const convertedItems = await convert(
      feature,
      style,
      vectorProperties,
      scene,
    );

    this._featureItems.get(feature)?.forEach((removeItem) => removeItem());
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
      );
    }
  }

  removeFeature(feature: Feature): void {
    this._convertingFeatures.get(feature)?.();
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
      destroy();
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
      destroy();
    });
    this._convertingFeatures.clear();
    this._featureItems.clear();
    this._postRenderListener();
  }
}
