import { v4 as uuidv4 } from 'uuid';
import { Cartesian2 } from '@vcmap/cesium';

import { check, checkMaybe } from '@vcsuite/check';
import { getLogger as getLoggerByName } from '@vcsuite/logger';
import AbstractInteraction from './abstractInteraction.js';
import InteractionChain from './interactionChain.js';
import CoordinateAtPixel from './coordinateAtPixel.js';
import FeatureAtPixelInteraction from './featureAtPixelInteraction.js';
import { EventType, PointerEventType } from './interactionType.js';
import FeatureProviderInteraction from './featureProviderInteraction.js';
import VcsEvent from '../vcsEvent.js';

/**
 * @namespace interaction
 * @api
 */

/**
 * @typedef {Object} EventHandlerExclusiveInteraction
 * @property {string} id
 * @property {Array<AbstractInteraction>} interactions
 * @property {Array<Function>} cb
 */

/**
 * @typedef {Object} MapEvent
 * @property {PointerEventType} pointerEvent
 * @property {import("@vcmap/core").VcsMap} map
 * @property {import("@vcmap/cesium").Cartesian2} windowPosition
 * @property {import("@vcmap/core").ModificationKeyType} key
 * @property {import("@vcmap/core").PointerKeyType} pointer
 * @property {import("ol/coordinate").Coordinate|undefined} position - position in web mercator coordinates
 * @property {import("ol/coordinate").Coordinate|undefined} positionOrPixel - position in web mercator coordinates or image coordinates in ObliqueMap Map Mode
 * @property {boolean|undefined} multipleTouch - vcs:undocumented
 * @property {number|null|undefined} time - vcs:undocumented
 */

/**
 * @typedef {Object} LastClick
 * @property {import("@vcmap/cesium").Cartesian2} windowPosition - vcs:undocumented
 * @property {number|null} time - vcs:undocumented
 * @api
 */

/**
 * @returns {import("@vcsuite/logger").Logger}
 */
function getLogger() {
  return getLoggerByName('EventHandler');
}

/**
 * @class
 */
class EventHandler {
  constructor() {
    /**
     * @type {CoordinateAtPixel}
     * @private
     */
    this._positionInteraction = new CoordinateAtPixel();
    /**
     * @type {FeatureAtPixelInteraction}
     * @private
     */
    this._featureInteraction = new FeatureAtPixelInteraction();
    /**
     * @type {FeatureProviderInteraction}
     * @private
     */
    this._featureProviderInteraction = new FeatureProviderInteraction();
    /**
     * @type {InteractionChain}
     * @private
     */
    this._interactionChain = new InteractionChain([
      this._positionInteraction,
      this._featureInteraction,
      this._featureProviderInteraction,
    ]);

    /**
     * @type {number}
     */
    this.clickDuration = 400;

    /**
     * @type {number}
     */
    this.dragDuration = 100;

    /**
     * @type {null|MapEvent}
     * @private
     */
    this._lastDown = null;

    /**
     * @type {LastClick}
     * @private
     */
    this._lastClick = {
      time: null,
      windowPosition: new Cartesian2(),
    };

    /**
     * @type {null|MapEvent}
     * @private
     */
    this._dragging = null;

    /**
     * @type {boolean}
     * @private
     */
    this._running = false;

    /**
     * @type {Array<InteractionEvent>}
     * @private
     */
    this._eventQueue = [];

    /**
     * @type {EventHandlerExclusiveInteraction|null}
     * @private
     */
    this._exclusiveInteraction = null;

    /**
     * @type {boolean}
     * @private
     */
    this._multiples = false;
    /**
     * Event called, when exclusive events are removed
     * @type {VcsEvent<void>}
     * @api
     */
    this.exclusiveRemoved = new VcsEvent();
    /**
     * Event called, when exclusive events are added
     * @type {VcsEvent<void>}
     * @api
     */
    this.exclusiveAdded = new VcsEvent();
  }

  /**
   * @type {CoordinateAtPixel}
   * @readonly
   * @api
   */
  get positionInteraction() { return this._positionInteraction; }

  /**
   * @type {FeatureAtPixelInteraction}
   * @readonly
   * @api
   */
  get featureInteraction() { return this._featureInteraction; }

  /**
   * @api
   * @readonly
   * @type {FeatureProviderInteraction}
   */
  get featureProviderInteraction() { return this._featureProviderInteraction; }

  /**
   * A copy of all the EventHandler interactions
   * @readonly
   * @type {AbstractInteraction[]}
   * @api
   */
  get interactions() { return this._interactionChain.chain.slice(); }

  /**
   * Add a dynamic interaction to the interaction chain. This is the default methodology for
   * user map interactions, such as drawing or measuring. If another exclusive interaction is added,
   * this interaction is removed and a provided callback is called. Use the id parameter to add multiple interactions
   * from the same source (if you don't wish to provide an {@link InteractionChain}
   * @param {AbstractInteraction} interaction
   * @param {Function} removed - the callback for when the interaction is forcefully removed.
   * @param {number=} [index=3] - the position at which to push the interaction
   * @param {string=} id - an id to allow for multiple interactions to belong to the same exclusive registerer
   * @returns {Function} function to remove the interaction with. returns number of removed interactions (0|1)
   * @api
   */
  addExclusiveInteraction(interaction, removed, index = 3, id) {
    check(interaction, AbstractInteraction);
    check(removed, Function);
    check(index, Number);
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
    return this._exclusiveUnListen.bind(this, interaction, this._exclusiveInteraction.id);
  }

