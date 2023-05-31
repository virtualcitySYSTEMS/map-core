import { v4 as uuidv4 } from 'uuid';
import { Cartesian2 } from '@vcmap-cesium/engine';
import { check, checkMaybe } from '@vcsuite/check';
import { getLogger as getLoggerByName, type Logger } from '@vcsuite/logger';
import AbstractInteraction, {
  InteractionEvent,
  MapEvent,
} from './abstractInteraction.js';
import InteractionChain from './interactionChain.js';
import CoordinateAtPixel from './coordinateAtPixel.js';
import FeatureAtPixelInteraction from './featureAtPixelInteraction.js';
import {
  EventType,
  ModificationKeyType,
  PointerEventType,
} from './interactionType.js';
import FeatureProviderInteraction from './featureProviderInteraction.js';
import VcsEvent from '../vcsEvent.js';

type EventHandlerExclusiveInteraction = {
  id: string;
  interactions: (AbstractInteraction | undefined)[];
  cb: ((() => void) | undefined)[];
};

type LastClick = {
  windowPosition: Cartesian2;
  time: number | null;
};

function getLogger(): Logger {
  return getLoggerByName('EventHandler');
}

class EventHandler {
  private _positionInteraction: CoordinateAtPixel;

  private _featureInteraction: FeatureAtPixelInteraction;

  private _featureProviderInteraction: FeatureProviderInteraction;

  private _interactionChain: InteractionChain;

  clickDuration: number;

  dragDuration: number;

  private _lastDown: MapEvent | null;

  private _lastClick: LastClick;

  private _lastKeyEventModifiers: Map<ModificationKeyType, boolean>;

  private _lastDispatchedModifier: ModificationKeyType;

  private _dragging: MapEvent | null;

  private _running: boolean;

  private _eventQueue: Array<InteractionEvent>;

  private _exclusiveInteraction: EventHandlerExclusiveInteraction | null;

  private _multiples: boolean;

  exclusiveRemoved: VcsEvent<void>;

  exclusiveAdded: VcsEvent<void>;

  private _boundKeyListener: (e: KeyboardEvent) => void;

  private _modifierChanged: VcsEvent<ModificationKeyType>;

  constructor() {
    this._positionInteraction = new CoordinateAtPixel();
    this._featureInteraction = new FeatureAtPixelInteraction();
    this._featureProviderInteraction = new FeatureProviderInteraction();
    this._interactionChain = new InteractionChain([
      this._positionInteraction,
      this._featureInteraction,
      this._featureProviderInteraction,
    ]);

    this.clickDuration = 400;

    this.dragDuration = 100;

    this._lastDown = null;

    this._lastClick = {
      time: null,
      windowPosition: new Cartesian2(),
    };

    this._lastKeyEventModifiers = new Map();
    this._lastKeyEventModifiers.set(ModificationKeyType.SHIFT, false);
    this._lastKeyEventModifiers.set(ModificationKeyType.ALT, false);
    this._lastKeyEventModifiers.set(ModificationKeyType.CTRL, false);

    this._lastDispatchedModifier = ModificationKeyType.NONE;

    this._dragging = null;

    this._running = false;

    this._eventQueue = [];

    this._exclusiveInteraction = null;

    this._multiples = false;

    this.exclusiveRemoved = new VcsEvent();

    this.exclusiveAdded = new VcsEvent();

    this._boundKeyListener = this._keyListener.bind(this);
    window.addEventListener('keydown', this._boundKeyListener);
    window.addEventListener('keyup', this._boundKeyListener);

    this._modifierChanged = new VcsEvent();
  }

  get positionInteraction(): CoordinateAtPixel {
    return this._positionInteraction;
  }

  get featureInteraction(): FeatureAtPixelInteraction {
    return this._featureInteraction;
  }

  get featureProviderInteraction(): FeatureProviderInteraction {
    return this._featureProviderInteraction;
  }

  /**
   * A copy of all the EventHandler interactions
   */
  get interactions(): AbstractInteraction[] {
    return this._interactionChain.chain.slice();
  }

  /**
   * An event called, when the modifier changes. Order of precedence, if more then one key is pressed: SHIFT, ALT, CTRL
   */
  get modifierChanged(): VcsEvent<ModificationKeyType> {
    return this._modifierChanged;
  }

