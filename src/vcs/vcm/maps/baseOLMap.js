import { Cartesian2 } from '@vcmap/cesium';
import { unByKey } from 'ol/Observable.js';
import OLMap from 'ol/Map.js';
import { defaults as defaultInteractions } from 'ol/interaction.js';
import VcsMap from './map.js';
import { vcsLayerName } from '../layer/layerSymbols.js';
import { ModificationKeyType, PointerEventType, PointerKeyType } from '../interaction/interactionType.js';
import { VcsClassRegistry } from '../classRegistry.js';

/**
 * @param {ol/Collection<ol/layer/Layer>} layers
 * @param {ol/layer/Layer} layer
 * @param {vcs.vcm.util.LayerCollection} layerCollection
 */
export function ensureLayerInCollection(layers, layer, layerCollection) {
  const targetIndex = layerCollection.indexOfKey(layer[vcsLayerName]);
  if (targetIndex > -1) {
    const layerArray = layers.getArray();

    if (!layerArray.includes(layer)) {
      let indexInOlCollection = layerArray.findIndex((l) => {
        const layerIndex = layerCollection.indexOfKey(l[vcsLayerName]);
        return layerIndex > targetIndex;
      });
      if (indexInOlCollection === -1) {
        indexInOlCollection = layerArray.length;
      }
      layers.insertAt(indexInOlCollection, layer);
    }
  }
}

/**
 * Openlayers Map base map.
 * @class
 * @abstract
 * @api
 * @export
 * @extends {vcs.vcm.maps.VcsMap}
 * @memberOf vcs.vcm.maps
 */
class BaseOLMap extends VcsMap {
  static get className() { return 'vcs.vcm.maps.BaseOLMap'; }

  /**
   * @param {vcs.vcm.maps.VcsMap.Options} options
   */
  constructor(options) {
    super(options);

    /**
     * the openlayers map object, set after initialization
     * @private
     * @type {ol/Map|null}
     */
    this._olMap = null;
    /**
     * @type {Array<ol/events/EventsKey>}
     * @private
     */
    this._olListeners = [];
  }

  /**
   * @returns {ol/Map}
   * @readonly
   * @api
   */
  get olMap() {
    return this._olMap;
  }

  /**
   * @param {ol/MapBrowserEvent} olEvent
   * @param {vcs.vcm.interaction.PointerEventType} pointerEvent
   * @private
   */
  _raisePointerInteraction(olEvent, pointerEvent) {
    const pointerMap = {
      '-1': PointerKeyType.ALL,
      0: PointerKeyType.LEFT,
      1: PointerKeyType.MIDDLE,
      2: PointerKeyType.RIGHT,
    };
    let key = olEvent.originalEvent.shiftKey ? ModificationKeyType.SHIFT : ModificationKeyType.NONE;
    key = olEvent.originalEvent.ctrlKey ? ModificationKeyType.CTRL : key;
    key = olEvent.originalEvent.altKey ? ModificationKeyType.ALT : key;
    if (key !== ModificationKeyType.NONE) {
      olEvent.preventDefault();
    }
    olEvent.originalEvent.preventDefault();
    const position = [olEvent.coordinate[0], olEvent.coordinate[1], 0];
    this.pointerInteractionEvent.raiseEvent({
      map: this,
      position,
      positionOrPixel: position,
      windowPosition: Cartesian2.fromArray(olEvent.pixel, 0, new Cartesian2()),
      key,
      pointer: pointerMap[olEvent.originalEvent.button || 0],
      pointerEvent,
    });
  }

  /**
   * @inheritDoc
   * @param {string|HTMLElement|null} target
   */
  setTarget(target) {
    super.setTarget(target);
    if (this._olMap && this.target) {
      this._olMap.updateSize();
    }
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this._olMap) {
      this._olMap = new OLMap({
        layers: [],
        controls: [],
        interactions: defaultInteractions({
          altShiftDragRotate: false,
          pinchRotate: false,
          shiftDragZoom: false,
          doubleClickZoom: false,
        }),
        target: this.mapElement,
      });

      this._olListeners.push(/** @type {ol/events/EventsKey} */ (this.olMap.on('pointerdown', (event) => {
        this._raisePointerInteraction(event, PointerEventType.DOWN);
      })));
      this._olListeners.push(/** @type {ol/events/EventsKey} */ (this.olMap.on('pointerup', (event) => {
        this._raisePointerInteraction(event, PointerEventType.UP);
      })));
      this._olListeners.push(/** @type {ol/events/EventsKey} */ (this.olMap.on('pointermove', (event) => {
        this._raisePointerInteraction(event, PointerEventType.MOVE);
      })));
    }
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  async activate() {
    await super.activate();
    if (this.active) {
      this._olMap.updateSize();
    }
  }

  /**
   * @inheritDoc
   * @param {vcs.vcm.layer.Layer} layer
   */
  indexChanged(layer) {
    const viz = this.getVisualizationsForLayer(layer);
    if (viz) {
      viz.forEach(/** @param {ol/layer/Layer} olLayer */ (olLayer) => {
        const layers = /** @type {ol/Collection<ol/layer/Layer>} */ (this._olMap.getLayers());
        layers.remove(olLayer);
        ensureLayerInCollection(layers, olLayer, this.layerCollection);
      });
    }
  }

  /**
   * Internal API for registering representations.
   * @param {ol/layer/Layer} olLayer
   */
  addOLLayer(olLayer) {
    if (this.validateVisualization(olLayer)) {
      this.addVisualization(olLayer);
      ensureLayerInCollection(
        /** @type {ol/Collection<ol/layer/Layer>} */ (this._olMap.getLayers()),
        olLayer,
        this.layerCollection,
      );
    }
  }

  /**
   * Internal API for deregistering representations.
   * @param {ol/layer/Layer} olLayer
   */
  removeOLLayer(olLayer) {
    this.removeVisualization(olLayer);
    this._olMap.getLayers().remove(olLayer);
  }

  /**
   * @param {boolean} prevent
   * @inheritDoc
   */
  disableMovement(prevent) {
    super.disableMovement(prevent);
    if (this._olMap) {
      this._olMap.getInteractions().forEach((i) => { i.setActive(!prevent); });
    }
  }

  /**
   * @inheritDoc
   * @param {ol/Coordinate} coordinate
   * @returns {number}
   * @api
   */
  // eslint-disable-next-line no-unused-vars
  getCurrentResolution(coordinate) {
    const view = this.olMap ? this.olMap.getView() : null;
    if (view) {
      return view.getResolution();
    }
    return 1;
  }

  /**
   * @inheritDoc
   * @api
   */
  requestRender() {
    if (this._olMap) {
      this._olMap.render();
    }
  }

  /**
   * @inheritDoc
   * @api
   */
  destroy() {
    if (this._olMap) {
      this._olMap.setTarget(null);
    }
    unByKey(this._olListeners);
    super.destroy();
  }
}

VcsClassRegistry.registerClass(BaseOLMap.className, BaseOLMap);
export default BaseOLMap;
