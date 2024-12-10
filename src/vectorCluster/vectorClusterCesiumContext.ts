import {
  CustomDataSource,
  EntityCollection,
  Entity,
  Scene,
} from '@vcmap-cesium/engine';
import { StyleLike } from 'ol/style/Style.js';
import type { Feature } from 'ol/index.js';
import {
  CesiumVectorContext,
  setReferenceForPicking,
} from '../layer/cesium/vectorContext.js';
import VectorProperties from '../layer/vectorProperties.js';
import convert, { ConvertedItem } from '../util/featureconverter/convert.js';

class VectorClusterCesiumContext implements CesiumVectorContext {
  entities: EntityCollection;

  private _featureItems = new Map<Feature, () => void>();

  private _convertingFeatures: Map<Feature, () => void> = new Map();

  constructor(dataSource: CustomDataSource) {
    this.entities = dataSource.entities;
  }

  private _addConvertedItems(
    feature: Feature,
    allowPicking: boolean,
    items: ConvertedItem[],
  ): void {
    let entityOptions: Entity.ConstructorOptions | undefined;
    items.forEach((item) => {
      if (item.type === 'billboard') {
        entityOptions = entityOptions ?? {};
        entityOptions.billboard = {
          ...item.item,
        };
        entityOptions.position = entityOptions.position ?? item.item.position;
      } else if (item.type === 'label') {
        entityOptions = entityOptions ?? {};
        entityOptions.label = item.item;
        entityOptions.position = entityOptions.position ?? item.item.position;
      }
    });

    if (entityOptions) {
      const instance = this.entities.add(entityOptions);
      if (instance) {
        if (allowPicking) {
          setReferenceForPicking(feature, instance);
        }
        this._featureItems.set(feature, (): void => {
          this.entities.remove(instance);
        });
      }
    }
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

    this._featureItems.get(feature)?.();

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

  hasFeature(feature: Feature): boolean {
    return (
      this._featureItems.has(feature) || this._convertingFeatures.has(feature)
    );
  }

  removeFeature(feature: Feature): void {
    this._convertingFeatures.get(feature)?.();
    this._convertingFeatures.delete(feature);
    this._featureItems.get(feature)?.();
    this._featureItems.delete(feature);
  }

  clear(): void {
    this.entities.removeAll();
    this._featureItems.clear();
    this._convertingFeatures.forEach((destroy) => {
      destroy();
    });
    this._convertingFeatures.clear();
  }

  destroy(): void {
    this.clear();
  }
}

export default VectorClusterCesiumContext;
