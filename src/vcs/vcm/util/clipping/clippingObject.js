import { v4 as uuidv4 } from 'uuid';
import Cesium3DTileset from 'cesium/Source/Scene/Cesium3DTileset.js';

import { check } from '@vcsuite/check';
import { parseBoolean } from '@vcsuite/parsers';
import { getLogger as getLoggerByName } from '@vcsuite/logger';
import CesiumMap from '../../maps/cesium.js';
import VcsEvent from '../../event/vcsEvent.js';
import LayerCollection from '../layerCollection.js';

/**
 * @namespace clipping
 * @memberOf vcs.vcm.util
 * @export
 * @api
 */

/**
 * Object to define an entity which is clipped by this ClippingObject
 * @typedef {Object} vcs.vcm.util.clipping.ClippingObject.EntityOption
 * @property {string} layerName
 * @property {string} entityId
 * @api
 */

/**
 * @typedef {Object} vcs.vcm.util.clipping.ClippingObject.Options
 * @property {Array<string>|undefined} layerNames
 * @property {Array<vcs.vcm.util.clipping.ClippingObject.EntityOption>|undefined} entities
 * @property {Cesium/ClippingPlaneCollection|undefined} clippingPlaneCollection
 * @property {boolean} [terrain=false]
 * @property {boolean} [local=false] - if not local, coordinates are expected in ECEF
 * @api
 */

/**
 * @returns {vcs-logger/Logger}
 */
function getLogger() {
  return getLoggerByName('vcs.vcm.util.clipping.ClippingObject');
}

const globeSymbol = Symbol('ClippingObjectGlobe');

/**
 * The ClippingObject is a container for a Cesium.ClippingPlaneCollection. The container holds information on the
 * targeted Cesium objects, based on layerNames (for [CesiumTileset]{@link vcs.vcm.layer.CesiumTileset}) or
 * layerName and entity id for Cesium.DataSource which are part of an [DataSource]{@link vcs.vcm.layer.DataSource} layer.
 * Adding a ClippingObject to the [ClippingObjectManager]{@link vcs.vcm.util.clipping.ClippingObjectManager} applies the
 * objects Cesium.ClippingPlaneCollection where applicable. Once added, changes to the targets of the object are tracked.
 * To update the Cesium.ClippingPlaneCollection or its definitions, you must trigger an update by setting the clippingPlaneCollection
 * property to the new definition.
 * @class
 * @export
 * @api stable
 * @memberOf vcs.vcm.util.clipping
 */
class ClippingObject {
  /**
   * @param {vcs.vcm.util.clipping.ClippingObject.Options=} options
   */
  constructor(options = {}) {
    /** @type {string} */
    this.id = uuidv4();

    /**
     * The current layerNames. Use add/removeLayer to manipulate.
     * @type {Array<string>}
     * @readonly
     * @api
     */
    this.layerNames = options.layerNames || [];

    /**
     * The current entities and their respective layerNames. Use add/removeEntity to manipulate
     * @type {Array<vcs.vcm.util.clipping.ClippingObject.EntityOption>}
     * @readonly
     * @api
     */
    this.entities = options.entities || [];

    /**
     * Key is a semantic identifier, eg. layerName or layerName-entitiyId, depending on the target. Targets
     * represent Cesium Object which support the clippingPlanes API
     * @type {Map<(string|symbol), Cesium/Entity|Cesium/Cesium3DTileset|Cesium/Globe>}
     */
    this.targets = new Map();

    /**
     * @type {Cesium/ClippingPlaneCollection|null}
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
     * @type {vcs.vcm.event.VcsEvent<void>}
     * @api
     */
    this.targetsUpdated = new VcsEvent();

    /**
     * Event, raised on changes to the clippingPlaneCollection property
     * @type {vcs.vcm.event.VcsEvent<void>}
     * @api
     */
    this.clippingPlaneUpdated = new VcsEvent();

    /**
     * @type {Set<vcs.vcm.layer.FeatureStore>}
     * @private
     */
    this._cachedFeatureStoreLayers = new Set();
    this._activeMap = null;
    this._layerCollection = null;
  }

  /**
   * The current Cesium.ClippingPlaneCollection. To update the collection, set this property to the new definition.
   * @api
   * @type {Cesium/ClippingPlaneCollection|null}
   */
  get clippingPlaneCollection() { return this._clippingPlaneCollection; }

  /**
   * @param {Cesium/ClippingPlaneCollection} clippingPlaneCollection
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
   * @param {vcs.vcm.util.LayerCollection} layerCollection
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
   * @param {vcs.vcm.layer.Layer} layer
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
            tilesets.forEach((tileset) => {
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
              const entity = /** @type {Cesium/CustomDataSource} */ (dataSource).entities.getById(eo.entityId);
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
    } else if (this.layerNames.includes(layer.name) && layer.className === 'vcs.vcm.layer.FeatureStore') {
      if (layer.active) {
        this._cachedFeatureStoreLayers.add(/** @type {vcs.vcm.layer.FeatureStore} */ (layer));
      } else if (this._cachedFeatureStoreLayers.has(/** @type {vcs.vcm.layer.FeatureStore} */ (layer))) {
        this._cachedFeatureStoreLayers.delete(/** @type {vcs.vcm.layer.FeatureStore} */ (layer));
      }
    }
  }

  /**
   * @param {vcs.vcm.maps.VcsMap|null} map
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
