import { v4 as uuidv4 } from 'uuid';
import {
  Cesium3DTileset,
  type ClippingPlaneCollection,
  type CustomDataSource,
  type Entity,
  type Globe,
  type Scene,
} from '@vcmap-cesium/engine';

import { check } from '@vcsuite/check';
import { parseBoolean } from '@vcsuite/parsers';
import { getLogger as getLoggerByName, type Logger } from '@vcsuite/logger';
import CesiumMap from '../../map/cesiumMap.js';
import VcsEvent from '../../vcsEvent.js';
import LayerCollection from '../layerCollection.js';
import type FeatureStoreLayer from '../../layer/featureStoreLayer.js';
import type VcsMap from '../../map/vcsMap.js';
import type Layer from '../../layer/layer.js';

export type ClippingObjectEntityOption = {
  layerName: string;
  entityId: string;
};

export type ClippingObjectOptions = {
  layerNames?: string[];
  entities?: ClippingObjectEntityOption[];
  clippingPlaneCollection?: ClippingPlaneCollection;
  terrain?: boolean;
  local?: boolean;
};

export type ClippingTarget = Globe | Entity | Cesium3DTileset;

function getLogger(): Logger {
  return getLoggerByName('ClippingObject');
}

const globeSymbol = Symbol('ClippingObjectGlobe');

/**
 * The ClippingObject is a container for a Cesium.ClippingPlaneCollection. The container holds information on the
 * targeted Cesium objects, based on layerNames (for [CesiumTilesetLayer]{@link CesiumTilesetLayer}) or
 * layerName and entity id for Cesium.DataSourceLayer which are part of an [DataSourceLayer]{@link DataSourceLayer} layer.
 * Adding a ClippingObject to the [ClippingObjectManager]{@link ClippingObjectManager} applies the
 * objects Cesium.ClippingPlaneCollection where applicable. Once added, changes to the targets of the object are tracked.
 * To update the Cesium.ClippingPlaneCollection or its definitions, you must trigger an update by setting the clippingPlaneCollection
 * property to the new definition.
 */
class ClippingObject {
  id = uuidv4();

  /**
   * The current layerNames. Use add/removeimport("@vcmap/core").Layer to manipulate.
   */
  readonly layerNames: string[];

  /**
   * Key is a semantic identifier, eg. layerName or layerName-entitiyId, depending on the target. Targets
   * represent Cesium Object which support the clippingPlanes API
   */
  targets: Map<string | symbol, ClippingTarget> = new Map();

  /**
   * The current entities and their respective layerNames. Use add/removeEntity to manipulate
   */
  readonly entities: ClippingObjectEntityOption[];

  private _clippingPlaneCollection: ClippingPlaneCollection | undefined;

  private _terrain: boolean;

  private _local: boolean;

  /**
   * Event, raised on a change of targets
   */
  targetsUpdated = new VcsEvent<void>();

  /**
   * Event, raised on changes to the clippingPlaneCollection property
   */
  clippingPlaneUpdated = new VcsEvent<void>();

  private _cachedFeatureStoreLayers: Set<FeatureStoreLayer> = new Set();

  private _activeMap: VcsMap | null = null;

  private _layerCollection: LayerCollection | null = null;

  constructor(options: ClippingObjectOptions = {}) {
    this.layerNames = options.layerNames || [];
    this.entities = options.entities || [];
    this._clippingPlaneCollection = options.clippingPlaneCollection;
    this._terrain = parseBoolean(options.terrain, false);
    this._local = parseBoolean(options.local, false);
  }

  /**
   * The current Cesium.ClippingPlaneCollection. To update the collection, set this property to the new definition.
   */
  get clippingPlaneCollection(): ClippingPlaneCollection | undefined {
    return this._clippingPlaneCollection;
  }

  set clippingPlaneCollection(
    clippingPlaneCollection: ClippingPlaneCollection | undefined,
  ) {
    this._clippingPlaneCollection = clippingPlaneCollection;
    this.clippingPlaneUpdated.raiseEvent();
  }

  /**
   * Flag to indicate whether the globe/terrain is part of the targets.
   */
  get terrain(): boolean {
    return this._terrain;
  }

