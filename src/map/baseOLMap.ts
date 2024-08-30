import { Cartesian2 } from '@vcmap-cesium/engine';
import { unByKey } from 'ol/Observable.js';
import OLMap from 'ol/Map.js';
import { defaults as defaultInteractions } from 'ol/interaction.js';
import type { Collection as OLCollection, MapBrowserEvent } from 'ol';
import type { Layer as OLLayer } from 'ol/layer.js';
import type { EventsKey } from 'ol/events.js';
import type { Coordinate } from 'ol/coordinate.js';

import VcsMap from './vcsMap.js';
import { vcsLayerName } from '../layer/layerSymbols.js';
import {
  ModificationKeyType,
  PointerEventType,
  PointerKeyType,
} from '../interaction/interactionType.js';
import { mapClassRegistry } from '../classRegistry.js';
import type LayerCollection from '../util/layerCollection.js';
import type Layer from '../layer/layer.js';
import { DisableMapControlOptions } from '../util/mapCollection.js';

export function ensureLayerInCollection(
  layers: OLCollection<OLLayer>,
  layer: OLLayer,
  layerCollection: LayerCollection,
): void {
  const targetIndex = layerCollection.indexOfKey(layer[vcsLayerName]) as number;
  if (targetIndex > -1) {
    const layerArray = layers.getArray();

    if (!layerArray.includes(layer)) {
      let indexInOlCollection = layerArray.findIndex((l) => {
        const layerIndex = layerCollection.indexOfKey(
          l[vcsLayerName],
        ) as number;
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
 * @group Map
 */
class BaseOLMap extends VcsMap<OLLayer> {
  static get className(): string {
    return 'BaseOLMap';
  }

  private _olMap: OLMap | null = null;

  private _olListeners: EventsKey[] = [];

  get splitPosition(): number {
    return super.splitPosition;
  }

  set splitPosition(position: number) {
    super.splitPosition = position;
    this.requestRender();
  }

  get olMap(): OLMap | null {
    return this._olMap;
  }

  private _raisePointerInteraction(
    olEvent: MapBrowserEvent<PointerEvent>,
    pointerEvent: PointerEventType,
  ): void {
    const pointerMap: Record<number, PointerKeyType> = {
      '-1': PointerKeyType.ALL,
      0: PointerKeyType.LEFT,
      1: PointerKeyType.MIDDLE,
      2: PointerKeyType.RIGHT,
    };
    let key = olEvent.originalEvent.shiftKey
      ? ModificationKeyType.SHIFT
      : ModificationKeyType.NONE;
    key = olEvent.originalEvent.ctrlKey ? ModificationKeyType.CTRL : key;
    key = olEvent.originalEvent.altKey ? ModificationKeyType.ALT : key;
    if (key !== ModificationKeyType.NONE) {
      olEvent.preventDefault();
    }
    olEvent.originalEvent.preventDefault();
    const position = [olEvent.coordinate[0], olEvent.coordinate[1]];
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

  setTarget(target: string | HTMLElement | null): void {
    super.setTarget(target);
    if (this._olMap && this.target) {
      this._olMap.updateSize();
    }
  }

  initialize(): Promise<void> {
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
      const pointerDownListener =
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this._olMap.on('pointerdown', (event) => {
          this._raisePointerInteraction(
            event as MapBrowserEvent<PointerEvent>,
            PointerEventType.DOWN,
          );
        });
      const pointerUpListener =
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this._olMap.on('pointerup', (event) => {
          this._raisePointerInteraction(
            event as MapBrowserEvent<PointerEvent>,
            PointerEventType.UP,
          );
        });

      const pointerMoveListener = this._olMap.on('pointermove', (event) => {
        this._raisePointerInteraction(
          event as MapBrowserEvent<PointerEvent>,
          PointerEventType.MOVE,
        );
      });

      const postRenderListener = this._olMap.on(
        'postrender',
        (originalEvent) => {
          this.postRender.raiseEvent({ map: this, originalEvent });
        },
      );

      this._olListeners.push(
        pointerDownListener,
        pointerUpListener,
        pointerMoveListener,
        postRenderListener,
      );
    }
    return Promise.resolve();
  }

  async activate(): Promise<void> {
    await super.activate();
    if (this.active && this._olMap) {
      this._olMap.updateSize();
    }
  }

  indexChanged(layer: Layer): void {
    const viz = this.getVisualizationsForLayer(layer);
    if (viz) {
      viz.forEach((olLayer) => {
        const layers = (this._olMap as OLMap).getLayers();
        layers.remove(olLayer);
        ensureLayerInCollection(
          layers as OLCollection<OLLayer>,
          olLayer,
          this.layerCollection,
        );
      });
    }
  }

  addOLLayer(olLayer: OLLayer): void {
    if (this.validateVisualization(olLayer)) {
      this.addVisualization(olLayer);
      ensureLayerInCollection(
        (this._olMap as OLMap).getLayers() as OLCollection<OLLayer>,
        olLayer,
        this.layerCollection,
      );
    }
  }

  /**
   * Internal API for deregistering representations.
   */
  removeOLLayer(olLayer: OLLayer): void {
    this.removeVisualization(olLayer);
    if (this._olMap) {
      this._olMap.getLayers().remove(olLayer);
    }
  }

  disableMovement(prevent: boolean | DisableMapControlOptions): void {
    super.disableMovement(prevent);
    if (this._olMap) {
      this._olMap.getInteractions().forEach((i) => {
        i.setActive(!this.movementPointerEventsDisabled);
      });
    }
  }

  // eslint-disable-next-line no-unused-vars
  getCurrentResolution(_coordinate: Coordinate): number {
    const view = this.olMap ? this.olMap.getView() : null;
    if (view) {
      return view.getResolution() ?? 1;
    }
    return 1;
  }

  requestRender(): void {
    if (this._olMap) {
      this._olMap.render();
    }
  }

  destroy(): void {
    if (this._olMap) {
      this._olMap.setTarget();
    }
    unByKey(this._olListeners);
    super.destroy();
  }
}

mapClassRegistry.registerClass(BaseOLMap.className, BaseOLMap);
export default BaseOLMap;
