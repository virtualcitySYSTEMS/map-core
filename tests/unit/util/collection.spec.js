import Collection from '../../../src/util/collection.js';
import { getVcsEventSpy } from '../helpers/cesiumHelpers.js';

describe('Collection', () => {
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
      collection = new Collection();
      expect(collection.size).to.equal(0);
    });

    describe('using from', () => {
      it('should creat a collection from an Array of items', () => {
        collection = Collection.from([{ name: 1 }, { name: 2 }]);
        expect(collection.size).to.equal(2);
      });

      it('should create a collection from an Array of atomics (if non-unique)', () => {
        collection = Collection.from([1, 2, 3], false);
        expect(collection.size).to.equal(3);
      });

      it('should create a collection from a set', () => {
        const set = new Set();
        set.add({ name: 1 });
        set.add({ name: 2 });
        collection = Collection.from(set);
        expect(collection.size).to.equal(2);
      });

      it('should respect the unique key, removing any duplicates, if passed an input iterable', () => {
        collection = Collection.from([
          { name: 1 },
          { name: 2 },
          3,
          { name: 2 },
        ]);
        expect(collection.size).to.equal(2);
      });

      it('should allow the setting of a string unique key', () => {
        collection = Collection.from(
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
        collection = Collection.from(
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
        collection = Collection.from(
          [{ name: 1 }, { name: 2 }, 3, { name: 2 }],
          false,
        );
        expect(collection.size).to.equal(4);
        expect(collection.uniqueKey).to.be.undefined;
      });
    });
  });

  describe('iteration', () => {
    it('should implement Symbol.iterator', () => {
      const array = [{ name: 1 }, { name: 2 }];
      const collection = Collection.from(array);
      expect([...collection]).to.have.members(array);
      collection.destroy();
    });
  });

  describe('getting', () => {
    let collection;
    let array;

    before(() => {
      array = [{ name: 1 }, { name: 2 }];
      collection = Collection.from(array);
    });

    after(() => {
      collection.destroy();
    });

    it('should determine membership', () => {
      expect(collection.has(array[1])).to.be.true;
      expect(collection.has({ name: 1 })).to.be.false;
    });

    describe('by key', () => {
      it('should retrieve an item by its unique key', () => {
        const item = collection.getByKey(2);
        expect(item).to.equal(array[1]);
      });

      it('should return undefined, if the key does not exist in the collection', () => {
        const item = collection.getByKey(3);
        expect(item).to.be.undefined;
      });

      it('should return null, if the colleciton has no unique key', () => {
        const nonUnique = Collection.from(array, false);
        const item = nonUnique.getByKey(2);
        expect(item).to.be.undefined;
        nonUnique.destroy();
      });
    });
  });

  describe('adding', () => {
    let item1;

    before(() => {
      item1 = { name: 1 };
    });

    describe('unique', () => {
      let collection;

      beforeEach(() => {
        collection = new Collection();
      });

      afterEach(() => {
        collection.destroy();
      });

      it('should add an item', () => {
        collection.add(item1);
        expect(collection.size).to.equal(1);
      });

      it('should raise the added event with the item', () => {
        const spy = getVcsEventSpy(collection.added, sandbox);
        collection.add(item1);
        expect(spy).to.have.been.calledOnceWithExactly(item1);
      });

      it('should not add an item with the same key', () => {
        collection.add(item1);
        collection.add({ name: 1 });
        expect(collection.size).to.equal(1);
      });

      it('should not add an item without the unique key', () => {
        collection.add({ noName: 1 });
        collection.add(1);
        collection.add(null);
        collection.add(true);
        expect(collection.size).to.equal(0);
      });

      it('should not raise the added event, if the item was not added', () => {
        const spy = getVcsEventSpy(collection.added, sandbox);
        collection.add({ noName: 1 });
        expect(spy).to.not.have.been.called;
      });
    });

    describe('non-unique', () => {
      let collection;

      beforeEach(() => {
        collection = new Collection(false);
      });

      afterEach(() => {
        collection.destroy();
      });

      it('should add an item', () => {
        collection.add(item1);
        expect(collection.size).to.equal(1);
      });

      it('should raise the added event with the item', () => {
        const spy = getVcsEventSpy(collection.added, sandbox);
        collection.add(item1);
        expect(spy).to.have.been.calledOnceWithExactly(item1);
      });

      it('should allow the adding of an item twice', () => {
        collection.add(item1);
        collection.add(item1);
        expect(collection.size).to.equal(2);
      });

      it('should allow the adding of atomic values', () => {
        collection.add(1);
        collection.add(true);
        expect(collection.size).to.equal(2);
      });

      it('should allow the adding of null values', () => {
        collection.add(null);
        collection.add(undefined);
        expect(collection.size).to.equal(2);
      });
    });
  });

  describe('removing', () => {
    let collection;
    let array;

    beforeEach(() => {
      array = [{ name: 1 }, { name: 2 }];
      collection = Collection.from(array);
    });

    afterEach(() => {
      collection.destroy();
    });

    it('should remove an item', () => {
      collection.remove(array[0]);
      expect(collection.size).to.equal(1);
    });

    it('should raise the removed event with the removed item', () => {
      const spy = getVcsEventSpy(collection.removed, sandbox);
      collection.remove(array[0]);
      expect(spy).to.have.been.calledOnceWithExactly(array[0]);
    });

    it('should not raise the removed event, if nothing was removed', () => {
      const spy = getVcsEventSpy(collection.removed, sandbox);
      collection.remove({ name: 1 });
      expect(spy).to.not.have.been.called;
    });

    it('should allow the clearing of the collection, calling removed for each item', () => {
      const spy = sandbox.spy();
      const listener = collection.removed.addEventListener((item) => {
        expect(array).to.include(item);
        spy();
      });
      collection.clear();
      listener();
      expect(spy).to.have.been.calledTwice;
      expect(collection.size).to.equal(0);
    });
  });
});
