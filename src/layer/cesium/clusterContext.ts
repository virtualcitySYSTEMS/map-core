import {
  CustomDataSource,
  EntityCollection,
  Entity,
  SplitDirection,
  Scene,
} from '@vcmap-cesium/engine';
import { StyleLike } from 'ol/style/Style.js';
import type { Feature } from 'ol/index.js';
import {
  CesiumVectorContext,
  setReferenceForPicking,
} from './vectorContext.js';
import VectorProperties from '../vectorProperties.js';
import convert, { ConvertedItem } from '../../util/featureconverter/convert.js';

class ClusterContext implements CesiumVectorContext {
  entities: EntityCollection;

  private _featureItems = new Map<Feature, (() => void)[]>();

  private _convertingFeatures: Map<Feature, () => void> = new Map();

  constructor(dataSource: CustomDataSource) {
    this.entities = dataSource.entities;
  }

  private _addConvertedItems(
    feature: Feature,
    allowPicking: boolean,
    items: ConvertedItem[],
  ): void {
    const removeItems = items
      .map((item) => {
        let instance: Entity | undefined;
        let removeItem: (() => void) | undefined;
        if (item.type === 'billboard') {
          instance = this.entities.add({
            billboard: item.item,
            position: item.item.position,
          });
        } else if (item.type === 'label') {
          instance = this.entities.add({
            label: item.item,
            position: item.item.position,
          });
        }

        if (instance) {
          removeItem = (): void => {
            this.entities.remove(instance as Entity);
          };
        }

        if (instance) {
          if (allowPicking) {
            setReferenceForPicking(feature, instance);
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

  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  updateSplitDirection(_splitDirection: SplitDirection): void {}

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

export default ClusterContext;
