import VcsEvent from '../vcsEvent.js';
import Collection from './collection.js';

/**
 * A generic array based collection. Implements the Symbol.iterator (e.g. [...collection])
 */
class IndexedCollection<T> extends Collection<T> {
  static from<F>(
    iterable: Iterable<F>,
    uniqueKey?: keyof F | false,
  ): IndexedCollection<F> {
    const collection: IndexedCollection<F> = new IndexedCollection(uniqueKey);

    if (iterable) {
      for (const i of iterable) {
        collection.add(i);
      }
    }
    return collection;
  }

  /**
   * Event raised if an item is relocated within the collection. Is passed the moved item.
   */
  moved: VcsEvent<T>;

  private _previousIndexSymbol: symbol;

  /**
   * @param  [uniqueKey='name'] - a key to maintain uniquely within the collection. passing false disables uniqueness.
   */
  constructor(uniqueKey?: keyof T | false) {
    super(uniqueKey);

    this.moved = new VcsEvent();

    this._previousIndexSymbol = Symbol('previousIndex');
  }

  /**
   * Get the symbol which is attached to an item prior to its removal. If an item is removed, the current index of the item
   * is set on the item with this symbol.
   */
  get previousIndexSymbol(): symbol {
    return this._previousIndexSymbol;
  }

  /**
   * Returns an item at index.
   * @param  index
   */
  get(index: number): T {
    return this._array[index];
  }

  /**
   * Adds an item to the collection. Can optionally be passed an index at which to insert the item.
   * @param  item - the item to be inserted
   * @param  index - an optional index at which to insert the item. clipped to the last entry
   * @returns  the index at which the item was inserted
   */
  add(item: T, index?: number | null): number | null {
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

  remove(item: T): void {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    item[this._previousIndexSymbol] = this._array.indexOf(item);
    super.remove(item);
  }

  protected _move(item: T, itemIndex: number, targetIndex: number): number {
    let target = targetIndex;
    target = target >= 0 ? target : 0;
    target = target < this._array.length ? target : this._array.length - 1;
    if (itemIndex !== target) {
      this._array.splice(itemIndex, 1);
      this._array.splice(target, 0, item);
      this.moved.raiseEvent(item);
    }
    return target;
  }

  /**
   * Moves an item to a provided index
   * @returns  the new index of the item
   */
  moveTo(item: T, targetIndex: number): number | null {
    const index = this._array.indexOf(item);
    if (index > -1) {
      return this._move(item, index, targetIndex);
    }
    return null;
  }

  /**
   * Lowers an item within the array
   * @param  [steps=1] - an integer number to lower by
   * @returns  the new index of the item
   */
  lower(item: T, steps = 1): number | null {
    const index = this._array.indexOf(item);
    if (index > -1) {
      return this._move(item, index, index - Math.ceil(steps));
    }
    return null;
  }

  /**
   * Raises an item within the array
   * @param  [steps=1] - an integer number to lower by
   * @returns  the new index of the item
   */
  raise(item: T, steps = 1): number | null {
    const index = this._array.indexOf(item);
    if (index > -1) {
      return this._move(item, index, index + Math.ceil(steps));
    }
    return null;
  }

  /**
   * Returns the index of an item or -1 if it is not part of this collection
   */
  indexOf(item: T): number {
    return this._array.indexOf(item);
  }

  /**
   * Returns the index of a key. Returns undefined, if there is no uniqueness constraint
   */
  indexOfKey(value: unknown): number | undefined {
    if (!this.uniqueKey) {
      return undefined;
    }
    return this._array.findIndex((e) => e[this.uniqueKey as keyof T] === value);
  }

  findIndex(predicate: (value: T, index: number, obj: T[]) => boolean): number {
    return this._array.findIndex(predicate);
  }

  destroy(): void {
    super.destroy();
    this.moved.destroy();
  }
}

export default IndexedCollection;
