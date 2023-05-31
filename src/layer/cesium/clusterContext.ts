import type {
  CustomDataSource,
  EntityCollection,
  Entity,
  Cartesian3,
  SplitDirection,
} from '@vcmap-cesium/engine';
import type { Feature } from 'ol/index.js';
import {
  ClassificationPrimitive,
  GroundPolylinePrimitive,
  GroundPrimitive,
  Model,
  Primitive,
} from '@vcmap-cesium/engine';
import {
  removeFeatureFromMap,
  addPrimitiveToContext,
  removeArrayFromCollection,
  VectorContextFeatureCache,
  CesiumVectorContext,
} from './vectorContext.js';

class ClusterContext implements CesiumVectorContext {
  entities: EntityCollection;

  featureToBillboardMap: Map<Feature, Array<Entity>> = new Map();

  featureToLabelMap: Map<Feature, Array<Entity>> = new Map();

  constructor(dataSource: CustomDataSource) {
    this.entities = dataSource.entities;
  }

  // eslint-disable-next-line class-methods-use-this
  addPrimitives(
    _primitives: (
      | Primitive
      | GroundPrimitive
      | GroundPolylinePrimitive
      | ClassificationPrimitive
      | Model
    )[],
    _feature: Feature,
    _allowPicking: boolean,
  ): void {}

  // eslint-disable-next-line class-methods-use-this
  addScaledPrimitives(
    _primitives: (
      | Primitive
      | GroundPrimitive
      | GroundPolylinePrimitive
      | ClassificationPrimitive
      | Model
    )[],
    _feature: Feature,
    _allowPicking: boolean,
  ): void {}

  addBillboards(
    billboardOptions: object[],
    feature: Feature,
    allowPicking = false,
  ): void {
    addPrimitiveToContext(
      billboardOptions.map((billboard) => ({
        billboard,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        position: billboard.position as Cartesian3,
      })),
      feature,
      allowPicking,
      this.entities,
      this.featureToBillboardMap,
    );
  }

  addLabels(
    labelOptions: object[],
    feature: Feature,
    allowPicking = false,
  ): void {
    addPrimitiveToContext(
      labelOptions.map((label) => ({
        label,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        position: label.position,
      })),
      feature,
      allowPicking,
      this.entities,
      this.featureToLabelMap,
    );
  }

  removeFeature(feature: Feature): void {
    removeFeatureFromMap(feature, this.featureToBillboardMap, this.entities);
    removeFeatureFromMap(feature, this.featureToLabelMap, this.entities);
  }

  /**
   * Caches the current cesium resources for a feature, removing them from the feature map
   */
  createFeatureCache(feature: Feature): VectorContextFeatureCache {
    const cache: VectorContextFeatureCache = {};
    cache.billboards = this.featureToBillboardMap.get(feature);
    this.featureToBillboardMap.delete(feature);
    cache.labels = this.featureToLabelMap.get(feature);
    this.featureToLabelMap.delete(feature);
    return cache;
  }

  clearFeatureCache(cache: VectorContextFeatureCache): void {
    removeArrayFromCollection(this.entities, cache.billboards);
    removeArrayFromCollection(this.entities, cache.labels);
  }

  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  updateSplitDirection(_splitDirection: SplitDirection): void {}

  clear(): void {
    this.entities.removeAll();
    this.featureToBillboardMap.clear();
    this.featureToLabelMap.clear();
  }

  destroy(): void {
    this.clear();
  }
}

export default ClusterContext;
