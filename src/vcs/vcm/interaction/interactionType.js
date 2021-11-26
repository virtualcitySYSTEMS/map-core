let nextBit = 1;

/**
 * Provides inforamtion to other interaction plugins for creating bitmasks
 * @class
 * @export
 */
export class BitCounter {
  /**
   * @returns {number}
   */
  static get interactionTypeCounter() { return nextBit; }

  static getNextBit(counter) {
    return counter << 1;
  }
}

/**
 * Enumeration of modification key types
 * @enum {number}
 * @export
 * @property {number} NONE
 * @property {number} ALT
 * @property {number} CTRL
 * @property {number} SHIFT
 * @property {number} ALL
 * @api
 */
export const ModificationKeyType = {
  NONE: nextBit = BitCounter.getNextBit(nextBit),
  ALT: nextBit = BitCounter.getNextBit(nextBit),
  CTRL: nextBit = BitCounter.getNextBit(nextBit),
  SHIFT: nextBit = BitCounter.getNextBit(nextBit),
  ALL: 0,
};

ModificationKeyType.ALL = ModificationKeyType.NONE |
  ModificationKeyType.ALT |
  ModificationKeyType.CTRL |
  ModificationKeyType.SHIFT;

/**
 * Enumeration of pointer event types
 * @enum {number}
 * @property {number} NONE
 * @property {number} CLICK
 * @property {number} DBLCLICK
 * @property {number} DRAG
 * @property {number} DRAGSTART
 * @property {number} DRAGEND
 * @property {number} MOVE
 * @property {number} DRAGEVENTS
 * @property {number} CLICKMOVE
 * @property {number} ALL
 * @export
 * @api
 */
export const EventType = {
  NONE: 0,
  CLICK: nextBit = BitCounter.getNextBit(nextBit),
  DBLCLICK: nextBit = BitCounter.getNextBit(nextBit),
  DRAG: nextBit = BitCounter.getNextBit(nextBit),
  DRAGSTART: nextBit = BitCounter.getNextBit(nextBit),
  DRAGEND: nextBit = BitCounter.getNextBit(nextBit),
  MOVE: nextBit = BitCounter.getNextBit(nextBit),
  DRAGEVENTS: 0,
  CLICKMOVE: 0,
  ALL: 0,
};
EventType.DRAGEVENTS = EventType.DRAG |
  EventType.DRAGEND |
  EventType.DRAGSTART;

EventType.CLICKMOVE = EventType.CLICK |
  EventType.MOVE;

EventType.ALL = Object.values(EventType)
  .reduce((val, mask) => val | mask, 0);

/**
 * Enumeration of pointer keys.
 * @enum {number}
 * @property {number} LEFT
 * @property {number} RIGHT
 * @property {number} MIDDLE
 * @property {number} ALL
 * @export
 * @api
 */
export const PointerKeyType = {
  LEFT: nextBit = BitCounter.getNextBit(nextBit),
  RIGHT: nextBit = BitCounter.getNextBit(nextBit),
  MIDDLE: nextBit = BitCounter.getNextBit(nextBit),
  ALL: 0,
};

PointerKeyType.ALL = PointerKeyType.LEFT |
  PointerKeyType.RIGHT |
  PointerKeyType.MIDDLE;

/**
 * Enumeration of pointer key events.
 * @enum {number}
 * @property {number} DOWN
 * @property {number} UP
 * @property {number} MOVE
 */
export const PointerEventType = {
  DOWN: 1,
  UP: 2,
  MOVE: 3,
};

