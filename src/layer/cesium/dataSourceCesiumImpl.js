import {
  CustomDataSource,
  BoundingSphereState,
  BoundingSphere,
  HeadingPitchRange,
  Math as CesiumMath,
} from '@vcmap/cesium';
import LayerImplementation from '../layerImplementation.js';
import { vcsLayerName } from '../layerSymbols.js';

/**
 * @param {import("@vcmap/cesium").EntityCollection} source
 * @param {import("@vcmap/cesium").EntityCollection} destination
 * @returns {Function}
 */
function synchronizeEntityCollections(source, destination) {
  source.values.forEach((entity) => {
    destination.add(entity);
  });
  return source.collectionChanged.addEventListener((c, added, removed) => {
    added.forEach((e) => { destination.add(e); });
    removed.forEach((e) => { destination.remove(e); });
  });
}

/**
 * @class
 * @export
 * @extends {LayerImplementation<import("@vcmap/core").CesiumMap>}}
 */
class DataSourceCesiumImpl extends LayerImplementation {
  /** @type {string} */
  static get className() { return 'DataSourceCesiumImpl'; }

  /**
   * @param {import("@vcmap/core").CesiumMap} map
   * @param {DataSourceImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);

    /**
     * @type {import("@vcmap/cesium").CustomDataSource|import("@vcmap/cesium").CzmlDataSource}
     */
    this.dataSource = new CustomDataSource(this.name);
    this.dataSource[vcsLayerName] = this.name;
    /**
     * @type {import("@vcmap/cesium").EntityCollection}
     */
    this.entities = options.entities;
    /**
     * @type {import("@vcmap/cesium").DataSourceClock|undefined}
     */
    this.clock = options.clock;
    /**
     * @type {Function}
     * @private
     */
    this._collectionListener = () => {};
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.initialized) {
      this._collectionListener = synchronizeEntityCollections(this.entities, this.dataSource.entities);
      await this.map.addDataSource(this.dataSource);
    }
    await super.initialize();
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  async activate() {
    await super.activate();
    if (this.active) {
      this.dataSource.show = true;
    }
    if (this.clock) {
      this.map.setDataSourceDisplayClock(this.clock);
    }
  }

  /**
   * @inheritDoc
   */
  deactivate() {
    super.deactivate();
    this.dataSource.show = false;
    if (this.clock) {
      this.map.unsetDataSourceDisplayClock(this.clock);
    }
  }

  /**
   * @param {string} id
   */
  flyToEntity(id) {
    if (this.active) {
      const entity = this.dataSource.entities.getById(id);
      if (!entity) {
        this.getLogger().warning('could not find entity on this layer');
        return;
      }
      const dataSource = this.map.getDataSourceDisplay();
      const scene = this.map.getScene();
      const { camera } = scene;

      const bSphere = new BoundingSphere();

      const viewpoint = this.map.getViewPointSync();
      const { heading, pitch } = viewpoint;
      const offset = new HeadingPitchRange(
        CesiumMath.toRadians(heading),
        CesiumMath.toRadians(pitch < -45 ? pitch : -45),
        undefined,
      );
      let listener;
      let count = 0;

      const onRender = () => {
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

  /**
   * @inheritDoc
   */
  destroy() {
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
