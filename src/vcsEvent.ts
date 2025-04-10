type Listener<T> = (event: T) => Promise<void> | void;

class VcsEvent<T> {
  private _listeners = new Set<Listener<T>>();

  /**
   * The number of listeners
   */
  get numberOfListeners(): number {
    return this._listeners.size;
  }

  /**
   * Adds an event listener. An event listener can only be added once.
   * A listener added multiple times will only be called once.
   * @param  listener
   * @returns  - remove callback. call this function to remove the listener
   */
  addEventListener(listener: Listener<T>): () => void {
    this._listeners.add(listener);
    return () => {
      this.removeEventListener(listener);
    };
  }

  /**
   * Removes the provided listener
   * @param  listener
   * @returns  - whether a listener was removed
   */
  removeEventListener(listener: Listener<T>): boolean {
    if (this._listeners.has(listener)) {
      this._listeners.delete(listener);
      return true;
    }

    return false;
  }

  /**
   * Raise the event, calling all listeners, if a listener is removed in between calling listeners, the listener is not
   * called.
   * @param event
   */
  raiseEvent(event: T): void {
    [...this._listeners].forEach((cb) => {
      if (this._listeners.has(cb)) {
        // eslint-disable-next-line no-void
        void cb(event);
      }
    });
  }

  async awaitRaisedEvent(event: T): Promise<void> {
    const promises: (void | Promise<void>)[] = [];
    [...this._listeners].forEach((cb) => {
      if (this._listeners.has(cb)) {
        promises.push(cb(event));
      }
    });
    await Promise.all(promises);
  }

  /**
   * clears all listeners
   */
  destroy(): void {
    this._listeners.clear();
  }
}

export default VcsEvent;
