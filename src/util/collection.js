import VcsEvent from '../vcsEvent.js';

/**
 * A generic array based collection. Implements the Symbol.iterator (e.g. [...collection])
 * @class
 * @export
 * @template {*} T
 * @api
 */
class Collection {
  /**
   * Creates a Collection from an iterable, such as an Array.
   * @template {*} T
   * @param {Iterable<T>} iterable
   * @param {(string|symbol|boolean)=} [uniqueKey='name'] - a key to maintain uniquely within the collection. passing false disables uniqueness.
   * @returns {Collection<T>}
   * @api
   */
  static from(iterable, uniqueKey) {
    const collection = /** @type {Collection<T>} */ (new Collection(uniqueKey));
    if (iterable) {
      // eslint-disable-next-line no-restricted-syntax
      for (const i of iterable) {
        collection.add(i);
      }
    }
    return collection;
  }

  /**
   * @param {(string|symbol|boolean)=} [uniqueKey='name'] - a key to maintain uniquely within the collection. passing false disables uniqueness.
   */
  constructor(uniqueKey) {
    /**
     * @protected
     * @type {Array<T>}
     */
    this._array = [];

    /**
     * @type {string|symbol}
     * @private
     */
    this._uniqueKey = 'name';
    if (typeof uniqueKey === 'string' || typeof uniqueKey === 'symbol') {
      this._uniqueKey = uniqueKey;
    } else if (uniqueKey === false) {
      this._uniqueKey = undefined;
    }

    /**
     * Event raised if an item is added. Is passed the added item.
     * @type {VcsEvent<T>}
     * @api
     */
    this.added = new VcsEvent();

    /**
     * Event raised if an item is removed. Is passed the removed item.
     * @type {VcsEvent<T>}
     * @api
     */
    this.removed = new VcsEvent();
  }

  * [Symbol.iterator]() {
    const arrayLength = this._array.length;
    for (let i = 0; i < arrayLength; i++) {
      yield this._array[i];
    }
  }

  /**
   * The key by which to check uniqueness against. undefined if no uniqueness constraint is set.
   * @readonly
   * @type {string|symbol}
   * @api
   */
  get uniqueKey() { return this._uniqueKey; }

  /**
   * @readonly
   * @type {number}
   * @api
   */
  get size() { return this._array.length; }

  /**
   * Returns an item identified by the unique constraint key. Returns null, if there is no uniqueness constraint.
   * @param {*} value - the value to test against. does a shallow comparison, if the passed a non-atomic value
   * @returns {T|undefined}
   * @api
   */
  getByKey(value) {
    if (!this._uniqueKey) {
      return undefined;
    }
    return this._array.find(e => e[this._uniqueKey] === value);
  }

  /**
   * @param {T} item
   * @returns {boolean}
   * @protected
   */
  _checkUniqueness(item) {
    if (this._uniqueKey) {
      if (item == null || typeof item !== 'object') {
        return false;
      }
      const value = item[this._uniqueKey];
      if (value == null) {
        return false;
      }
      const found = this.getByKey(value);
      if (found != null) {
        return false;
      }
    }
    return true;
  }

  /**
   * Adds an item to the collection.
   * @param {T} item - the item to be inserted
   * @returns {number|null} the index at which the item was inserted
   * @api
   */
  add(item) {
    if (this._checkUniqueness(item)) {
      this._array.push(item);
      this.added.raiseEvent(item);
      return this._array.length - 1;
    }
    return null;
  }

  /**
   * Removes an item from the collection
   * @param {T} item
   * @api
   */
  remove(item) {
    const index = this._array.indexOf(item);
    if (index > -1) {
      this._array.splice(index, 1);
      this.removed.raiseEvent(item);
    }
  }

  /**
   * Equivalent to Array.prototype.includes
   * @param {T} item
   * @returns {boolean}
   * @api
   */
  has(item) {
    return this._array.includes(item);
  }

  /**
   * Returns true, if the key exists. Returns undefined, if there is no uniqueness constraint.
   * @param {*} value
   * @returns {boolean}
   * @api
   */
  hasKey(value) {
    if (!this._uniqueKey) {
      return undefined;
    }
    return this._array.some(e => e[this._uniqueKey] === value);
  }

  /**
   * clears the array
   * @api
   */
  clear() {
    this._array.forEach((i) => { this.removed.raiseEvent(i); });
    this._array.splice(0);
  }

  /**
   * Destroys the collection, clearing the array and all its events
   */
  destroy() {
    this._array = [];
    this.added.destroy();
    this.removed.destroy();
  }
}

export default Collection;