  /**
   * Removes any exclusive listeners. Typically only called from the framework to ensure the pubsub listeners are consistent
   * @api
   */
  removeExclusive() {
    if (this._exclusiveInteraction) {
      this._exclusiveInteraction.interactions
        .filter(i => i)
        .forEach((i) => {
          this._interactionChain.removeInteraction(i);
        });
      this._exclusiveInteraction.cb
        .filter(cb => cb)
        .forEach((cb) => {
          cb();
        });
      this._exclusiveInteraction = null;
      this.exclusiveRemoved.raiseEvent();
    }
  }

  /**
   * Removes an exclusive interaction by its id
   * @param {AbstractInteraction} interaction
   * @param {string} id
   * @returns {number}
   * @private
   */
  _exclusiveUnListen(interaction, id) {
    if (!this._exclusiveInteraction || (this._exclusiveInteraction && this._exclusiveInteraction.id !== id)) {
      return 0;
    }
    const removed = this._interactionChain.removeInteraction(interaction);
    const index = this._exclusiveInteraction.interactions
      .findIndex(candidate => candidate && candidate.id === interaction.id);
    if (index > -1) {
      this._exclusiveInteraction.interactions.splice(index, 1, undefined);
      this._exclusiveInteraction.cb.splice(index, 1, undefined);
    }
    if (this._exclusiveInteraction.interactions.every(i => i === undefined)) {
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
   * @param {AbstractInteraction} interaction
   * @param {number=} [index=3] - at what position this interaction should be added. By default, it is added after the featureProviderInteraction
   * @returns {function():number} function to remove the interaction with. returns number of removed interactions (0|1)
   * @api
   */
  addPersistentInteraction(interaction, index = 3) {
    check(interaction, AbstractInteraction);
    check(index, Number);

    this._interactionChain.addInteraction(interaction, index);
    return () => (this._interactionChain.removeInteraction(interaction) !== -1 ? 1 : 0);
  }

  /**
   * Handles an event triggered by {@link import("@vcmap/core").VcsMap.pointerInteractionEvent}
   * @param {MapEvent} event
   * @api
   */
  handleMapEvent(event) {
    if (event.pointerEvent === PointerEventType.MOVE) {
      this._mouseMove(event);
    } else if (event.pointerEvent === PointerEventType.DOWN) {
      this._mouseDown(event);
    } else if (event.pointerEvent === PointerEventType.UP) {
      this._mouseUp(event);
    }
  }

  /**
   * @param {MapEvent} event
   * @private
   */
  _mouseDown(event) {
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

  /**
   * @param {MapEvent} event
   * @private
   */
  _mouseUp(event) {
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

    const actualEvent = /** @type {InteractionEvent} */ (event);
    if (this._dragging) {
      actualEvent.type = EventType.DRAGEND;
      actualEvent.key = this._dragging.key;
      actualEvent.pointer = this._dragging.pointer;
      this._startChain(actualEvent);
    } else if (this._lastDown) {
      if (
        this._lastClick.time &&
        Date.now() - this._lastClick.time < this.clickDuration &&
        Cartesian2.distanceSquared(this._lastClick.windowPosition, actualEvent.windowPosition) < 12
      ) {
        this._lastClick.time = null;
        actualEvent.type = EventType.DBLCLICK;
      } else {
        this._lastClick.time = Date.now();
        Cartesian2.clone(actualEvent.windowPosition, this._lastClick.windowPosition);
        actualEvent.type = EventType.CLICK;
      }
      this._startChain(actualEvent);
    }
    this._dragging = null;
    this._lastDown = null;
  }

  /**
   * @param {MapEvent} event
   * @private
   */
  _mouseMove(event) {
    let actualEvent = /** @type {InteractionEvent} */ (event);
    if (this._lastDown) {
      if (this._dragging) {
        actualEvent.type = EventType.DRAG;
        actualEvent.key = this._dragging.key;
        actualEvent.pointer = this._dragging.pointer;
        this._startChain(actualEvent, true);
      } else if (!this._dragging && Date.now() - this._lastDown.time > this.dragDuration) {
        actualEvent = { type: EventType.DRAGSTART, ...this._lastDown };
        this._dragging = actualEvent;
        this._startChain(actualEvent, true);
      }
    } else {
      actualEvent.type = EventType.MOVE;
      this._startChain(actualEvent, true);
    }
  }

  /**
   * @param {InteractionEvent} event
   * @param {boolean=} discardOnRunning if true the event will discarded if an eventHandler is already Running
   * @private
   */
  _startChain(event, discardOnRunning) {
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
          getLogger().error(error.message);
          this._endChain();
        });
    }
  }

  /**
   * @private
   */
  _endChain() {
    this._running = false;
    if (this._eventQueue.length > 0) {
      this._startChain(this._eventQueue.shift());
    }
  }

  /**
   * Destroys the event handler and its interaction chain.
   */
  destroy() {
    this.removeExclusive();
    this.exclusiveAdded.destroy();
    this.exclusiveRemoved.destroy();
    this._interactionChain.destroy();
    this._interactionChain = null;
    this._positionInteraction.destroy();
    this._positionInteraction = null;
    this._featureInteraction.destroy();
    this._featureInteraction = null;
    this._eventQueue = [];
  }
}

export default EventHandler;
