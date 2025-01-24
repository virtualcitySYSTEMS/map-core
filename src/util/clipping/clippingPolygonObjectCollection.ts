import { Cesium3DTileset } from '@vcmap-cesium/engine';
import Collection from '../collection.js';
import VcsEvent from '../../vcsEvent.js';
import type VcsApp from '../../vcsApp.js';
import type ClippingPolygonObject from './clippingPolygonObject.js';
import {
  addClippingPolygon,
  addClippingPolygonObjectToMap,
  getTargetTilesets,
  removeClippingPolygon,
  removeClippingPolygonFromMap,
} from './clippingPolygonHelper.js';
import { vcsLayerName } from '../../layer/layerSymbols.js';
import CesiumMap from '../../map/cesiumMap.js';
import MapState from '../../map/mapState.js';

class ClippingPolygonObjectCollection extends Collection<ClippingPolygonObject> {
  private _app: VcsApp;

  private _listener: Array<() => void>;

  private _mapListener: Map<string, () => void> = new Map();

  private _itemListener: Map<string, () => void> = new Map();

  stateChanged: VcsEvent<ClippingPolygonObject> = new VcsEvent();

  constructor(app: VcsApp) {
    super();

    this._app = app;

    this._listener = [
      this.added.addEventListener((item) => {
        this._itemListener.set(item.name, this._setItemListener(item));
        if (item.activeOnStartup) {
          item.activate();
        }
      }),
      this.removed.addEventListener((item) => {
        if (item.active) {
          const maps = this._getActiveCesiumMaps();
          maps.forEach((map) => {
            removeClippingPolygonFromMap(
              map,
              item.clippingPolygon,
              item.terrain,
              item.layerNames,
            );
          });
        }
        if (this._itemListener.has(item.name)) {
          this._itemListener.get(item.name)?.();
          this._itemListener.delete(item.name);
        }
      }),
      this._app.maps.added.addEventListener((map) => {
        if (map instanceof CesiumMap) {
          this._mapListener.set(map.name, this._setMapListener(map));
        }
      }),
      this._app.maps.removed.addEventListener((map) => {
        if (map instanceof CesiumMap) {
          this._array.forEach((item) => {
            removeClippingPolygonFromMap(
              map,
              item.clippingPolygon,
              item.terrain,
              item.layerNames,
            );
          });
          if (this._mapListener.has(map.name)) {
            this._mapListener.get(map.name)?.();
            this._mapListener.delete(map.name);
          }
        }
      }),
      this._app.maps.replaced.addEventListener(({ old }) => {
        if (old instanceof CesiumMap) {
          this._array.forEach((item) => {
            removeClippingPolygonFromMap(
              old,
              item.clippingPolygon,
              item.terrain,
              item.layerNames,
            );
          });
          if (this._mapListener.has(old.name)) {
            this._mapListener.get(old.name)?.();
            this._mapListener.delete(old.name);
          }
        }
      }),
    ];
  }

  _getActiveCesiumMaps(): CesiumMap[] {
    return this._app.maps
      .getByType(CesiumMap.className)
      .filter((map) => map.active) as CesiumMap[];
  }

  _setMapListener(map: CesiumMap): () => void {
    const listener = [
      map.stateChanged.addEventListener((state) => {
        if (state === MapState.INACTIVE) {
          this._array.forEach((item) => {
            removeClippingPolygonFromMap(
              map,
              item.clippingPolygon,
              item.terrain,
              item.layerNames,
            );
          });
        } else if (state === MapState.ACTIVE) {
          this._array
            .filter((item) => item.active)
            .forEach((item) => {
              addClippingPolygonObjectToMap(
                map,
                item.clippingPolygon,
                item.terrain,
                item.layerNames,
              );
            });
        }
      }),
      map.visualizationAdded.addEventListener((v) => {
        if (v instanceof Cesium3DTileset) {
          this._array
            .filter(
              (item) =>
                item.active &&
                (item.layerNames === 'all' ||
                  item.layerNames.includes(v[vcsLayerName])),
            )
            .forEach((item) => {
              addClippingPolygon(v, item.clippingPolygon);
            });
        }
      }),
      map.visualizationRemoved.addEventListener((v) => {
        if (v instanceof Cesium3DTileset) {
          this._array
            .filter(
              (item) =>
                item.layerNames === 'all' ||
                item.layerNames.includes(v[vcsLayerName]),
            )
            .forEach((item) => {
              removeClippingPolygon(v, item.clippingPolygon);
            });
        }
      }),
    ];

    return () => listener.forEach((cb) => cb());
  }

  _setItemListener(item: ClippingPolygonObject): () => void {
    const listener = [
      item.stateChanged.addEventListener(() => {
        const maps = this._getActiveCesiumMaps();
        if (item.active) {
          maps.forEach((map) =>
            addClippingPolygonObjectToMap(
              map,
              item.clippingPolygon,
              item.terrain,
              item.layerNames,
            ),
          );
        } else {
          maps.forEach((map) =>
            removeClippingPolygonFromMap(
              map,
              item.clippingPolygon,
              item.terrain,
              item.layerNames,
            ),
          );
        }
      }),
      item.clippingPolygonChanged.addEventListener(({ oldValue, newValue }) => {
        if (item.active) {
          const maps = this._getActiveCesiumMaps();
          maps.forEach((map) =>
            removeClippingPolygonFromMap(
              map,
              oldValue,
              item.terrain,
              item.layerNames,
            ),
          );
          maps.forEach((map) =>
            addClippingPolygonObjectToMap(
              map,
              newValue,
              item.terrain,
              item.layerNames,
            ),
          );
        }
      }),
      item.terrainChanged.addEventListener(() => {
        if (item.active) {
          const globes = this._getActiveCesiumMaps()
            .map((map) => map.getScene()?.globe)
            .filter((g) => !!g);
          if (item.terrain) {
            globes.forEach((g) => addClippingPolygon(g, item.clippingPolygon));
          } else {
            globes.forEach((g) =>
              removeClippingPolygon(g, item.clippingPolygon),
            );
          }
        }
      }),
      item.layersChanged.addEventListener(({ newValue, oldValue }) => {
        const maps = this._getActiveCesiumMaps();
        maps.forEach((map) => {
          const old = getTargetTilesets(map, oldValue);
          const tilesets = getTargetTilesets(map, newValue);

          const added = tilesets.filter((i) => !old.includes(i));
          const removed = old.filter((i) => !tilesets.includes(i));

          removed.forEach((tileset) => {
            removeClippingPolygon(tileset, item.clippingPolygon);
          });
          added.forEach((tileset) => {
            addClippingPolygon(tileset, item.clippingPolygon);
          });
        });
      }),
    ];

    return () => listener.forEach((cb) => cb());
  }

  destroy(): void {
    this._listener.forEach((cb) => cb());
    this._mapListener.forEach((cb) => cb());
    this._itemListener.forEach((cb) => cb());
    super.destroy();
  }
}

export default ClippingPolygonObjectCollection;
