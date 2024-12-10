import { parseBoolean } from '@vcsuite/parsers';
import { check } from '@vcsuite/check';
import IndexedCollection from './indexedCollection.js';
import ExclusiveManager from './exclusiveManager.js';
import LayerState from '../layer/layerState.js';
import VcsEvent from '../vcsEvent.js';
import GlobalHider from '../layer/globalHider.js';
// eslint-disable-next-line import/no-named-default
import type { default as Layer, SplitLayer } from '../layer/layer.js';
import VectorClusterGroupCollection from '../vectorCluster/vectorClusterGroupCollection.js';
import type VectorLayer from '../layer/vectorLayer.js';
import { destroyCollection } from '../vcsModuleHelpers.js';

/**
 * The largest integer zindex which can be safely assigned to a layer (equal to Number.MAX_SAFE_INTEGER)
 * You should use this to ensure layers are always rendered on top.
 */
export const maxZIndex = Number.MAX_SAFE_INTEGER;

export type LayerCollectionOptions = {
  vectorClusterGroupCollection?: VectorClusterGroupCollection;
  destroyVectorClusterGroupCollection?: boolean;
};

/**
 * A collection of layers. Manages rendering order and layer exclusivity. Emits state changes for convenience. Passed to
 * {@link Map} for layers available to said map. Layers must have unique names.
 */
// ignored do to static issues, see https://github.com/microsoft/TypeScript/issues/4628
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
class LayerCollection extends IndexedCollection<Layer> {
  /**
   * Creates a LayerCollection from an iterable of layers, such as an Array.
   * @param  iterable
   */
  static from(iterable: Iterable<Layer>): LayerCollection {
    const collection = new LayerCollection();

    if (iterable) {
      // eslint-disable-next-line no-restricted-syntax
      for (const layer of iterable) {
        collection.add(layer);
      }
    }
    return collection;
  }

  private _layerEventListeners: Record<string, (() => void)[]>;

  private _zIndexSymbol: symbol;

  /**
   * Event raised, when a layer of this collection changes its state. Passed the layer.
   */
  stateChanged: VcsEvent<Layer>;

  /**
   * The exclusive manager for this collection. Layers within this collection are automatically added and tracked.
   */
  exclusiveManager: ExclusiveManager;

  /**
   * The global hider for this collection.
   */
  private _globalHider: GlobalHider;

  private _vectorClusterGroups: VectorClusterGroupCollection;

  /**
   * Locale for this layerCollection, will be synchronized by the vcsApp, if part of an vcsApp.
   * This Locale will be set on all Member Layers. On setting the Locale this will trigger a reload of all locale
   * aware layers.
   */
  private _locale: string;

  private _vectorClusterGroupListeners: (() => void) | undefined;

  destroyVectorClusterGroupCollection: boolean;

  constructor(options: LayerCollectionOptions = {}) {
    super();

    this._layerEventListeners = {};
    this._zIndexSymbol = Symbol('zIndex');
    this.stateChanged = new VcsEvent();
    this.exclusiveManager = new ExclusiveManager();
    this._globalHider = new GlobalHider();
    this._locale = 'en';
    if (options.vectorClusterGroupCollection) {
      this._vectorClusterGroups = options.vectorClusterGroupCollection;
    } else {
      this._vectorClusterGroups = new VectorClusterGroupCollection(
        this._globalHider,
      );
    }
    this.destroyVectorClusterGroupCollection = parseBoolean(
      options.destroyVectorClusterGroupCollection,
      !options.vectorClusterGroupCollection,
    );
    this._setupVectorClusterGroupListeners();
  }

  /**
   * A symbol to describe the local z index of a layer. The local z index must not equal the layers z index, but is
   * always consistent in comparison to the neighbouring layers. If a layer is moved other then by z index, the collection
   * ensures consistency by setting a new local z index if needed.
   */
  get zIndexSymbol(): symbol {
    return this._zIndexSymbol;
  }

  /**
   * The current global hider of these layers
   */
  get globalHider(): GlobalHider {
    return this._globalHider;
  }