  /**
   * Add a dynamic interaction to the interaction chain. This is the default methodology for
   * user map interactions, such as drawing or measuring. If another exclusive interaction is added,
   * this interaction is removed and a provided callback is called. Use the id parameter to add multiple interactions
   * from the same source (if you don't wish to provide an {@link InteractionChain})
   * @param  interaction
   * @param  removed - the callback for when the interaction is forcefully removed.
   * @param  index - the position at which to push the interaction. If no index is provided, the interaction is pushed at the end and therefore is executed last.
   * @param  id - an id to allow for multiple interactions to belong to the same exclusive registerer
   * @returns  function to remove the interaction with. returns number of removed interactions (0|1)
   */
  addExclusiveInteraction(
    interaction: AbstractInteraction,
    removed: () => void,
    index?: number,
    id?: string,
  ): () => void {
    check(interaction, AbstractInteraction);
    check(removed, Function);
    checkMaybe(index, Number);
    checkMaybe(id, String);

    if (this._exclusiveInteraction && this._exclusiveInteraction.id !== id) {
      this.removeExclusive();
    }
    this._interactionChain.addInteraction(interaction, index);
    if (this._exclusiveInteraction) {
      this._exclusiveInteraction.interactions.push(interaction);
      this._exclusiveInteraction.cb.push(removed);
    } else {
      this._exclusiveInteraction = {
        id: id || uuidv4(),
        cb: [removed],
        interactions: [interaction],
      };
    }
    this.exclusiveAdded.raiseEvent();
    return this._exclusiveUnListen.bind(
      this,
      interaction,
      this._exclusiveInteraction.id,
    );
  }

  /**
   * Removes any exclusive listeners. Typically only called from the framework to ensure the pubsub listeners are consistent
   */
  removeExclusive(): void {
    if (this._exclusiveInteraction) {
      this._exclusiveInteraction.interactions
        .filter((i) => i)
        .forEach((i) => {
          this._interactionChain.removeInteraction(i as AbstractInteraction);
        });
      this._exclusiveInteraction.cb
        .filter((cb) => cb)
        .forEach((cb) => {
          (cb as () => void)();
        });
      this._exclusiveInteraction = null;
      this.exclusiveRemoved.raiseEvent();
    }
  }

  /**
   * Removes an exclusive interaction by its id
   */
  private _exclusiveUnListen(
    interaction: AbstractInteraction,
    id: string,
  ): number {
    if (
      !this._exclusiveInteraction ||
      (this._exclusiveInteraction && this._exclusiveInteraction.id !== id)
    ) {
      return 0;
    }
    const removed = this._interactionChain.removeInteraction(interaction);
    const index = this._exclusiveInteraction.interactions.findIndex(
      (candidate) => candidate && candidate.id === interaction.id,
    );
    if (index > -1) {
      this._exclusiveInteraction.interactions.splice(index, 1, undefined);
      this._exclusiveInteraction.cb.splice(index, 1, undefined);
    }
    if (this._exclusiveInteraction.interactions.every((i) => i === undefined)) {
      this._exclusiveInteraction = null;
    }
    if (removed > -1) {
      this.exclusiveRemoved.raiseEvent();
    }
    return removed !== -1 ? 1 : 0;
  }

  /**
   * Adds an interaction permanently to the interaction chain. Only add non-interferring
   * interactions in such a fashion (for instance for displaying the cursor position)
   * @param  interaction
   * @param  [index=3] - at what position this interaction should be added. By default, it is added after the featureProviderInteraction
   * @returns  function to remove the interaction with. returns number of removed interactions (0|1)
   */
  addPersistentInteraction(
    interaction: AbstractInteraction,
    index = 3,
  ): () => number {
    check(interaction, AbstractInteraction);
    check(index, Number);

    this._interactionChain.addInteraction(interaction, index);
    return () =>
      this._interactionChain.removeInteraction(interaction) !== -1 ? 1 : 0;
  }

  /**
   * Handles an event triggered by
   */
  handleMapEvent(event: MapEvent): void {
    if (event.pointerEvent === PointerEventType.MOVE) {
      this._mouseMove(event);
    } else if (event.pointerEvent === PointerEventType.DOWN) {
      this._mouseDown(event);
    } else if (event.pointerEvent === PointerEventType.UP) {
      this._mouseUp(event);
    }
  }

  private _mouseDown(event: MapEvent): void {
    if (this._lastDown) {
      this._multiples = true;
      return;
    }
    if (event.windowPosition.x === 0 && event.windowPosition.y === 0) {
      return;
    }
    this._lastDown = event;
    this._lastDown.time = Date.now();
  }

