import { v4 as uuidv4 } from 'uuid';
import { Cesium3DTileset } from '@vcmap/cesium';

import { check } from '@vcsuite/check';
import { parseBoolean } from '@vcsuite/parsers';
import { getLogger as getLoggerByName } from '@vcsuite/logger';
import CesiumMap from '../../map/cesiumMap.js';
import VcsEvent from '../../vcsEvent.js';
import LayerCollection from '../layerCollection.js';

/**
 * @namespace clipping
 * @export
 * @api
 */

/**
 * Object to define an entity which is clipped by this ClippingObject
 * @typedef {Object} ClippingObjectEntityOption
 * @property {string} layerName
 * @property {string} entityId
 * @api
 */

/**
 * @typedef {Object} ClippingObjectOptions
 * @property {Array<string>|undefined} layerNames
 * @property {Array<ClippingObjectEntityOption>|undefined} entities
 * @property {import("@vcmap/cesium").ClippingPlaneCollection|undefined} clippingPlaneCollection
 * @property {boolean} [terrain=false]
 * @property {boolean} [local=false] - if not local, coordinates are expected in ECEF
 * @api
 */

/**
 * @returns {import("@vcsuite/logger").Logger}
 */
function getLogger() {
  return getLoggerByName('ClippingObject');
}

const globeSymbol = Symbol('ClippingObjectGlobe');

/**
 * The ClippingObject is a container for a Cesium.ClippingPlaneCollection. The container holds information on the
 * targeted Cesium objects, based on layerNames (for [CesiumTilesetLayer]{@link CesiumTilesetLayer}) or
 * layerName and entity id for Cesium.DataSourceLayer which are part of an [DataSourceLayer]{@link DataSource} layer.
 * Adding a ClippingObject to the [ClippingObjectManager]{@link ClippingObjectManager} applies the
 * objects Cesium.ClippingPlaneCollection where applicable. Once added, changes to the targets of the object are tracked.
 * To update the Cesium.ClippingPlaneCollection or its definitions, you must trigger an update by setting the clippingPlaneCollection
 * property to the new definition.
 * @class
 * @export
 * @api stable
 */
class ClippingObject {
  /**
   * @param {ClippingObjectOptions=} options
   */
  constructor(options = {}) {
    /** @type {string} */
    this.id = uuidv4();

    /**
     * The current layerNames. Use add/removeimport("@vcmap/core").Layer to manipulate.
     * @type {Array<string>}
     * @readonly
     * @api
     */
    this.layerNames = options.layerNames || [];

    /**
     * The current entities and their respective layerNames. Use add/removeEntity to manipulate
     * @type {Array<ClippingObjectEntityOption>}
     * @readonly
     * @api
     */
    this.entities = options.entities || [];

    /**
     * Key is a semantic identifier, eg. layerName or layerName-entitiyId, depending on the target. Targets
     * represent Cesium Object which support the clippingPlanes API
     * @type {Map<(string|symbol), import("@vcmap/cesium").Entity|import("@vcmap/cesium").Cesium3DTileset|import("@vcmap/cesium").Globe>}
     */
    this.targets = new Map();

    /**
     * @type {import("@vcmap/cesium").ClippingPlaneCollection|null}
     * @private
     */
    this._clippingPlaneCollection = options.clippingPlaneCollection || null;
    /**
     * @type {boolean}
     * @private
     */
    this._terrain = parseBoolean(options.terrain, false);
    /**
     * @type {boolean}
     * @private
     */
    this._local = parseBoolean(options.local, false);

    /**
     * Event, raised on a change of targets
     * @type {VcsEvent<void>}
     * @api
     */
    this.targetsUpdated = new VcsEvent();

    /**
     * Event, raised on changes to the clippingPlaneCollection property
     * @type {VcsEvent<void>}
     * @api
     */
    this.clippingPlaneUpdated = new VcsEvent();

    /**
     * @type {Set<import("@vcmap/core").FeatureStoreLayer>}
     * @private
     */
    this._cachedFeatureStoreLayers = new Set();
    this._activeMap = null;
    this._layerCollection = null;
  }