  /**
   * The current global hider of these layers
   * @param  globalHider
   */
  set globalHider(globalHider: GlobalHider) {
    check(globalHider, GlobalHider);

    this._globalHider = globalHider;
    this._array.forEach((layer) => {
      layer.setGlobalHider(this._globalHider);
    });
    this.vectorClusterGroups.globalHider = this._globalHider;
  }

  get locale(): string {
    return this._locale;
  }

  set locale(value: string) {
    check(value, String);

    if (this._locale !== value) {
      this._locale = value;
      [...this].forEach((layer) => {
        layer.locale = this._locale;
      });
    }
  }

  get vectorClusterGroups(): VectorClusterGroupCollection {
    return this._vectorClusterGroups;
  }

  private _listenToLayerEvents(layer: Layer): void {
    const stateListener = layer.stateChanged.addEventListener(
      (state: LayerState) => {
        if (state === LayerState.ACTIVE) {
          this.exclusiveManager.handleLayerActivated(layer);
        }
        this.stateChanged.raiseEvent(layer);
      },
    );

    const zIndexListener = layer.zIndexChanged.addEventListener(() => {
      this._zIndexChanged(layer);
    });

    const exclusiveGroupsListener =
      layer.exclusiveGroupsChanged.addEventListener(() => {
        this.exclusiveManager.handleExclusiveGroupsChanged(layer);
      });

    const listeners = [stateListener, zIndexListener, exclusiveGroupsListener];
    if ((layer as Layer & SplitLayer).splitDirectionChanged) {
      listeners.push(
        (layer as Layer & SplitLayer).splitDirectionChanged.addEventListener(
          () => {
            this.exclusiveManager.handleSplitDirectionChanged(layer);
          },
        ),
      );
    }

    if ((layer as VectorLayer).vectorClusterGroupChanged) {
      listeners.push(
        (layer as VectorLayer).vectorClusterGroupChanged.addEventListener(
          ({ newGroup, oldGroup }) => {
            if (oldGroup) {
              this._vectorClusterGroups
                .getByKey(oldGroup)
                ?.removeLayer(layer as VectorLayer);
            }
            if (newGroup) {
              this._vectorClusterGroups
                .getByKey(newGroup)
                ?.addLayer(layer as VectorLayer);
            }
          },
        ),
      );
    }
    this._layerEventListeners[layer.name] = listeners;
  }

  /**
   * Determines the location in the array before the first entry with a higher local z index or null if there is no such position
   * @param  zIndex
   * @private
   */
  private _findZIndexPosition(zIndex: number): number | null {
    const usedIndex = this._array.findIndex(
      // @ts-expect-error: z index is undefined
      (l) => l[this._zIndexSymbol] > zIndex,
    );
    return usedIndex > -1 ? usedIndex : null;
  }

  /**
   * This is callback for a layers zIndex changed. It reevaluates the array given the new zIndex
   * an moves the specified layer to its new location determined by findeZIndexPosition or the end of the array failing that.
   * @param  layer
   * @private
   */
  private _zIndexChanged(layer: Layer): void {
    const currentIndex = this.indexOf(layer);
    if (currentIndex > -1) {
      // @ts-expect-error: z index is undefined
      layer[this._zIndexSymbol] = layer.zIndex;
      let zIndexPosition = this._findZIndexPosition(layer.zIndex);
      if (
        zIndexPosition != null &&
        zIndexPosition > 0 &&
        zIndexPosition > currentIndex
      ) {
        zIndexPosition -= 1; // remove self from count
      }
      zIndexPosition =
        zIndexPosition != null ? zIndexPosition : this._array.length - 1;
      this._move(layer, currentIndex, zIndexPosition);
      this._ensureLocalZIndex(layer);
    }
  }

