/**
 * Enumeration of modification key types
 */
export enum ModificationKeyType {
  NONE = 2,
  ALT = 4,
  CTRL = 8,
  SHIFT = 16,
  ALL = NONE | ALT | CTRL | SHIFT,
}

/**
 * Enumeration of pointer event types
 */
export enum EventType {
  NONE = 0,
  CLICK = 32,
  DBLCLICK = 64,
  DRAG = 128,
  DRAGSTART = 256,
  DRAGEND = 512,
  MOVE = 1024,
  DRAGEVENTS = DRAG | DRAGSTART | DRAGEND,
  CLICKMOVE = CLICK | MOVE,
  ALL = CLICK | DBLCLICK | DRAG | DRAGSTART | DRAGEND | MOVE,
}

/**
 * Enumeration of pointer keys.
 */
export enum PointerKeyType {
  LEFT = 2048,
  RIGHT = 4096,
  MIDDLE = 8192,
  ALL = LEFT | RIGHT | MIDDLE,
}

/**
 * Enumeration of pointer key events.
 */
export enum PointerEventType {
  DOWN = 1,
  UP = 2,
  MOVE = 3,
}