  /**
   * The current Cesium.ClippingPlaneCollection. To update the collection, set this property to the new definition.
   * @api
   * @type {import("@vcmap/cesium").ClippingPlaneCollection|null}
   */
  get clippingPlaneCollection() { return this._clippingPlaneCollection; }

  /**
   * @param {import("@vcmap/cesium").ClippingPlaneCollection} clippingPlaneCollection
   */
  set clippingPlaneCollection(clippingPlaneCollection) {
    this._clippingPlaneCollection = clippingPlaneCollection;
    this.clippingPlaneUpdated.raiseEvent();
  }

  /**
   * Flag to indicate whether the globe/terrain is part of the targets.
   * @api
   * @type {boolean}
   */
  get terrain() { return this._terrain; }

  /**
   * @param {boolean} terrain
   */
  set terrain(terrain) {
    check(terrain, Boolean);

    if (this._terrain !== terrain) {
      this._terrain = terrain;
      this.handleMapChanged(this._activeMap);
    }
  }

  /**
   * Flag to indicate, whether this ClippingObject represents coordinates in a local frame. If false,
   * Plane coordiantes are assumed to be in ECEF or have an appropriate model matrix
   * applied to the Cesium.ClippingPlaneCollection.
   * @api
   * @type {boolean}
   */
  get local() { return this._local; }

  /**
   * @param {boolean} local
   */
  set local(local) {
    check(local, Boolean);

    if (this._local !== local) {
      this._local = local;
      this.clippingPlaneUpdated.raiseEvent();
    }
  }

  /**
   * @param {import("@vcmap/core").LayerCollection} layerCollection
   */
  setLayerCollection(layerCollection) {
    check(layerCollection, LayerCollection);

    if (this._layerCollection && this._layerCollection !== layerCollection) {
      throw new Error('layerCollection has already been set');
    }
    this._layerCollection = layerCollection;
    [...this._layerCollection].forEach((l) => {
      this.handleLayerChanged(l);
    });
  }

  /**
   * @param {import("@vcmap/core").Layer} layer
   */
  handleLayerChanged(layer) {
    const map = this._activeMap;
    if (map instanceof CesiumMap) {
      if (this.layerNames.includes(layer.name)) {
        if (layer.active) {
          const visualisations = map.getVisualizationsForLayer(layer);
          const tilesets = visualisations ?
            [...visualisations]
              .filter(v => v instanceof Cesium3DTileset) :
            [];

          if (tilesets.length > 0) {
            tilesets.forEach(/** @param {import("@vcmap/cesium").Cesium3DTileset} tileset */ (tileset) => {
              tileset.readyPromise.then((cesium3DTileset) => {
                if (this.layerNames.includes(layer.name) && layer.active) {
                  this.targets.set(layer.name, cesium3DTileset);
                  this.targetsUpdated.raiseEvent();
                }
              });
            });
          } else {
            const index = this.layerNames.indexOf(layer.name);
            getLogger().warning(`layer ${layer.name} cannot have a ClippingObject applied`);
            this.layerNames.splice(index, 1);
          }
        } else if (this.targets.has(layer.name)) {
          this.targets.delete(layer.name);
          this.targetsUpdated.raiseEvent();
        }
      } else if (this.entities.find(eo => eo.layerName === layer.name)) {
        let raise = false;
        const visualisations = map.getVisualizationsForLayer(layer);
        const dataSource = visualisations ?
          [...visualisations][0] :
          null;

        if (!dataSource) {
          const index = this.layerNames.indexOf(layer.name);
          getLogger().warning(`layer ${layer.name} cannot have a ClippingObject applied`);
          this.layerNames.splice(index, 1);
          return;
        }

        this.entities
          .filter(eo => eo.layerName === layer.name)
          .forEach((eo) => {
            const key = `${eo.layerName}-${eo.entityId}`;
            if (layer.active) {
              const entity = /** @type {import("@vcmap/cesium").CustomDataSource} */ (dataSource)
                .entities.getById(eo.entityId);
              if (entity) {
                this.targets.set(key, entity);
                raise = true;
              } else {
                const index = this.entities.indexOf(eo);
                getLogger().warning(`could not find entity with id ${eo.entityId} in layer ${eo.layerName}`);
                this.entities.splice(index, 1);
              }
            } else if (this.targets.has(key)) {
              this.targets.delete(key);
              raise = true;
            }
          });

        if (raise) {
          this.targetsUpdated.raiseEvent();
        }
      }
    } else if (this.layerNames.includes(layer.name) && layer.className === 'FeatureStoreLayer') {
      if (layer.active) {
        this._cachedFeatureStoreLayers.add(/** @type {import("@vcmap/core").FeatureStoreLayer} */ (layer));
      } else if (this._cachedFeatureStoreLayers.has(/** @type {import("@vcmap/core").FeatureStoreLayer} */ (layer))) {
        this._cachedFeatureStoreLayers.delete(/** @type {import("@vcmap/core").FeatureStoreLayer} */ (layer));
      }
    }
  }

