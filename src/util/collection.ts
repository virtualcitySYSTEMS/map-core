import VcsEvent from '../vcsEvent.js';

/**
 * A generic array based collection. Implements the Symbol.iterator (e.g. [...collection])
 */
class Collection<T> {
  /**
   * Creates a Collection from an iterable, such as an Array.
   * @template  T
   * @param  iterable
   * @param  [uniqueKey='name'] - a key to maintain uniquely within the collection. passing false disables uniqueness.
   */
  static from<F>(
    iterable: Iterable<F>,
    uniqueKey?: keyof F | false,
  ): Collection<F> {
    const collection: Collection<F> = new Collection(uniqueKey);
    if (iterable) {
      for (const i of iterable) {
        collection.add(i);
      }
    }
    return collection;
  }

  protected _array: Array<T>;

  private readonly _uniqueKey: keyof T | undefined;

  /**
   * Event raised if an item is added. Is passed the added item.
   */
  added: VcsEvent<T>;

  /**
   * Event raised if an item is removed. Is passed the removed item.
   */
  removed: VcsEvent<T>;

  /**
   * @param  [uniqueKey='name'] - a key to maintain uniquely within the collection. passing false disables uniqueness.
   */
  constructor(uniqueKey?: keyof T | false) {
    this._array = [];
    this._uniqueKey = 'name' as keyof T;
    if (typeof uniqueKey === 'string' || typeof uniqueKey === 'symbol') {
      this._uniqueKey = uniqueKey;
    } else if (uniqueKey === false) {
      this._uniqueKey = undefined;
    }

    this.added = new VcsEvent();

    this.removed = new VcsEvent();
  }

  *[Symbol.iterator](): Generator<T> {
    const arrayLength = this._array.length;
    for (let i = 0; i < arrayLength; i++) {
      yield this._array[i];
    }
  }

  /**
   * The key by which to check uniqueness against. undefined if no uniqueness constraint is set.
   */
  get uniqueKey(): keyof T | undefined {
    return this._uniqueKey;
  }

  get size(): number {
    return this._array.length;
  }

  /**
   * Returns an item identified by the unique constraint key. Returns null, if there is no uniqueness constraint.
   * @param  value - the value to test against. does a shallow comparison, if the passed a non-atomic value
   */
  getByKey(value: unknown): T | undefined {
    if (!this._uniqueKey) {
      return undefined;
    }
    return this._array.find((e) => e[this._uniqueKey as keyof T] === value);
  }

  protected _checkUniqueness(item: T): boolean {
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
   * @param  item - the item to be inserted
   * @returns  the index at which the item was inserted
   */
  add(item: T): number | null {
    if (this._checkUniqueness(item)) {
      this._array.push(item);
      this.added.raiseEvent(item);
      return this._array.length - 1;
    }
    return null;
  }

  /**
   * internal remove function, to remove an item from the collection, does not raise an event.
   * @param  item
   * @returns  returns the index of the removed item or -1 if the item has not been found.
   * @protected
   */
  protected _remove(item: T): number {
    const index = this._array.indexOf(item);
    if (index > -1) {
      this._array.splice(index, 1);
    }
    return index;
  }

  /**
   * Removes an item from the collection
   * @param  item
   */
  remove(item: T): void {
    const index = this._remove(item);
    if (index > -1) {
      this.removed.raiseEvent(item);
    }
  }

  /**
   * Equivalent to Array.prototype.includes
   * @param  item
   */
  has(item: T): boolean {
    return this._array.includes(item);
  }

  /**
   * Returns true, if the key exists. Returns undefined, if there is no uniqueness constraint.
   * @param  value
   */
  hasKey(value: unknown): boolean | undefined {
    if (!this._uniqueKey) {
      return undefined;
    }
    return this._array.some((e) => e[this._uniqueKey as keyof T] === value);
  }

  /**
   * clears the array
   */
  clear(): void {
    this._array.forEach((i) => {
      this.removed.raiseEvent(i);
    });
    this._array.splice(0);
  }

  /**
   * Destroys the collection, clearing the array and all its events
   */
  destroy(): void {
    this._array = [];
    this.added.destroy();
    this.removed.destroy();
  }
}

export default Collection;
