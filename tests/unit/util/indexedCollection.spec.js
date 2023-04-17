import IndexedCollection from '../../../src/util/indexedCollection.js';

describe('IndexedCollection', () => {
  let sandbox;
  before(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('construction', () => {
    let collection;

    afterEach(() => {
      collection.destroy();
    });

    it('should create an empty collection', () => {
      collection = new IndexedCollection();
      expect(collection.size).to.equal(0);
    });

    describe('using from', () => {
      it('should creat a collection from an Array of items', () => {
        collection = IndexedCollection.from([{ name: 1 }, { name: 2 }]);
        expect(collection.size).to.equal(2);
      });

      it('should maintain the order of an Array', () => {
        const array = [{ name: 1 }, { name: 2 }];
        collection = IndexedCollection.from(array);
        array.forEach((item, index) => {
          expect(collection.indexOf(item)).to.equal(index);
        });
      });

      it('should create a collection from an Array of atomics (if non-unique)', () => {
        collection = IndexedCollection.from([1, 2, 3], false);
        expect(collection.size).to.equal(3);
      });

      it('should create a collection from a set', () => {
        const set = new Set();
        set.add({ name: 1 });
        set.add({ name: 2 });
        collection = IndexedCollection.from(set);
        expect(collection.size).to.equal(2);
      });

      it('should respect the unique key, removing any duplicates, if passed an input iterable', () => {
        collection = IndexedCollection.from([
          { name: 1 },
          { name: 2 },
          3,
          { name: 2 },
        ]);
        expect(collection.size).to.equal(2);
      });

      it('should allow the setting of a string unique key', () => {
        collection = IndexedCollection.from(
          [
            { name: 1, id: 1 },
            { name: 2, id: 2 },
            { name: 2, id: 3 },
          ],
          'id',
        );
        expect(collection.size).to.equal(3);
        expect(collection.uniqueKey).to.equal('id');
      });

      it('should allow a symbol as a unique key', () => {
        const id = Symbol('id');
        collection = IndexedCollection.from(
          [
            { name: 1, [id]: 1 },
            { name: 2, [id]: 2 },
            { name: 2, [id]: 3 },
          ],
          id,
        );
        expect(collection.size).to.equal(3);
        expect(collection.uniqueKey).to.equal(id);
      });

      it('should allow the ignoring of a unique key', () => {
        collection = IndexedCollection.from(
          [{ name: 1 }, { name: 2 }, 3, { name: 2 }],
          false,
        );
        expect(collection.size).to.equal(4);
        expect(collection.uniqueKey).to.be.undefined;
      });
    });
  });

  describe('getting', () => {
    let collection;
    let array;

    before(() => {
      array = [{ name: 1 }, { name: 2 }];
      collection = IndexedCollection.from(array);
    });

    after(() => {
      collection.destroy();
    });

    it('should retrieve an item by index', () => {
      const item = collection.get(1);
      expect(item).to.equal(array[1]);
    });

    it('should retrieve the index of an item', () => {
      const index = collection.indexOf(array[1]);
      expect(index).to.equal(1);
    });
  });

  describe('adding', () => {
    let item1;

    before(() => {
      item1 = { name: 1 };
    });

    describe('index determination', () => {
      let collection;
      let item2;
      let item3;

      before(() => {
        item2 = { name: 2 };
        item3 = { name: 3 };
      });

      beforeEach(() => {
        collection = IndexedCollection.from([item1, item2]);
      });

      afterEach(() => {
        collection.destroy();
      });

      it('should add an item to the end of the collection by default', () => {
        const index = collection.add(item3);
        expect(index).to.equal(2);
        expect(collection.indexOf(item3)).to.equal(index);
      });

      it('should add an item at a given index', () => {
        const index = collection.add(item3, 1);
        expect(index).to.equal(1);
        expect(collection.indexOf(item3)).to.equal(index);
      });

      it('should add to the front of the collection, if the index is less then 0', () => {
        const index = collection.add(item3, -1);
        expect(index).to.equal(0);
        expect(collection.indexOf(item3)).to.equal(index);
      });

      it('should add to the end of the collection, if the index is larger then the collection', () => {
        const index = collection.add(item3, 4);
        expect(index).to.equal(2);
        expect(collection.indexOf(item3)).to.equal(index);
      });

      it('should return null, if the item was not added', () => {
        const index = collection.add(null);
        expect(index).to.be.null;
      });
    });
  });

  describe('removing', () => {
    it('should set the previous index symbol on a removed item', () => {
      const item = { name: 'bar' };
      const collection = IndexedCollection.from([
        { name: 'foo' },
        item,
        { name: 'baz' },
      ]);
      const currentIndex = collection.indexOf(item);
      collection.remove(item);
      expect(item).to.have.property(
        collection.previousIndexSymbol,
        currentIndex,
      );
    });
  });

  describe('index manipulation', () => {
    let collection;
    let array;

    before(() => {
      array = [...new Array(5).keys()].map((name) => ({ name }));
    });

    beforeEach(() => {
      collection = IndexedCollection.from(array);
    });

    afterEach(() => {
      collection.destroy();
    });

    it('should raise an item by one', () => {
      const index = collection.raise(array[2]);
      expect(index).to.equal(3);
      expect(collection.indexOf(array[2])).to.equal(index);
    });

    it('should lower an item by one', () => {
      const index = collection.lower(array[2]);
      expect(index).to.equal(1);
      expect(collection.indexOf(array[2])).to.equal(index);
    });

    it('should raise an item by n steps', () => {
      const index = collection.raise(array[0], 3);
      expect(index).to.equal(3);
      expect(collection.indexOf(array[0])).to.equal(index);
    });

    it('should lower an item by n steps', () => {
      const index = collection.lower(array[3], 3);
      expect(index).to.equal(0);
      expect(collection.indexOf(array[3])).to.equal(index);
    });

    it('should lower if raised by -n steps', () => {
      const index = collection.raise(array[3], -3);
      expect(index).to.equal(0);
      expect(collection.indexOf(array[3])).to.equal(index);
    });

    it('should raise if lowered by -n steps', () => {
      const index = collection.lower(array[0], -3);
      expect(index).to.equal(3);
      expect(collection.indexOf(array[0])).to.equal(index);
    });

    it('should not raise past the end of the collection', () => {
      const index = collection.raise(array[3], 3);
      expect(index).to.equal(4);
      expect(collection.indexOf(array[3])).to.equal(index);
    });

    it('should not lower past the start of the collection', () => {
      const index = collection.lower(array[1], 3);
      expect(index).to.equal(0);
      expect(collection.indexOf(array[1])).to.equal(index);
    });

    it('should move item to target index', () => {
      const index = collection.moveTo(array[0], 3);
      expect(index).to.equal(3);
      expect([...collection]).to.have.ordered.deep.members([
        { name: 1 },
        { name: 2 },
        { name: 3 },
        { name: 0 },
        { name: 4 },
      ]);
    });

    it('should return null, if item is not part of the collection', () => {
      const moved = sinon.spy();
      collection.moved.addEventListener(moved);
      const index = collection.moveTo({ name: 'x' }, 3);
      expect(index).to.be.null;
      expect(moved).to.not.have.been.called;
    });

    it('should clip target index to array length', () => {
      const index = collection.moveTo(array[0], 10 * array.length);
      expect(index).to.equal(array.length - 1);
      expect([...collection]).to.have.ordered.deep.members([
        { name: 1 },
        { name: 2 },
        { name: 3 },
        { name: 4 },
        { name: 0 },
      ]);
    });

    it('should clip negative target indices to zero', () => {
      const index = collection.moveTo(array[2], -2);
      expect(index).to.equal(0);
      expect(collection.indexOf(array[2])).to.equal(index);
    });

    it('should not raise a moved event, if moving to the same index', () => {
      const moved = sinon.spy();
      collection.moved.addEventListener(moved);
      const index = collection.moveTo(array[0], 0);
      expect(collection.indexOf(array[0])).to.equal(index);
      expect(moved).to.not.have.been.called;
    });

    it('should not raise a moved event, if clipped index equals target index', () => {
      const moved = sinon.spy();
      collection.moved.addEventListener(moved);
      const index = collection.moveTo(
        array[array.length - 1],
        10 * array.length,
      );
      expect(index).to.equal(array.length - 1);
      expect(moved).to.not.have.been.called;
    });

    it('should return null, if the item is not part of the collection', () => {
      const raiseIndex = collection.raise({ name: 1 }, 3);
      const lowerIndex = collection.lower({ name: 1 }, 3);
      expect(raiseIndex).to.be.null;
      expect(lowerIndex).to.be.null;
    });
  });
});
