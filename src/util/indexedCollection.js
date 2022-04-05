import VcsEvent from '../vcsEvent.js';
import Collection from './collection.js';

/**
 * A generic array based collection. Implements the Symbol.iterator (e.g. [...collection])
 * @class
 * @export
 * @template {*} T
 * @extends {Collection<T>}
 * @api
 */
class IndexedCollection extends Collection {
  /**
   * Creates a Collection from an iterable, such as an Array.
   * @template {*} T
   * @param {Iterable<T>} iterable
   * @param {(string|symbol|boolean)=} [uniqueKey='name'] - a key to maintain uniquely within the collection. passing false disables uniqueness.
   * @returns {IndexedCollection<T>}
   * @override
   * @api
   */
  static from(iterable, uniqueKey) {
    const collection = /** @type {IndexedCollection<T>} */ (new IndexedCollection(uniqueKey));
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
    super(uniqueKey);

    /**
     * Event raised if an item is relocated within the collection. Is passed the moved item.
     * @type {VcsEvent<T>}
     * @api
     */
    this.moved = new VcsEvent();

    /**
     * @type {symbol}
     * @private
     */
    this._previousIndexSymbol = Symbol('previousIndex');
  }

  /**
   * Get the symbol which is attached to an item prior to its removal. If an item is removed, the current index of the item
   * is set on the item with this symbol.
   * @type {symbol}
   * @readonly
   */
  get previousIndexSymbol() { return this._previousIndexSymbol; }

  /**
   * Returns an item at index.
   * @param {number} index
   * @returns {T}
   * @api
   */
  get(index) {
    return this._array[index];
  }

  /**
   * Adds an item to the collection. Can optionally be passed an index at which to insert the item.
   * @param {T} item - the item to be inserted
   * @param {number=} index - an optional index at which to insert the item. clipped to the last entry
   * @returns {number|null} the index at which the item was inserted
   * @api
   */
  add(item, index) {
    if (this._checkUniqueness(item)) {
      let actualIndex = this._array.length;
      if (index != null && index < this._array.length) {
        actualIndex = index >= 0 ? index : 0;
        this._array.splice(actualIndex, 0, item);
      } else {
        this._array.push(item);
      }
      this.added.raiseEvent(item);
      return actualIndex;
    }
    return null;
  }

  /**
   * @inheritDoc
   * @param {T} item
   */
  remove(item) {
    item[this._previousIndexSymbol] = this._array.indexOf(item);
    super.remove(item);
  }

  /**
   * @param {T} item
   * @param {number} itemIndex
   * @param {number} targetIndex
   * @returns {number}
   * @protected
   */
  _move(item, itemIndex, targetIndex) {
    let target = targetIndex;
    target = target >= 0 ? target : 0;
    target = target < this._array.length ? target : this._array.length - 1;
    this._array.splice(itemIndex, 1);
    this._array.splice(target, 0, item);
    this.moved.raiseEvent(item);
    return target;
  }

  /**
   * Lowers an item within the array
   * @param {T} item
   * @param {number} [steps=1] - an integer number to lower by
   * @returns {number|null} the new index of the item
   * @api
   */
  lower(item, steps = 1) {
    const index = this._array.indexOf(item);
    if (index > -1) {
      return this._move(item, index, index - Math.ceil(steps));
    }
    return null;
  }

  /**
   * Raises an item within the array
   * @param {T} item
   * @param {number} [steps=1] - an integer number to lower by
   * @returns {number|null} the new index of the item
   * @api
   */
  raise(item, steps = 1) {
    const index = this._array.indexOf(item);
    if (index > -1) {
      return this._move(item, index, index + Math.ceil(steps));
    }
    return null;
  }

  /**
   * Returns the index of an item or -1 if it is not part of this collection
   * @param {T} item
   * @returns {number}
   * @api
   */
  indexOf(item) {
    return this._array.indexOf(item);
  }

  /**
   * Returns the index of a key. Returns undefined, if there is no uniqueness constraint
   * @param {*} value
   * @returns {number}
   * @api
   */
  indexOfKey(value) {
    if (!this.uniqueKey) {
      return undefined;
    }
    return this._array.findIndex(e => e[this.uniqueKey] === value);
  }

  /**
   * @inheritDoc
   */
  destroy() {
    super.destroy();
    this.moved.destroy();
  }
}

export default IndexedCollection;
