import makeOverrideCollection from '../../../src/util/overrideCollection.js';
import Collection from '../../../src/util/collection.js';
import IndexedCollection from '../../../src/util/indexedCollection.js';
import VcsObject from '../../../src/vcsObject.js';
import Layer from '../../../src/layer/layer.js';
import { contextIdSymbol, destroyCollection, getObjectFromOptions } from '../../../src/vcsAppContextHelpers.js';


describe('override collections', () => {
  let getContextId;

  before(() => {
    getContextId = () => 'dynamicContextId';
  });

  describe('making an override collection', () => {
    it('should make an override collecition out of a collection', () => {
      const collection = makeOverrideCollection(new Collection(), getContextId);
      expect(collection).to.have.property('override');
      expect(collection).to.have.property('replaced');
      expect(collection).to.have.property('shadowMap');
      expect(collection).to.have.property('parseItems');
      expect(collection).to.have.property('removeContext');
    });

    it('should throw an error, when trying to make a colleciton an override collection twice', () => {
      const collection = makeOverrideCollection(new Collection(), getContextId);
      expect(() => makeOverrideCollection(collection, getContextId)).to.throw;
    });
  });

  describe('overriding an object of a collection', () => {
    describe('if no object with said name exists', () => {
      let item;
      let returnedItem;
      let collection;
      let replaced = false;

      before(() => {
        collection = makeOverrideCollection(new Collection(), getContextId);
        collection.replaced.addEventListener(() => {
          replaced = true;
        });

        item = new VcsObject({ name: 'foo' });
        item[contextIdSymbol] = 'foo';
        returnedItem = collection.override(item);
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should return the item', () => {
        expect(returnedItem).to.equal(item);
      });

      it('should add the object to the collection', () => {
        expect(collection.has(item)).to.be.true;
      });

      it('should not call replaced', () => {
        expect(replaced).to.be.false;
      });
    });

    describe('if the object does not have a contextId', () => {
      let item;
      let returnedItem;
      let collection;

      before(() => {
        collection = makeOverrideCollection(new Collection(), getContextId);
        item = new VcsObject({ name: 'foo' });
        returnedItem = collection.override(item);
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should return the item', () => {
        expect(returnedItem).to.equal(item);
      });

      it('should add the object to the collection', () => {
        expect(collection.has(item)).to.be.true;
      });

      it('should add the contextId to the item', () => {
        expect(item).to.have.property(contextIdSymbol, getContextId());
      });
    });

    describe('if an object with said name exists', () => {
      let item;
      let collection;
      let replacedItemName = null;
      let returnedItem;

      before(() => {
        collection = makeOverrideCollection(new Collection(), getContextId, null, option => new VcsObject(option));
        collection.replaced.addEventListener((i) => {
          replacedItemName = i.name;
        });

        const existingItem = new VcsObject({ name: 'foo' });
        existingItem[contextIdSymbol] = 'foo';
        collection.add(existingItem);

        item = new VcsObject({ name: 'foo' });
        item[contextIdSymbol] = 'bar';
        returnedItem = collection.override(item);
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should add the object to the collection', () => {
        expect(collection.has(item)).to.be.true;
      });

      it('should return the item', () => {
        expect(returnedItem).to.equal(item);
      });

      it('should add a shadow of the object', () => {
        expect(collection.shadowMap.has('foo')).to.be.true;
        const fooShadowMap = collection.shadowMap.get('foo');
        expect(fooShadowMap).to.be.an('array')
          .and.to.have.lengthOf(1);
        expect(fooShadowMap[0]).to.have.property('name', 'foo');
        expect(fooShadowMap[0]).to.have.property(contextIdSymbol, 'foo');
      });

      it('should call the replaced event with the replacement object', () => {
        expect(replacedItemName).to.equal('foo');
      });
    });

    describe('if several object with said name have been added to the collection', () => {
      let item;
      let collection;

      before(() => {
        collection = makeOverrideCollection(new Collection(), getContextId, null, option => new VcsObject(option));
        const existingItem1 = new VcsObject({ name: 'foo' });
        existingItem1[contextIdSymbol] = 'foo';
        collection.add(existingItem1);

        const existingItem2 = new VcsObject({ name: 'foo' });
        existingItem2[contextIdSymbol] = 'bar';
        collection.override(existingItem2);

        item = new VcsObject({ name: 'foo' });
        item[contextIdSymbol] = 'baz';
        collection.override(item);
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should add the object to the collection', () => {
        expect(collection.has(item)).to.be.true;
      });

      it('should add a shadow of the object', () => {
        expect(collection.shadowMap.has('foo')).to.be.true;
        const fooShadowMap = collection.shadowMap.get('foo');
        expect(fooShadowMap).to.be.an('array')
          .and.to.have.lengthOf(2);
        expect(fooShadowMap[0]).to.have.property('name', 'foo');
        expect(fooShadowMap[0]).to.have.property(contextIdSymbol, 'foo');

        expect(fooShadowMap[1]).to.have.property('name', 'foo');
        expect(fooShadowMap[1]).to.have.property(contextIdSymbol, 'bar');
      });
    });

    describe('if the collection is an indexed collection', () => {
      let item;
      let collection;
      let replacedItemName = null;
      let returnedItem;
      let currentIndex;

      before(() => {
        collection = makeOverrideCollection(
          new IndexedCollection(),
          getContextId,
          null,
          option => new VcsObject(option),
        );
        collection.replaced.addEventListener((i) => {
          replacedItemName = i.name;
        });

        const placeHolderBefore = new VcsObject({ name: 'placeHolderBefore' });
        placeHolderBefore[contextIdSymbol] = 'foo';
        collection.add(placeHolderBefore);

        const existingItem = new VcsObject({ name: 'foo' });
        existingItem[contextIdSymbol] = 'foo';
        collection.add(existingItem);

        const placeHolderAfter = new VcsObject({ name: 'placeHolderAfter' });
        placeHolderAfter[contextIdSymbol] = 'foo';
        collection.add(placeHolderAfter);

        currentIndex = collection.indexOf(existingItem);

        item = new VcsObject({ name: 'foo' });
        item[contextIdSymbol] = 'bar';
        returnedItem = collection.override(item);
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should add the object to the collection', () => {
        expect(collection.has(item)).to.be.true;
      });

      it('should maintain the objects index', () => {
        expect(collection.indexOf(item)).to.equal(currentIndex);
      });

      it('should return the item', () => {
        expect(returnedItem).to.equal(item);
      });

      it('should add a shadow of the object', () => {
        expect(collection.shadowMap.has('foo')).to.be.true;
        const fooShadowMap = collection.shadowMap.get('foo');
        expect(fooShadowMap).to.be.an('array')
          .and.to.have.lengthOf(1);
        expect(fooShadowMap[0]).to.have.property('name', 'foo');
        expect(fooShadowMap[0]).to.have.property(contextIdSymbol, 'foo');
      });

      it('should call the replaced event with the replacement object', () => {
        expect(replacedItemName).to.equal('foo');
      });
    });

    describe('if an object of said uniqueKey exists, and the collections unique key is not the default', () => {
      let item;
      let returnedItem;
      let collection;
      let uniqueSymbol;

      before(() => {
        uniqueSymbol = Symbol('unique');
        collection = makeOverrideCollection(new Collection(uniqueSymbol), getContextId);

        const existingItem = new VcsObject({ name: 'foo' });
        existingItem[uniqueSymbol] = 'foo';
        existingItem[contextIdSymbol] = 'foo';
        collection.add(existingItem);

        item = new VcsObject({ name: 'foo' });
        item[uniqueSymbol] = 'foo';
        item[contextIdSymbol] = 'bar';
        returnedItem = collection.override(item);
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should add the object to the collection', () => {
        expect(collection.has(item)).to.be.true;
      });

      it('should return the object', () => {
        expect(returnedItem).to.equal(item);
      });

      it('should add a shadow of the object', () => {
        expect(collection.shadowMap.has('foo')).to.be.true;
        const fooShadowMap = collection.shadowMap.get('foo');
        expect(fooShadowMap).to.be.an('array')
          .and.to.have.lengthOf(1);
        expect(fooShadowMap[0]).to.have.property('name', 'foo');
        expect(fooShadowMap[0]).to.have.property(contextIdSymbol, 'foo');
      });
    });
  });

  describe('removing an object from an override collection', () => {
    describe('if no shadow of said object exists', () => {
      let item;
      let collection;

      before(() => {
        collection = makeOverrideCollection(new Collection(), getContextId);
        item = new VcsObject({ name: 'foo' });
        item[contextIdSymbol] = 'foo';
        collection.override(item);
        collection.remove(item);
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should remove the object to the collection', () => {
        expect(collection.has(item)).to.be.false;
      });
    });

    describe('if one shadow of said object exists', () => {
      let item;
      let collection;

      before(() => {
        collection = makeOverrideCollection(new Collection(), getContextId, null, option => new VcsObject(option));

        const existingItem = new VcsObject({ name: 'foo' });
        existingItem[contextIdSymbol] = 'foo';
        collection.add(existingItem);

        item = new VcsObject({ name: 'foo' });
        item[contextIdSymbol] = 'bar';
        collection.override(item);
        collection.remove(item);
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should remove the object to the collection', () => {
        expect(collection.has(item)).to.be.false;
      });

      it('should recreate the shadow', () => {
        expect(collection.getByKey('foo')).to.be.an.instanceOf(VcsObject);
      });

      it('should remove the shadowMap entry', () => {
        expect(collection.shadowMap.has('foo')).to.be.false;
      });
    });

    describe('if one shadow of said object exists and deserialization is async', () => {
      let item;
      let collection;

      before(() => {
        collection = makeOverrideCollection(
          new Collection(),
          getContextId,
          null,
          option => Promise.resolve(new VcsObject(option)),
        );

        const existingItem = new VcsObject({ name: 'foo' });
        existingItem[contextIdSymbol] = 'foo';
        collection.add(existingItem);

        item = new VcsObject({ name: 'foo' });
        item[contextIdSymbol] = 'bar';
        collection.override(item);
        collection.remove(item);
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should remove the object to the collection', () => {
        expect(collection.has(item)).to.be.false;
      });

      it('should recreate the shadow', () => {
        expect(collection.getByKey('foo')).to.be.an.instanceOf(VcsObject);
      });

      it('should remove the shadowMap entry', () => {
        expect(collection.shadowMap.has('foo')).to.be.false;
      });
    });

    describe('if multiple shadows of said object exists ', () => {
      let item;
      let collection;

      before(() => {
        collection = makeOverrideCollection(new Collection(), getContextId, null, option => new VcsObject(option));
        const existingItem1 = new VcsObject({ name: 'foo' });
        existingItem1[contextIdSymbol] = 'foo';
        collection.add(existingItem1);

        const existingItem2 = new VcsObject({ name: 'foo' });
        existingItem2[contextIdSymbol] = 'bar';
        collection.override(existingItem2);

        item = new VcsObject({ name: 'foo' });
        item[contextIdSymbol] = 'baz';
        collection.override(item);
        collection.remove(item);
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should remove the object to the collection', () => {
        expect(collection.has(item)).to.be.false;
      });

      it('should recreate the shadow', () => {
        const reincarnation = collection.getByKey('foo');
        expect(reincarnation).to.be.an.instanceOf(VcsObject);
        expect(reincarnation).to.have.property(contextIdSymbol, 'bar');
      });

      it('should keep previous shadows of the object', () => {
        expect(collection.shadowMap.has('foo')).to.be.true;
        const fooShadowMap = collection.shadowMap.get('foo');
        expect(fooShadowMap).to.be.an('array')
          .and.to.have.lengthOf(1);
        expect(fooShadowMap[0]).to.have.property('name', 'foo');
        expect(fooShadowMap[0]).to.have.property(contextIdSymbol, 'foo');
      });
    });

    describe('if one shadow of said object exists and the collection is an indexed collection', () => {
      let item;
      let collection;
      let currentIndex;

      before(() => {
        collection = makeOverrideCollection(
          new IndexedCollection(),
          getContextId,
          null,
          option => new VcsObject(option),
        );

        const placeHolderBefore = new VcsObject({ name: 'placeHolderBefore' });
        placeHolderBefore[contextIdSymbol] = 'foo';
        collection.add(placeHolderBefore);

        const existingItem = new VcsObject({ name: 'foo' });
        existingItem[contextIdSymbol] = 'foo';
        collection.add(existingItem);

        const placeHolderAfter = new VcsObject({ name: 'placeHolderAfter' });
        placeHolderAfter[contextIdSymbol] = 'foo';
        collection.add(placeHolderAfter);

        item = new VcsObject({ name: 'foo' });
        item[contextIdSymbol] = 'bar';
        collection.override(item);

        currentIndex = collection.indexOf(item);

        collection.remove(item);
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should remove the object to the collection', () => {
        expect(collection.has(item)).to.be.false;
      });

      it('should recreate the shadow', () => {
        expect(collection.getByKey('foo')).to.be.an.instanceOf(VcsObject);
      });

      it('should recreate the shadow at the same index', () => {
        const reincarnation = collection.getByKey('foo');
        expect(collection.indexOf(reincarnation)).to.equal(currentIndex);
      });

      it('should remove the shadowMap entry', () => {
        expect(collection.shadowMap.has('foo')).to.be.false;
      });
    });
  });

  describe('removing a context from an override collection', () => {
    describe('shadowMap handling', () => {
      let collection;

      beforeEach(() => {
        collection = makeOverrideCollection(new Collection(), getContextId, null, option => new VcsObject(option));
      });

      afterEach(() => {
        destroyCollection(collection);
      });

      it('should remove a shadow, if its part of the context', async () => {
        const item1 = new VcsObject({ name: 'foo' });
        item1[contextIdSymbol] = 'foo';
        collection.add(item1);

        const item2 = new VcsObject({ name: 'foo' });
        item2[contextIdSymbol] = 'bar';
        collection.override(item2);

        const item3 = new VcsObject({ name: 'foo' });
        item3[contextIdSymbol] = 'baz';
        collection.override(item3);

        await collection.removeContext('foo');

        expect(collection.shadowMap.has('foo')).to.be.true;
        const fooShadowMap = collection.shadowMap.get('foo');
        expect(fooShadowMap).to.be.an('array')
          .and.to.have.lengthOf(1);
        expect(fooShadowMap[0]).to.have.property('name', 'foo');
        expect(fooShadowMap[0]).to.have.property(contextIdSymbol, 'bar');
      });

      it('should remove all shadows of a context', async () => {
        const item1 = new VcsObject({ name: 'foo' });
        item1[contextIdSymbol] = 'foo';
        collection.add(item1);

        const item2 = new VcsObject({ name: 'foo' });
        item2[contextIdSymbol] = 'foo';
        collection.override(item2);

        const item3 = new VcsObject({ name: 'foo' });
        item3[contextIdSymbol] = 'bar';
        collection.override(item3);

        const item4 = new VcsObject({ name: 'foo' });
        item4[contextIdSymbol] = 'baz';
        collection.override(item4);

        await collection.removeContext('foo');

        expect(collection.shadowMap.has('foo')).to.be.true;
        const fooShadowMap = collection.shadowMap.get('foo');
        expect(fooShadowMap).to.be.an('array')
          .and.to.have.lengthOf(1);
        expect(fooShadowMap[0]).to.have.property('name', 'foo');
        expect(fooShadowMap[0]).to.have.property(contextIdSymbol, 'bar');
      });

      it('should remove the map entry, if there are no more shadows after removing the context', async () => {
        const item1 = new VcsObject({ name: 'foo' });
        item1[contextIdSymbol] = 'foo';
        collection.add(item1);

        const item2 = new VcsObject({ name: 'foo' });
        item2[contextIdSymbol] = 'bar';
        collection.override(item2);

        await collection.removeContext('foo');

        expect(collection.shadowMap.has('foo')).to.be.false;
      });
    });

    describe('if there is an object with said context', () => {
      let collection;
      let item;

      before(async () => {
        collection = makeOverrideCollection(new Collection(), getContextId, null, option => new VcsObject(option));
        item = new VcsObject({ name: 'foo' });
        item[contextIdSymbol] = 'foo';
        collection.add(item);
        await collection.removeContext('foo');
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should remove the object from the collection', () => {
        expect(collection.has(item)).to.be.false;
      });

      it('should destroy the item', () => {
        expect(item.isDestroyed).to.be.true;
      });
    });

    describe('if there is an object with said context and there is one shadow of the object', () => {
      let collection;
      let item;

      before(async () => {
        collection = makeOverrideCollection(new Collection(), getContextId, null, option => new VcsObject(option));

        const item1 = new VcsObject({ name: 'foo' });
        item1[contextIdSymbol] = 'foo';
        collection.add(item1);

        item = new VcsObject({ name: 'foo' });
        item[contextIdSymbol] = 'bar';
        collection.override(item);

        await collection.removeContext('bar');
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should remove the object from the collection', () => {
        expect(collection.has(item)).to.be.false;
      });

      it('should destroy the item', () => {
        expect(item.isDestroyed).to.be.true;
      });

      it('should remove the object name from the shadowMap', () => {
        expect(collection.shadowMap.has('foo')).to.be.false;
      });

      it('should reincarnate the shadow', () => {
        const reincarnation = collection.getByKey('foo');
        expect(reincarnation).to.be.an.instanceOf(VcsObject);
        expect(reincarnation).to.have.property(contextIdSymbol, 'foo');
      });
    });

    describe('if there is an object with said context and there is more then one shadow of the object', () => {
      let collection;
      let item;

      before(async () => {
        collection = makeOverrideCollection(new Collection(), getContextId, null, option => new VcsObject(option));
        const item1 = new Layer({ name: 'foo' });
        item1[contextIdSymbol] = 'foo';
        collection.add(item1);

        const item2 = new Layer({ name: 'foo' });
        item2[contextIdSymbol] = 'bar';
        collection.override(item2);

        item = new Layer({ name: 'foo' });
        item[contextIdSymbol] = 'baz';
        collection.override(item);

        await collection.removeContext('baz');
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should remove the object from the collection', () => {
        expect(collection.has(item)).to.be.false;
      });

      it('should destroy the item', () => {
        expect(item.isDestroyed).to.be.true;
      });

      it('should remove the last shadow from the shadowMap', () => {
        expect(collection.shadowMap.has('foo')).to.be.true;
        const fooShadowMap = collection.shadowMap.get('foo');
        expect(fooShadowMap).to.be.an('array')
          .and.to.have.lengthOf(1);
        expect(fooShadowMap[0]).to.have.property('name', 'foo');
        expect(fooShadowMap[0]).to.have.property(contextIdSymbol, 'foo');
      });

      it('should reincarnate the last pushed shadow', () => {
        const reincarnation = collection.getByKey('foo');
        expect(reincarnation).to.be.an.instanceOf(VcsObject);
        expect(reincarnation).to.have.property(contextIdSymbol, 'bar');
      });
    });
  });

  describe('adding an array of config options to a collection', () => {
    describe('if the array can be considered valid', () => {
      let collection;
      let items;

      before(async () => {
        collection = makeOverrideCollection(
          new Collection(),
          getContextId,
          null,
          option => new VcsObject(option),
          VcsObject,
        );
        const config = [
          {
            type: 'Layer',
            name: 'foo',
          },
          {
            type: 'Layer',
            name: 'bar',
          },
        ];
        await collection.parseItems(config, 'foo');
        items = [...collection].filter(i => i[contextIdSymbol] === 'foo');
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should add valid instances to the collection', () => {
        expect(items).to.have.length(2);
        expect(items.every(l => l instanceof VcsObject)).to.be.true;
      });

      it('should ensure the items are ordered', () => {
        expect(items[0]).to.have.property('name', 'foo');
        expect(items[1]).to.have.property('name', 'bar');
      });
    });

    describe('if the array contains faulty information', () => {
      let collection;
      let items;

      before(async () => {
        collection = makeOverrideCollection(new Collection(), getContextId, null, getObjectFromOptions, Layer);
        const config = [
          {
            type: 'Layer',
            name: 'foo',
          },
          {
            type: 'not a type',
            name: 'baz',
          },
          {
            type: 'Layer',
            name: 'bar',
          },
        ];
        await collection.parseItems(config, 'foo');
        items = [...collection].filter(i => i[contextIdSymbol] === 'foo');
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should add valid instances to the collection', () => {
        expect(items).to.have.length(2);
        expect(items.every(l => l instanceof Layer)).to.be.true;
      });

      it('should ensure the items are ordered', () => {
        expect(items[0]).to.have.property('name', 'foo');
        expect(items[1]).to.have.property('name', 'bar');
      });
    });

    describe('if the array contains information not matching the type', () => {
      let collection;
      let items;

      before(async () => {
        collection = makeOverrideCollection(new Collection(), getContextId, null, getObjectFromOptions, Layer);
        const config = [
          {
            type: 'Layer',
            name: 'foo',
          },
          {
            type: 'CesiumMap',
            name: 'baz',
          },
          {
            type: 'Layer',
            name: 'bar',
          },
        ];
        await collection.parseItems(config, 'foo');
        items = [...collection].filter(i => i[contextIdSymbol] === 'foo');
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should add valid instances to the collection', () => {
        expect(items).to.have.length(2);
        expect(items.every(l => l instanceof Layer)).to.be.true;
      });

      it('should ensure the items are ordered', () => {
        expect(items[0]).to.have.property('name', 'foo');
        expect(items[1]).to.have.property('name', 'bar');
      });
    });

    describe('if the array contains duplicate entries', () => {
      let collection;
      let items;

      before(async () => {
        collection = makeOverrideCollection(new Collection(), getContextId, null, getObjectFromOptions, Layer);
        const config = [
          {
            type: 'Layer',
            name: 'foo',
          },
          {
            type: 'Layer',
            name: 'bar',
          },
          {
            type: 'Layer',
            name: 'foo',
            properties: {
              test: true,
            },
          },
        ];
        await collection.parseItems(config, 'foo');
        items = [...collection].filter(i => i[contextIdSymbol] === 'foo');
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should add instances to the collection', () => {
        expect(items).to.have.length(2);
        expect(items.every(l => l instanceof Layer)).to.be.true;
      });

      it('should ensure the items are ordered', () => {
        expect(items[0]).to.have.property('name', 'bar');
        expect(items[1]).to.have.property('name', 'foo');
        expect(items[1]).to.have.property('properties')
          .and.to.have.property('test', true);
      });

      it('should add duplicate entries to the shadow map', () => {
        expect(collection.shadowMap.has('foo')).to.be.true;
      });
    });

    describe('and removing the entire context, if the array contains duplicate entries', () => {
      let collection;

      before(async () => {
        collection = makeOverrideCollection(new Collection(), getContextId, null, getObjectFromOptions, Layer);
        const config = [
          {
            type: 'Layer',
            name: 'foo',
          },
          {
            type: 'Layer',
            name: 'bar',
          },
          {
            type: 'Layer',
            name: 'foo',
            properties: {
              test: true,
            },
          },
        ];
        await collection.parseItems(config, 'foo');
        await collection.removeContext('foo');
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should not recreate the shadows of the same context', () => {
        expect([...collection]).to.be.empty;
      });

      it('should ensure all shadows are gone', () => {
        expect(collection.shadowMap).to.be.empty;
      });
    });
  });

  describe('serializing a context', () => {
    describe('which has no shadows', () => {
      let items;
      let collection;
      let serializedContext;

      before(() => {
        collection = makeOverrideCollection(new IndexedCollection(), getContextId);

        items = ['foo', 'bar', 'baz']
          .map((name) => {
            const item = new VcsObject({ name });
            item[contextIdSymbol] = 'foo';
            collection.override(item);
            return item;
          });

        collection.override(new VcsObject({ name: 'grape' }));
        serializedContext = collection.serializeContext('foo');
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should serialize all items of said context', () => {
        expect(serializedContext).to.have.lengthOf(items.length);
      });

      it('should return the serialized representation', () => {
        expect(serializedContext).to.have.deep.ordered.members(items.map(i => i.toJSON()));
      });
    });

    describe('which has shadows', () => {
      let items;
      let collection;
      let serializedContext;

      before(() => {
        collection = makeOverrideCollection(new IndexedCollection(), getContextId);

        items = ['foo', 'bar', 'baz']
          .map((name) => {
            const item = new VcsObject({ name });
            item[contextIdSymbol] = 'foo';
            collection.override(item);
            return item;
          });

        collection.override(new VcsObject({ name: 'bar' }));
        serializedContext = collection.serializeContext('foo');
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should serialize all items of said context', () => {
        expect(serializedContext).to.have.lengthOf(items.length);
      });

      it('should return the serialized representation, maintaining the index', () => {
        expect(serializedContext).to.have.deep.ordered.members(items.map(i => i.toJSON()));
      });
    });
  });
});
