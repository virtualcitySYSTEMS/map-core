import type { DataSourceClock, Entity } from '@vcmap-cesium/engine';
import { EntityCollection } from '@vcmap-cesium/engine';
import type { LayerImplementationOptions } from './layer.js';
import Layer from './layer.js';
import CesiumMap from '../map/cesiumMap.js';
import DataSourceCesiumImpl from './cesium/dataSourceCesiumImpl.js';
import { vcsLayerName } from './layerSymbols.js';
import FeatureVisibility, {
  FeatureVisibilityAction,
} from './featureVisibility.js';
import { layerClassRegistry } from '../classRegistry.js';
import type GlobalHider from './globalHider.js';

export type DataSourceImplementationOptions = LayerImplementationOptions & {
  entities: EntityCollection;
  clock?: DataSourceClock;
};

/**
 * Represents a layer of Cesium.Entity
 * @group Layer
 */
class DataSourceLayer extends Layer<DataSourceCesiumImpl> {
  static get className(): string {
    return 'DataSourceLayer';
  }

  /**
   * The entities of this layer. Use the `addEntity` API to add Enitities to ensure interoperability with vcm interfaces
   */
  entities: EntityCollection = new EntityCollection();

  clock: DataSourceClock | undefined = undefined;

  /**
   * The feature visibility of this layer. NOTE: Entities cannot be highlighted at this moment.
   */
  featureVisibility: FeatureVisibility = new FeatureVisibility();

  protected _supportedMaps = [CesiumMap.className];

  private _featureVisibilityListeners: (() => void)[] = [];

  setGlobalHider(globalHider: GlobalHider): void {
    super.setGlobalHider(globalHider);
    this._setUpFeatureVisibility();
  }

  /**
   * Sets up listeners for featureVisibility and global hider
   */
  private _setUpFeatureVisibility(): void {
    this._featureVisibilityListeners.forEach((cb) => {
      cb();
    });

    this._featureVisibilityListeners = [
      this.featureVisibility.changed.addEventListener(({ action, ids }) => {
        if (action === FeatureVisibilityAction.HIDE) {
          ids.forEach((id) => {
            const entity = this.entities.getById(id as string);
            if (entity) {
              this.featureVisibility.addHiddenFeature(id, entity);
            }
          });
        } // highlight is _possible_ but very tricky with all the possible entity values with potential materials
      }),
      this.entities.collectionChanged.addEventListener((_c, added) => {
        added.forEach((entity) => {
          if (this.featureVisibility.hiddenObjects[entity.id]) {
            this.featureVisibility.addHiddenFeature(entity.id, entity);
          }
          if (this.globalHider && this.globalHider.hiddenObjects[entity.id]) {
            this.globalHider.addFeature(entity.id, entity);
          }
        });
      }),
    ];

    if (this.globalHider) {
      this._featureVisibilityListeners.push(
        this.globalHider.changed.addEventListener(({ action, ids }) => {
          if (action === FeatureVisibilityAction.HIDE) {
            ids.forEach((id) => {
              const entity = this.entities.getById(id as string);
              if (entity) {
                this.globalHider!.addFeature(id, entity);
              }
            });
          }
        }),
      );
    }
  }

  initialize(): Promise<void> {
    if (!this.initialized) {
      this._setUpFeatureVisibility();
    }
    return super.initialize();
  }

  getImplementationOptions(): DataSourceImplementationOptions {
    return {
      ...super.getImplementationOptions(),
      entities: this.entities,
      clock: this.clock,
    };
  }

  createImplementationsForMap(map: CesiumMap): DataSourceCesiumImpl[] {
    if (map instanceof CesiumMap) {
      return [new DataSourceCesiumImpl(map, this.getImplementationOptions())];
    }
    return [];
  }

  /**
   * adds an entity
   * @param  options - Cesium Entity options or the entity
   * @param  attributes - a set of properties, typically used for rendering a balloon
   * @param  allowPicking - whether to override the layers allowPicking setting for this entity
   * @returns  the entities id
   */
  addEntity(
    options: Entity.ConstructorOptions | Entity,
    attributes?: Record<string, unknown>,
    allowPicking?: boolean,
  ): null | string {
    const entity = this.entities.add(options);
    entity[vcsLayerName] = this.name;
    entity.attributes = attributes;
    entity.allowPicking = allowPicking;
    return entity.id;
  }

  /**
   * Zooms to an entity with the given id
   */
  flyToEntity(id: string): void {
    this.getImplementations().forEach((impl) => {
      impl.flyToEntity(id);
    });
  }

  /**
   * Removes an entity from this layer by id
   */
  removeEntityById(id: string): void {
    this.entities.removeById(id);
  }

  destroy(): void {
    this.entities.removeAll();
    this._featureVisibilityListeners.forEach((cb) => {
      cb();
    });
    this._featureVisibilityListeners = [];
    this.featureVisibility.destroy();
    super.destroy();
  }
}

layerClassRegistry.registerClass(DataSourceLayer.className, DataSourceLayer);
export default DataSourceLayer;
