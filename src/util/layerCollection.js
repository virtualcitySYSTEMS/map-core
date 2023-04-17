import { check } from '@vcsuite/check';
import IndexedCollection from './indexedCollection.js';
import ExclusiveManager from './exclusiveManager.js';
import LayerState from '../layer/layerState.js';
import VcsEvent from '../vcsEvent.js';
import GlobalHider from '../layer/globalHider.js';

/**
 * The largest integer zindex which can be safely assigned to a layer (equal to Number.MAX_SAFE_INTEGER)
 * You should use this to ensure layers are always rendered on top.
 * @type {number}
 */
export const maxZIndex = Number.MAX_SAFE_INTEGER;

/**
 * A collection of layers. Manages rendering order and layer exclusivity. Emits state changes for convenience. Passed to
 * {@link Map} for layers available to said map. Layers must have unique names.
 * @class
 * @api
 * @extends {IndexedCollection<import("@vcmap/core").Layer>}}
 */
// ignored do to static issues, see https://github.com/microsoft/TypeScript/issues/4628
// @ts-ignore
class LayerCollection extends IndexedCollection {
  /**
   * Creates a LayerCollection from an iterable of layers, such as an Array.
   * @param {Iterable<import("@vcmap/core").Layer>} iterable
   * @returns {LayerCollection}
   * @override
   * @api
   */
  static from(iterable) {
    const collection = new LayerCollection();

    if (iterable) {
      // eslint-disable-next-line no-restricted-syntax
      for (const layer of iterable) {
        collection.add(layer);
      }
    }
    return collection;
  }

  constructor() {
    super();

    /**
     * Array of layer event listeners
     * @type {Object<string, Array<Function>>}
     * @private
     */
    this._layerEventListeners = {};

    /**
     * @type {symbol}
     * @private
     */
    this._zIndexSymbol = Symbol('zIndex');

    /**
     * Event raised, when a layer of this collection changes its state. Passed the layer.
     * @type {VcsEvent<import("@vcmap/core").Layer>}
     * @api
     */
    this.stateChanged = new VcsEvent();

    /**
     * The exclusive manager for this collection. Layers within this collection are automatically added and tracked.
     * @type {ExclusiveManager}
     * @api
     */
    this.exclusiveManager = new ExclusiveManager();

    /**
     * The global hider for this collection.
     * @type {GlobalHider}
     * @private
     */
    this._globalHider = new GlobalHider();

    /**
     * Locale for this layerCollection, will be synchronized by the vcsApp, if part of an vcsApp.
     * This Locale will be set on all Member Layers. On setting the Locale this will trigger a reload of all locale
     * aware layers.
     * @type {string}
     * @private
     */
    this._locale = 'en';
  }

  /**
   * A symbol to describe the local z index of a layer. The local z index must not equal the layers z index, but is
   * always consistent in comparison to the neighbouring layers. If a layer is moved other then by z index, the collection
   * ensures consistency by setting a new local z index if needed.
   * @type {symbol}
   * @readonly
   */
  get zIndexSymbol() { return this._zIndexSymbol; }

  /**
   * The current global hider of these layers
   * @type {GlobalHider}
   */
  get globalHider() {
    return this._globalHider;
  }

  /**
   * The current global hider of these layers
   * @type {GlobalHider}
   * @param {GlobalHider} globalHider
   * @returns {void}
   */
  set globalHider(globalHider) {
    check(globalHider, GlobalHider);

    this._globalHider = globalHider;
    this._array.forEach((layer) => {
      layer.setGlobalHider(this._globalHider);
    });
  }

  /**
   * @type {string}
   */
  get locale() {
    return this._locale;
  }

  /**
   * @param {string} value
   */
  set locale(value) {
    check(value, String);

    if (this._locale !== value) {
      this._locale = value;
      [...this].forEach((layer) => {
        layer.locale = this._locale;
      });
    }
  }

  /**
   * @param {import("@vcmap/core").Layer} layer
   * @private
   */
  _listenToLayerEvents(layer) {
    const stateListener = layer.stateChanged.addEventListener((state) => {
      if (state === LayerState.ACTIVE) {
        this.exclusiveManager.handleLayerActivated(layer);
      }
      this.stateChanged.raiseEvent(layer);
    });

    const zIndexListener = layer.zIndexChanged.addEventListener(() => {
      this._zIndexChanged(layer);
    });

    const exclusiveGroupsListener = layer.exclusiveGroupsChanged.addEventListener(() => {
      this.exclusiveManager.handleExclusiveGroupsChanged(layer);
    });

    const listeners = [stateListener, zIndexListener, exclusiveGroupsListener];
    if (/** @type {SplitLayer} */ (layer).splitDirectionChanged) {
      listeners.push(/** @type {SplitLayer} */ (layer).splitDirectionChanged.addEventListener(() => {
        this.exclusiveManager.handleSplitDirectionChanged(layer);
      }));
    }
    this._layerEventListeners[layer.name] = listeners;
  }

