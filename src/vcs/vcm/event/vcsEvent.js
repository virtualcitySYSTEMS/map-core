/**
 * @class
 * @template {*} T
 * @export
 * @api
 */
class VcsEvent {
  constructor() {
    /**
     * @type {Set<function(T=): Promise<void>|void>}
     * @private
     */
    this._listeners = new Set();
  }

  /**
   * The number of listeners
   * @type {number}
   * @readonly
   * @api
   */
  get numberOfListeners() {
    return this._listeners.size;
  }

  /**
   * Adds an event listener. An event listener can only be added once.
   * A listener added multiple times will only be called once.
   * @param {function(T=): Promise<void>|void} listener
   * @returns {function(): void} - remove callback. call this function to remove the listener
   * @api
   */
  addEventListener(listener) {
    this._listeners.add(listener);
    return () => {
      this.removeEventListener(listener);
    };
  }

  /**
   * Removes the provided listener
   * @param {function(T=): Promise<void>|void} listener
   * @returns {boolean} - whether a listener was removed
   * @api
   */
  removeEventListener(listener) {
    if (this._listeners.has(listener)) {
      this._listeners.delete(listener);
      return true;
    }

    return false;
  }

  /**
   * Raise the event, calling all listeners
   * @param {T=} event
   * @api
   */
  raiseEvent(event) {
    [...this._listeners].forEach((cb) => {
      cb(event);
    });
  }

  /**
   * @param {T=} event
   * @returns {Promise<void>}
   */
  async awaitRaisedEvent(event) {
    const promises = new Array(this._listeners.size);
    let i = 0;
    [...this._listeners].forEach((cb) => {
      promises[i] = cb(event);
      i += 1;
    });
    await Promise.all(promises);
  }

  /**
   * clears all listeners
   * @api
   */
  destroy() {
    this._listeners.clear();
  }
}

export default VcsEvent;