  set terrain(terrain: boolean) {
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
   */
  get local(): boolean {
    return this._local;
  }

  set local(local: boolean) {
    check(local, Boolean);

    if (this._local !== local) {
      this._local = local;
      this.clippingPlaneUpdated.raiseEvent();
    }
  }

  setLayerCollection(layerCollection: LayerCollection): void {
    check(layerCollection, LayerCollection);

    if (this._layerCollection && this._layerCollection !== layerCollection) {
      throw new Error('layerCollection has already been set');
    }
    this._layerCollection = layerCollection;
    [...this._layerCollection].forEach((l) => {
      this.handleLayerChanged(l);
    });
  }

  handleLayerChanged(layer: Layer): void {
    const map = this._activeMap;
    if (map instanceof CesiumMap) {
      if (this.layerNames.includes(layer.name)) {
        if (layer.active) {
          const visualisations = map.getVisualizationsForLayer(layer);
          const tilesets = visualisations
            ? ([...visualisations].filter(
                (v) => v instanceof Cesium3DTileset,
              ) as Cesium3DTileset[])
            : [];

          if (tilesets.length > 0) {
            tilesets.forEach((tileset) => {
              if (this.layerNames.includes(layer.name) && layer.active) {
                this.targets.set(layer.name, tileset);
                this.targetsUpdated.raiseEvent();
              }
            });
          } else {
            const index = this.layerNames.indexOf(layer.name);
            getLogger().warning(
              `layer ${layer.name} cannot have a ClippingObject applied`,
            );
            this.layerNames.splice(index, 1);
          }
        } else if (this.targets.has(layer.name)) {
          this.targets.delete(layer.name);
          this.targetsUpdated.raiseEvent();
        }
      } else if (this.entities.find((eo) => eo.layerName === layer.name)) {
        let raise = false;
        const visualisations = map.getVisualizationsForLayer(layer);
        const dataSource = visualisations ? [...visualisations][0] : null;

        if (!dataSource) {
          const index = this.layerNames.indexOf(layer.name);
          getLogger().warning(
            `layer ${layer.name} cannot have a ClippingObject applied`,
          );
          this.layerNames.splice(index, 1);
          return;
        }

        this.entities
          .filter((eo) => eo.layerName === layer.name)
          .forEach((eo) => {
            const key = `${eo.layerName}-${eo.entityId}`;
            if (layer.active) {
              const entity = (dataSource as CustomDataSource).entities.getById(
                eo.entityId,
              );
              if (entity) {
                this.targets.set(key, entity);
                raise = true;
              } else {
                const index = this.entities.indexOf(eo);
                getLogger().warning(
                  `could not find entity with id ${eo.entityId} in layer ${eo.layerName}`,
                );
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
    } else if (
      this.layerNames.includes(layer.name) &&
      layer.className === 'FeatureStoreLayer'
    ) {
      if (layer.active) {
        this._cachedFeatureStoreLayers.add(layer as FeatureStoreLayer);
      } else if (
        this._cachedFeatureStoreLayers.has(layer as FeatureStoreLayer)
      ) {
        this._cachedFeatureStoreLayers.delete(layer as FeatureStoreLayer);
      }
    }
  }

  handleMapChanged(map: VcsMap | null): void {
    if (map instanceof CesiumMap) {
      const { globe } = map.getScene() as Scene;
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
        this._cachedFeatureStoreLayers.forEach((layer) => {
          this.handleLayerChanged(layer);
        });
        this._cachedFeatureStoreLayers.clear();
      }
    }
    this._activeMap = map;
  }

  /**
   * add a layer name to the ClippingObject's layerNames array
   * @param  layerName
   */
  addLayer(layerName: string): void {
    check(layerName, String);

    if (!this.layerNames.includes(layerName)) {
      this.layerNames.push(layerName);
      const layer = this._layerCollection
        ? this._layerCollection.getByKey(layerName)
        : null;
      // XXX active state is not part of this yet
      if (layer && layer.active) {
        this.handleLayerChanged(layer);
      }
    }
  }

  /**
   * removes a layer from the ClippingObject's layerNames array
   * @param  layerName
   */
  removeLayer(layerName: string): void {
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
   * @param  layerName
   * @param  entityId
   */
  addEntity(layerName: string, entityId: string): void {
    check(layerName, String);
    check(entityId, String);

    if (
      !this.entities.find(
        (eo) => eo.layerName === layerName && eo.entityId === entityId,
      )
    ) {
      this.entities.push({ layerName, entityId });
      const layer = this._layerCollection
        ? this._layerCollection.getByKey(layerName)
        : null;
      if (layer && layer.active) {
        this.handleLayerChanged(layer);
      }
    }
  }

  /**
   * remove entity from the ClippingObject's entities array
   * @param  layerName
   * @param  entityId
   */
  removeEntity(layerName: string, entityId: string): void {
    check(layerName, String);
    check(entityId, String);

    const index = this.entities.findIndex(
      (c) => c.layerName === layerName && c.entityId === entityId,
    );
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