  /**
   * Determines the location in the array before the first entry with a higher local z index or null if there is no such position
   * @param {number} zIndex
   * @returns {number|null}
   * @private
   */
  _findZIndexPosition(zIndex) {
    const usedIndex = this._array.findIndex(l => l[this._zIndexSymbol] > zIndex);
    return usedIndex > -1 ? usedIndex : null;
  }

  /**
   * This is callback for a layers zIndex changed. It reevaluates the array given the new zIndex
   * an moves the specified layer to its new location determined by findeZIndexPosition or the end of the array failing that.
   * @param {import("@vcmap/core").Layer} layer
   * @private
   */
  _zIndexChanged(layer) {
    const currentIndex = this.indexOf(layer);
    if (currentIndex > -1) {
      layer[this._zIndexSymbol] = layer.zIndex;
      let zIndexPosition = this._findZIndexPosition(layer.zIndex);
      if (zIndexPosition > 0 && zIndexPosition > currentIndex) {
        zIndexPosition -= 1; // remove self from count
      }
      zIndexPosition = zIndexPosition != null ? zIndexPosition : this._array.length - 1;
      this._move(layer, currentIndex, zIndexPosition);
      this._ensureLocalZIndex(layer);
    }
  }

  /**
   * Ensures the local z index is consistent with the neighbours of a given layer.
   * e.g. the layer on elower must have a lower or equal zIndex
   * and the one higher a higher or equal zIndex.
   * @param {import("@vcmap/core").Layer} layer
   * @private
   */
  _ensureLocalZIndex(layer) {
    const currentIndex = this.indexOf(layer);
    if (currentIndex > 0) {
      const below = this._array[currentIndex - 1][this._zIndexSymbol];
      if (below > layer[this._zIndexSymbol]) {
        layer[this._zIndexSymbol] = below;
      }
    }

    if (currentIndex < this._array.length - 1) {
      const above = this._array[currentIndex + 1][this._zIndexSymbol];
      if (above < layer[this._zIndexSymbol]) {
        layer[this._zIndexSymbol] = above;
      }
    }
  }

  /**
   * Adds a layer to the collection. Can optionally be passed an index at which to insert the layer.
   * The layer locale will be set to the same locale of the layerCollection. This will trigger a forceRedraw
   * of the layer if the layer locale is different and the layer is locale aware.
   * @param {import("@vcmap/core").Layer} layer
   * @param {number=} index
   * @returns {number|null} returns the layer index or null, if the layers name is not unique
   * @api
   */
  add(layer, index) {
    let usedIndex = index;
    if (index == null) {
      usedIndex = this._findZIndexPosition(layer.zIndex);
    }
    const insertedAt = super.add(layer, usedIndex);
    if (insertedAt != null) {
      layer[this._zIndexSymbol] = layer.zIndex;
      layer.setGlobalHider(this._globalHider);
      layer.locale = this.locale;
      this._ensureLocalZIndex(layer);
      this._listenToLayerEvents(layer);
      this.exclusiveManager.registerLayer(layer);
    }
    return insertedAt;
  }

  /**
   * @param {import("@vcmap/core").Layer} layer
   * @returns {number}
   * @protected
   */
  _remove(layer) {
    if (this._layerEventListeners[layer.name]) {
      this._layerEventListeners[layer.name].forEach((cb) => { cb(); });
      delete this._layerEventListeners[layer.name];
    }
    delete layer[this._zIndexSymbol];
    layer.setGlobalHider(null);
    this.exclusiveManager.unregisterLayer(layer);
    return super._remove(layer);
  }

  clear() {
    Object.values(this._layerEventListeners)
      .flat()
      .forEach((r) => { r(); });
    this._array.forEach((l) => {
      delete l[this._zIndexSymbol];
    });

    this.exclusiveManager.clear();
    this._layerEventListeners = {};
    super.clear();
  }

  destroy() {
    Object.values(this._layerEventListeners)
      .flat()
      .forEach((r) => { r(); });

    this._layerEventListeners = {};
    this.exclusiveManager.destroy();
    this._globalHider.destroy();
    super.destroy();
  }
}

export default LayerCollection;
