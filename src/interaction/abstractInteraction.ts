import { v4 as uuidv4 } from 'uuid';
import type {
  Cartesian2,
  Cesium3DTileFeature,
  Cesium3DTilePointFeature,
  Entity,
  Ray,
} from '@vcmap-cesium/engine';
import type { Coordinate } from 'ol/coordinate.js';
import type { Feature } from 'ol';
import {
  EventType,
  ModificationKeyType,
  PointerEventType,
  PointerKeyType,
} from './interactionType.js';
import type VcsMap from '../map/vcsMap.js';
import VcsEvent from '../vcsEvent.js';

export type MapEvent = {
  pointerEvent: PointerEventType;
  map: VcsMap;
  windowPosition: Cartesian2;
  key: ModificationKeyType;
  pointer: PointerKeyType;
  /**
   * position in web mercator coordinates
   */
  position?: Coordinate;
  /**
   * position in web mercator coordinates or image coordinates in ObliqueMap Map Mode
   */
  positionOrPixel?: Coordinate;
  multipleTouch?: boolean;
  time?: number | null;
};

export type ObliqueParameters = {
  /**
   * the image pixel clicked
   */
  pixel: import('ol/coordinate.js').Coordinate;
  /**
   * true if the terrain could not be taken into account
   */
  estimate?: boolean;
};

export type EventFeature =
  | Feature
  | Cesium3DTileFeature
  | Cesium3DTilePointFeature
  | Entity;

export type InteractionEvent = MapEvent & {
  type: EventType;
  /**
   * a potential feature at said location
   */
  feature?: EventFeature;
  /**
   * further features at said location. includes .feature
   */
  features?: EventFeature[];
  /**
   * if set to true, the event chain is interrupted
   */
  stopPropagation?: boolean;
  /**
   * additional parameters from oblique if obliquemode is active
   */
  obliqueParameters?: ObliqueParameters;
  ray?: Ray;
  /**
   * whether the position is exact, eg with translucentDepthPicking on
   */
  exactPosition?: boolean;
  /**
   * called when the event chain has ended in which this event was fired.
   */
  chainEnded?: VcsEvent<void>;
};

export type EventAfterEventHandler = Omit<
  InteractionEvent,
  'position' | 'positionOrPixel'
> & { position: Coordinate; positionOrPixel: Coordinate };

/**
 * An abstract interface for all interactions
 * @group Interaction
 */
class AbstractInteraction {
  /**
   * A unique identifier for this interaction
   */
  id: string;

  private _defaultActive: number;

  /**
   * The current active bitmask for {@link EventType}
   */
  active: number;

  private _defaultModificationKey: ModificationKeyType;

  /**
   * The current active {@link ModificationKeyType}
   */
  modificationKey: ModificationKeyType;

  private _defaultPointerKey: PointerKeyType;

  /**
   * The currently active {@link PointerKeyType}
   */
  pointerKey: PointerKeyType;

  /**
   * @param  [defaultActive=EventType.NONE] - A bitmask representing the default  to listen to
   * @param  [defaultModificationKey=ModificationKeyType.NONE] - A bitmask representing the default  keys to listen to
   * @param  [defaultPointerKey=PointerKeyType.LEFT] - A bitmask representing the  pointer key to listen to
   */
  constructor(
    defaultActive: EventType = EventType.NONE,
    defaultModificationKey: ModificationKeyType = ModificationKeyType.NONE,
    defaultPointerKey: PointerKeyType = PointerKeyType.LEFT,
  ) {
    this.id = uuidv4();
    this._defaultActive = defaultActive;
    this.active = this._defaultActive;
    this._defaultModificationKey = defaultModificationKey;
    this.modificationKey = this._defaultModificationKey;
    this._defaultPointerKey = defaultPointerKey;
    this.pointerKey = this._defaultPointerKey;
  }

  /**
   * Main function, called when an event is raised for this interaction
   */
  // eslint-disable-next-line class-methods-use-this
  pipe(event: InteractionEvent): Promise<InteractionEvent> {
    return Promise.resolve(event);
  }

  /**
   * Called when the modifier keys have changed.
   */
  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  modifierChanged(_modifier: ModificationKeyType): void {}

  /**
   * Sets the interaction active.
   * Use boolean (true|false) to toggle default behavior.
   * Pass it a bitmask of {@link EventType}
   * to change the active state.
   * Call without arguments to reset the default active, modification key and pointer Key behavior
   */
  setActive(active?: boolean | number): void {
    if (typeof active === 'undefined') {
      this.active = this._defaultActive;
      this.modificationKey = this._defaultModificationKey;
      this.pointerKey = this._defaultPointerKey;
    } else if (typeof active === 'boolean') {
      this.active = active ? this._defaultActive : EventType.NONE;
    } else {
      this.active = active;
    }
  }

  /**
   * Sets the modification key to listen to or the default modification key if none is provided.
   */
  setModification(mod?: ModificationKeyType): void {
    if (mod) {
      this.modificationKey = mod;
    } else {
      this.modificationKey = this._defaultModificationKey;
    }
  }

  /**
   * Sets the pointer key for this interaction or the default pointer if none is provided.
   */
  setPointer(pointer?: PointerKeyType): void {
    if (pointer) {
      this.pointerKey = pointer;
    } else {
      this.pointerKey = this._defaultPointerKey;
    }
  }

  /**
   * destroys the implementation, removing any created resources
   */
  // eslint-disable-next-line class-methods-use-this
  destroy(): void {}
}

export default AbstractInteraction;
