import type LayerGroup from 'ol/layer/Group.js';
import { SplitDirection } from '@vcmap-cesium/engine';
import { unByKey } from 'ol/Observable.js';
import type { EventsKey } from 'ol/events.js';
import type OpenlayersMap from '../../map/openlayersMap.js';
import type { MapboxStyleLayerImplementationOptions } from '../cesium/mapboxStyleCesiumImpl.js';
import type { OLLayerLike } from '../../map/baseOLMap.js';
import LayerOpenlayersImpl from './layerOpenlayersImpl.js';

class MapboxVectorTileOpenlayersImpl extends LayerOpenlayersImpl {
  static get className(): string {
    return 'MapboxVectorTileOpenlayersImpl';
  }

  private _styledMapboxLayerGroup: LayerGroup;

  private _removeChildLayerListeners: (() => void) | null = null;

  constructor(
    map: OpenlayersMap,
    options: MapboxStyleLayerImplementationOptions,
  ) {
    super(map, options);
    this._styledMapboxLayerGroup = options.styledMapboxLayerGroup;
  }

  getOLLayer(): OLLayerLike {
    return this._styledMapboxLayerGroup as OLLayerLike;
  }

  updateSplitDirection(splitDirection: SplitDirection): void {
    this.splitDirection = splitDirection;
    if (this.initialized) {
      this._removeChildLayerListeners?.();
      this._removeChildLayerListeners = null;

      if (splitDirection !== SplitDirection.NONE) {
        const childLayers = this._styledMapboxLayerGroup.getLayersArray();
        const listenerKeys: EventsKey[] = [];
        childLayers.forEach((layer) => {
          listenerKeys.push(
            layer.on('prerender', this._splitPreRender.bind(this)),
          );
          listenerKeys.push(
            layer.on('postrender', this._splitPostReder.bind(this)),
          );
          layer.changed();
        });
        this._removeChildLayerListeners = (): void => {
          unByKey(listenerKeys);
        };
      } else {
        const childLayers = this._styledMapboxLayerGroup.getLayersArray();
        childLayers.forEach((layer) => {
          layer.changed();
        });
      }
    }
  }

  destroy(): void {
    this._removeChildLayerListeners?.();
    this._removeChildLayerListeners = null;
    super.destroy();
  }
}

export default MapboxVectorTileOpenlayersImpl;
