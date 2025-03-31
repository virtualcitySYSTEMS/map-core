import type {
  DataSourceClock,
  Scene,
  DataSourceDisplay,
  EntityCollection,
} from '@vcmap-cesium/engine';
import {
  CustomDataSource,
  BoundingSphereState,
  BoundingSphere,
  HeadingPitchRange,
  Math as CesiumMath,
} from '@vcmap-cesium/engine';
import LayerImplementation from '../layerImplementation.js';
import { vcsLayerName } from '../layerSymbols.js';
import type CesiumMap from '../../map/cesiumMap.js';
import type { DataSourceImplementationOptions } from '../dataSourceLayer.js';
import type Viewpoint from '../../util/viewpoint.js';

function synchronizeEntityCollections(
  source: EntityCollection,
  destination: EntityCollection,
): () => void {
  source.values.forEach((entity) => {
    destination.add(entity);
  });
  return source.collectionChanged.addEventListener((_c, added, removed) => {
    added.forEach((e) => {
      destination.add(e);
    });
    removed.forEach((e) => {
      destination.remove(e);
    });
  });
}

class DataSourceCesiumImpl extends LayerImplementation<CesiumMap> {
  static get className(): string {
    return 'DataSourceCesiumImpl';
  }

  dataSource: CustomDataSource;

  entities: EntityCollection;

  clock: DataSourceClock | undefined;

  // eslint-disable-next-line class-methods-use-this
  private _collectionListener: () => void = () => {};

  constructor(map: CesiumMap, options: DataSourceImplementationOptions) {
    super(map, options);

    this.dataSource = new CustomDataSource(this.name);
    this.dataSource[vcsLayerName] = this.name;
    this.entities = options.entities;
    this.clock = options.clock;
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      this._collectionListener = synchronizeEntityCollections(
        this.entities,
        this.dataSource.entities,
      );
      await this.map.addDataSource(this.dataSource);
    }
    await super.initialize();
  }

  async activate(): Promise<void> {
    await super.activate();
    if (this.active) {
      this.dataSource.show = true;
    }
    if (this.clock) {
      this.map.setDataSourceDisplayClock(this.clock);
    }
  }

  deactivate(): void {
    super.deactivate();
    this.dataSource.show = false;
    if (this.clock) {
      this.map.unsetDataSourceDisplayClock(this.clock);
    }
  }

  flyToEntity(id: string): void {
    if (this.active) {
      const entity = this.dataSource.entities.getById(id);
      if (!entity) {
        this.getLogger().warning('could not find entity on this layer');
        return;
      }
      const dataSource = this.map.getDataSourceDisplay() as DataSourceDisplay;
      const scene = this.map.getScene() as Scene;
      const { camera } = scene;

      const bSphere = new BoundingSphere();

      const viewpoint = this.map.getViewpointSync() as Viewpoint;
      const { heading, pitch } = viewpoint;
      const offset = new HeadingPitchRange(
        CesiumMath.toRadians(heading),
        CesiumMath.toRadians(pitch < -45 ? pitch : -45),
        undefined,
      );
      let listener: () => void;
      let count = 0;

      const onRender = (): void => {
        const state = dataSource.getBoundingSphere(entity, true, bSphere);
        if (state === BoundingSphereState.PENDING) {
          return;
        }

        if (state === BoundingSphereState.FAILED) {
          count += 1;
          if (count > 3) {
            listener();
          }
          return;
        }

        camera.flyToBoundingSphere(bSphere, {
          duration: 1,
          offset,
        });
        listener();
      };

      const datas = dataSource.defaultDataSource;
      if (datas.isLoading) {
        const loadedListener = datas.loadingEvent.addEventListener(() => {
          listener = scene.postRender.addEventListener(onRender);
          loadedListener();
        });
      } else {
        listener = scene.postRender.addEventListener(onRender);
      }
    }
  }

  destroy(): void {
    if (this.map.initialized && !this.isDestroyed) {
      this.map.removeDataSource(this.dataSource);
    }
    this._collectionListener();
    this.dataSource.entities.removeAll();
    if (this.clock) {
      this.map.unsetDataSourceDisplayClock(this.clock);
    }
    super.destroy();
  }
}

export default DataSourceCesiumImpl;