  /**
   * @param {import("@vcmap/core").VcsMap|null} map
   */
  handleMapChanged(map) {
    if (map instanceof CesiumMap) {
      const { globe } = map.getScene();
      let raise = false;
      if (this._terrain && !this.targets.has(globeSymbol)) {
        this.targets.set(globeSymbol, globe);
        raise = true;
      } else if (!this._terrain && this.targets.has(globeSymbol)) {
        this.targets.delete(globeSymbol);
        raise = true;
      }

      if (raise) {
        this.targetsUpdated.raiseEvent();
      }

      if (this._cachedFeatureStoreLayers.size > 0) {
        this._cachedFeatureStoreLayers.forEach((layer) => { this.handleLayerChanged(layer); });
        this._cachedFeatureStoreLayers.clear();
      }
    }
    this._activeMap = map;
  }

  /**
   * add a layer name to the ClippingObject's layerNames array
   * @api
   * @param {string} layerName
   */
  addLayer(layerName) {
    check(layerName, String);

    if (!this.layerNames.includes(layerName)) {
      this.layerNames.push(layerName);
      const layer = this._layerCollection ?
        this._layerCollection.getByKey(layerName) :
        null;
      // XXX active state is not part of this yet
      if (layer && layer.active) {
        this.handleLayerChanged(layer);
      }
    }
  }

  /**
   * removes a layer from the ClippingObject's layerNames array
   * @api
   * @param {string} layerName
   */
  removeLayer(layerName) {
    check(layerName, String);

    const index = this.layerNames.indexOf(layerName);
    if (index > -1) {
      this.layerNames.splice(index, 1);
    }

    if (this.targets.has(layerName)) {
      this.targets.delete(layerName);
      this.targetsUpdated.raiseEvent();
    }
  }

  /**
   * add an entity to the ClippingObject's entities array
   * @api
   * @param {string} layerName
   * @param {string} entityId
   */
  addEntity(layerName, entityId) {
    check(layerName, String);
    check(entityId, String);

    if (!this.entities.find(eo => eo.layerName === layerName && eo.entityId === entityId)) {
      this.entities.push({ layerName, entityId });
      const layer = this._layerCollection ?
        this._layerCollection.getByKey(layerName) :
        null;
      if (layer && layer.active) {
        this.handleLayerChanged(layer);
      }
    }
  }

  /**
   * remove entity from the ClippingObject's entities array
   * @api
   * @param {string} layerName
   * @param {string} entityId
   */
  removeEntity(layerName, entityId) {
    check(layerName, String);
    check(entityId, String);

    const index = this.entities.findIndex(c => c.layerName === layerName && c.entityId === entityId);
    if (index > -1) {
      this.entities.splice(index, 1);
    }

    const targetId = `${layerName}-${entityId}`;
    if (this.targets.has(targetId)) {
      this.targets.delete(targetId);
      this.targetsUpdated.raiseEvent();
    }
  }
}

export default ClippingObject;
