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

  private _styledMapboxLayerGroup: LayerGroup | undefined;

  private _createStyledLayerGroup: () => Promise<LayerGroup>;

  private _removeChildLayerListeners: (() => void) | null = null;

  constructor(
    map: OpenlayersMap,
    options: MapboxStyleLayerImplementationOptions,
  ) {
    super(map, options);
    this._createStyledLayerGroup = options.createStyledLayerGroup;
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      this._styledMapboxLayerGroup = await this._createStyledLayerGroup();
    }
    await super.initialize();
  }

  getOLLayer(): OLLayerLike {
    if (!this._styledMapboxLayerGroup) {
      throw new Error('Mapbox layer group must be initialized before use');
    }
    return this._styledMapboxLayerGroup as OLLayerLike;
  }

  updateSplitDirection(splitDirection: SplitDirection): void {
    this.splitDirection = splitDirection;
    if (this.initialized) {
      this._removeChildLayerListeners?.();
      this._removeChildLayerListeners = null;

      if (!this._styledMapboxLayerGroup) {
        return;
      }

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
    this._styledMapboxLayerGroup?.dispose();
    this._styledMapboxLayerGroup = undefined;
    super.destroy();
  }
}

export default MapboxVectorTileOpenlayersImpl;