  /**
   * Ensures the local z index is consistent with the neighbours of a given layer.
   * e.g. the layer on elower must have a lower or equal zIndex
   * and the one higher a higher or equal zIndex.
   */
  private _ensureLocalZIndex(layer: Layer): void {
    const currentIndex = this.indexOf(layer);
    // @ts-expect-error: z index is undefined
    const currentLayerZIndex = layer[this._zIndexSymbol] as number;
    if (currentIndex > 0) {
      // @ts-expect-error: z index is undefined
      const below: number = this._array[currentIndex - 1][
        this._zIndexSymbol
      ] as number;
      if (below > currentLayerZIndex) {
        // @ts-expect-error: z index is undefined
        layer[this._zIndexSymbol] = below;
      }
    }

    if (currentIndex < this._array.length - 1) {
      // @ts-expect-error: z index is undefined
      const above = this._array[currentIndex + 1][this._zIndexSymbol] as number;
      if (above < currentLayerZIndex) {
        // @ts-expect-error: z index is undefined
        layer[this._zIndexSymbol] = above;
      }
    }
  }

  private _setupVectorClusterGroupListeners(): void {
    this._vectorClusterGroupListeners =
      this._vectorClusterGroups.added.addEventListener((collection) => {
        this._array
          .filter(
            (layer) =>
              (layer as VectorLayer).vectorClusterGroup === collection.name,
          )
          .forEach((layer) => {
            collection.addLayer(layer as VectorLayer);
          });
      });
  }

  /**
   * Adds a layer to the collection. Can optionally be passed an index at which to insert the layer.
   * The layer locale will be set to the same locale of the layerCollection. This will trigger a forceRedraw
   * of the layer if the layer locale is different and the layer is locale aware.
   * @param  layer
   * @param  index
   * @returns  returns the layer index or null, if the layers name is not unique
   */
  add(layer: Layer, index?: number): number | null {
    let usedIndex: number | null | undefined = index;
    if (index == null) {
      usedIndex = this._findZIndexPosition(layer.zIndex);
    }
    const insertedAt = super.add(layer, usedIndex);
    if (insertedAt != null) {
      // @ts-expect-error: z index is undefined
      layer[this._zIndexSymbol] = layer.zIndex;
      layer.setGlobalHider(this._globalHider);
      layer.locale = this.locale;
      this._ensureLocalZIndex(layer);
      this._listenToLayerEvents(layer);
      this.exclusiveManager.registerLayer(layer);
      if ((layer as VectorLayer).vectorClusterGroup) {
        this._vectorClusterGroups
          .getByKey((layer as VectorLayer).vectorClusterGroup)
          ?.addLayer(layer as VectorLayer);
      }
    }
    return insertedAt;
  }

  protected _remove(layer: Layer): number {
    if (this._layerEventListeners[layer.name]) {
      this._layerEventListeners[layer.name].forEach((cb) => {
        cb();
      });
      delete this._layerEventListeners[layer.name];
    }
    // @ts-expect-error: z index is undefined
    delete layer[this._zIndexSymbol];
    layer.setGlobalHider();
    this.exclusiveManager.unregisterLayer(layer);
    if ((layer as VectorLayer).vectorClusterGroup) {
      this._vectorClusterGroups
        .getByKey((layer as VectorLayer).vectorClusterGroup)
        ?.removeLayer(layer as VectorLayer);
    }
    return super._remove(layer);
  }

  clear(): void {
    Object.values(this._layerEventListeners)
      .flat()
      .forEach((r) => {
        r();
      });
    this._array.forEach((l) => {
      // @ts-expect-error: z index is undefined
      delete l[this._zIndexSymbol];
    });

    this.exclusiveManager.clear();
    this._layerEventListeners = {};
    super.clear();
  }

  destroy(): void {
    Object.values(this._layerEventListeners)
      .flat()
      .forEach((r) => {
        r();
      });

    this._layerEventListeners = {};
    this.exclusiveManager.destroy();
    this._globalHider.destroy();
    this._vectorClusterGroupListeners?.();
    if (this.destroyVectorClusterGroupCollection) {
      destroyCollection(this._vectorClusterGroups);
    }
    super.destroy();
  }
}

export default LayerCollection;