  private _mouseUp(event: MapEvent): void {
    if (event.multipleTouch) {
      this._multiples = true;
      this._lastDown = null;
      return;
    }
    if (this._multiples) {
      this._lastDown = null;
      this._multiples = false;
      return;
    }

    const actualEvent: Partial<InteractionEvent> & MapEvent = event;
    if (this._dragging) {
      actualEvent.type = EventType.DRAGEND;
      actualEvent.key = this._dragging.key;
      actualEvent.pointer = this._dragging.pointer;
      this._startChain(actualEvent as InteractionEvent);
    } else if (this._lastDown) {
      if (
        this._lastClick.time &&
        Date.now() - this._lastClick.time < this.clickDuration &&
        Cartesian2.distanceSquared(
          this._lastClick.windowPosition,
          actualEvent.windowPosition,
        ) < 12
      ) {
        this._lastClick.time = null;
        actualEvent.type = EventType.DBLCLICK;
      } else {
        this._lastClick.time = Date.now();
        Cartesian2.clone(
          actualEvent.windowPosition,
          this._lastClick.windowPosition,
        );
        actualEvent.type = EventType.CLICK;
      }
      this._startChain(actualEvent as InteractionEvent);
    }
    this._dragging = null;
    this._lastDown = null;
  }

  private _mouseMove(event: MapEvent): void {
    let actualEvent: Partial<InteractionEvent> & MapEvent = event;
    if (this._lastDown) {
      if (this._dragging) {
        actualEvent.type = EventType.DRAG;
        actualEvent.key = this._dragging.key;
        actualEvent.pointer = this._dragging.pointer;
        this._startChain(actualEvent as InteractionEvent, true);
      } else if (
        !this._dragging &&
        Date.now() - (this._lastDown.time as number) > this.dragDuration
      ) {
        actualEvent = { type: EventType.DRAGSTART, ...this._lastDown };
        this._dragging = actualEvent;
        this._startChain(actualEvent as InteractionEvent, true);
      }
    } else {
      actualEvent.type = EventType.MOVE;
      this._startChain(actualEvent as InteractionEvent, true);
    }
  }

  private _keyListener(event: KeyboardEvent): void {
    if (event.key === 'Shift' || event.key === 'Alt') {
      event.preventDefault();
      event.stopPropagation();
    }

    if (
      this._lastKeyEventModifiers.get(ModificationKeyType.SHIFT) !==
        event.shiftKey ||
      this._lastKeyEventModifiers.get(ModificationKeyType.ALT) !==
        event.altKey ||
      this._lastKeyEventModifiers.get(ModificationKeyType.CTRL) !==
        event.ctrlKey
    ) {
      this._lastKeyEventModifiers.set(
        ModificationKeyType.SHIFT,
        event.shiftKey,
      );
      this._lastKeyEventModifiers.set(ModificationKeyType.ALT, event.altKey);
      this._lastKeyEventModifiers.set(ModificationKeyType.CTRL, event.ctrlKey);
      const modifier =
        [...this._lastKeyEventModifiers.keys()].find((k) =>
          this._lastKeyEventModifiers.get(k),
        ) || ModificationKeyType.NONE;

      if (modifier !== this._lastDispatchedModifier) {
        this._interactionChain.modifierChanged(modifier);
        this._lastDispatchedModifier = modifier;
        this._modifierChanged.raiseEvent(modifier);
      }
    }
  }

  /**
   * @param  event
   * @param  discardOnRunning if true the event will discarded if an eventHandler is already Running
   */
  private _startChain(
    event: InteractionEvent,
    discardOnRunning?: boolean,
  ): void {
    if (this._running && discardOnRunning) {
      return;
    }
    if (this._running) {
      this._eventQueue.push(event);
    } else {
      this._running = true;
      this._interactionChain
        .pipe(event)
        .then(this._endChain.bind(this))
        .catch((error) => {
          getLogger().error((error as Error).message);
          this._endChain();
        });
    }
  }

  private _endChain(): void {
    this._running = false;
    const nextEvent = this._eventQueue.shift();
    if (nextEvent) {
      this._startChain(nextEvent);
    }
  }

  /**
   * Destroys the event handler and its interaction chain.
   */
  destroy(): void {
    this.removeExclusive();
    this.exclusiveAdded.destroy();
    this.exclusiveRemoved.destroy();
    this._interactionChain.destroy();
    this._positionInteraction.destroy();
    this._featureInteraction.destroy();
    this._eventQueue = [];
    window.removeEventListener('keydown', this._boundKeyListener);
    window.removeEventListener('keyup', this._boundKeyListener);
  }
}

export default EventHandler;
