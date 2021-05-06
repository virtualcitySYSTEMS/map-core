import CustomDataSource from '@vcmap/cesium/Source/DataSources/CustomDataSource.js';
import BoundingSphereState from '@vcmap/cesium/Source/DataSources/BoundingSphereState.js';
import BoundingSphere from '@vcmap/cesium/Source/Core/BoundingSphere.js';
import HeadingPitchRange from '@vcmap/cesium/Source/Core/HeadingPitchRange.js';
import CesiumMath from '@vcmap/cesium/Source/Core/Math.js';
import LayerImplementation from '../layerImplementation.js';
import { vcsLayerName } from '../layerSymbols.js';

/**
 * @param {Cesium/EntityCollection} source
 * @param {Cesium/EntityCollection} destination
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
 * @extends {vcs.vcm.layer.LayerImplementation<vcs.vcm.maps.CesiumMap>}
 * @memberOf vcs.vcm.layer.cesium
 */
class DataSourceCesium extends LayerImplementation {
  /**
   * @param {vcs.vcm.maps.CesiumMap} map
   * @param {vcs.vcm.layer.DataSource.ImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);

    /**
     * @type {Cesium/CustomDataSource|Cesium/CzmlDataSource}
     */
    this.dataSource = new CustomDataSource(this.name);
    this.dataSource[vcsLayerName] = this.name;
    /**
     * @type {Cesium/EntityCollection}
     */
    this.entities = options.entities;
    /**
     * @type {Cesium/DataSourceClock|undefined}
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

export default DataSourceCesium;
