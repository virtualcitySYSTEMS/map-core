import makeOverrideCollection from '../../../src/util/overrideCollection.js';
import Collection from '../../../src/util/collection.js';
import IndexedCollection from '../../../src/util/indexedCollection.js';
import VcsObject from '../../../src/vcsObject.js';
import Layer from '../../../src/layer/layer.js';
import {
  moduleIdSymbol,
  destroyCollection,
} from '../../../src/vcsModuleHelpers.js';
import {
  getObjectFromClassRegistry,
  layerClassRegistry,
} from '../../../index.js';

describe('override collections', () => {
  let getModuleId;

  before(() => {
    getModuleId = () => 'dynamicModuleId';
  });

  describe('making an override collection', () => {
    it('should make an override collection out of a collection', () => {
      const collection = makeOverrideCollection(new Collection(), getModuleId);
      expect(collection).to.have.property('override');
      expect(collection).to.have.property('replaced');
      expect(collection).to.have.property('shadowMap');
      expect(collection).to.have.property('parseItems');
      expect(collection).to.have.property('removeModule');
    });

    it('should throw an error, when trying to make a colleciton an override collection twice', () => {
      const collection = makeOverrideCollection(new Collection(), getModuleId);
      expect(() => makeOverrideCollection(collection, getModuleId)).to.throw;
    });
  });

  describe('overriding an object of a collection', () => {
    describe('if no object with said name exists', () => {
      let item;
      let returnedItem;
      let collection;
      let replaced = false;

      before(() => {
        collection = makeOverrideCollection(new Collection(), getModuleId);
        collection.replaced.addEventListener(() => {
          replaced = true;
        });

        item = new VcsObject({ name: 'foo' });
        item[moduleIdSymbol] = 'foo';
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

    describe('if the object does not have a moduleId', () => {
      let item;
      let returnedItem;
      let collection;

      before(() => {
        collection = makeOverrideCollection(new Collection(), getModuleId);
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

      it('should add the moduleId to the item', () => {
        expect(item).to.have.property(moduleIdSymbol, getModuleId());
      });
    });

    describe('if an object with said name exists', () => {
      let item;
      let existingItem;
      let collection;
      let replacementEvent = null;
      let returnedItem;

      before(() => {
        collection = makeOverrideCollection(
          new Collection(),
          getModuleId,
          null,
          (option) => new VcsObject(option),
        );
        collection.replaced.addEventListener((event) => {
          replacementEvent = event;
        });

        existingItem = new VcsObject({ name: 'foo' });
        existingItem[moduleIdSymbol] = 'foo';
        collection.add(existingItem);

        item = new VcsObject({ name: 'foo' });
        item[moduleIdSymbol] = 'bar';
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
        expect(fooShadowMap).to.be.an('array').and.to.have.lengthOf(1);
        expect(fooShadowMap[0]).to.have.property('name', 'foo');
        expect(fooShadowMap[0]).to.have.property(moduleIdSymbol, 'foo');
      });

      it('should call the replaced event with the new and old object', () => {
        expect(replacementEvent.new).to.equal(item);
        expect(replacementEvent.old).to.equal(existingItem);
      });
    });

    describe('if several object with said name have been added to the collection', () => {
      let item;
      let collection;

      before(() => {
        collection = makeOverrideCollection(
          new Collection(),
          getModuleId,
          null,
          (option) => new VcsObject(option),
        );
        const existingItem1 = new VcsObject({ name: 'foo' });
        existingItem1[moduleIdSymbol] = 'foo';
        collection.add(existingItem1);

        const existingItem2 = new VcsObject({ name: 'foo' });
        existingItem2[moduleIdSymbol] = 'bar';
        collection.override(existingItem2);

        item = new VcsObject({ name: 'foo' });
        item[moduleIdSymbol] = 'baz';
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
        expect(fooShadowMap).to.be.an('array').and.to.have.lengthOf(2);
        expect(fooShadowMap[0]).to.have.property('name', 'foo');
        expect(fooShadowMap[0]).to.have.property(moduleIdSymbol, 'foo');

        expect(fooShadowMap[1]).to.have.property('name', 'foo');
        expect(fooShadowMap[1]).to.have.property(moduleIdSymbol, 'bar');
      });
    });

    describe('if the collection is an indexed collection', () => {
      let item;
      let collection;
      let existingItem;
      let replacedEvent = null;
      let returnedItem;
      let currentIndex;

      before(() => {
        collection = makeOverrideCollection(
          new IndexedCollection(),
          getModuleId,
          null,
          (option) => new VcsObject(option),
        );
        collection.replaced.addEventListener((event) => {
          replacedEvent = event;
        });

        const placeHolderBefore = new VcsObject({ name: 'placeHolderBefore' });
        placeHolderBefore[moduleIdSymbol] = 'foo';
        collection.add(placeHolderBefore);

        existingItem = new VcsObject({ name: 'foo' });
        existingItem[moduleIdSymbol] = 'foo';
        collection.add(existingItem);

        const placeHolderAfter = new VcsObject({ name: 'placeHolderAfter' });
        placeHolderAfter[moduleIdSymbol] = 'foo';
        collection.add(placeHolderAfter);

        currentIndex = collection.indexOf(existingItem);

        item = new VcsObject({ name: 'foo' });
        item[moduleIdSymbol] = 'bar';
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
        expect(fooShadowMap).to.be.an('array').and.to.have.lengthOf(1);
        expect(fooShadowMap[0]).to.have.property('name', 'foo');
        expect(fooShadowMap[0]).to.have.property(moduleIdSymbol, 'foo');
      });

      it('should call the replaced event with the replacement object', () => {
        expect(replacedEvent.new).to.equal(item);
        expect(replacedEvent.old).to.equal(existingItem);
      });
    });

    describe('if an object of said uniqueKey exists, and the collections unique key is not the default', () => {
      let item;
      let returnedItem;
      let collection;
      let uniqueSymbol;

      before(() => {
        uniqueSymbol = Symbol('unique');
        collection = makeOverrideCollection(
          new Collection(uniqueSymbol),
          getModuleId,
        );

        const existingItem = new VcsObject({ name: 'foo' });
        existingItem[uniqueSymbol] = 'foo';
        existingItem[moduleIdSymbol] = 'foo';
        collection.add(existingItem);

        item = new VcsObject({ name: 'foo' });
        item[uniqueSymbol] = 'foo';
        item[moduleIdSymbol] = 'bar';
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
        expect(fooShadowMap).to.be.an('array').and.to.have.lengthOf(1);
        expect(fooShadowMap[0]).to.have.property('name', 'foo');
        expect(fooShadowMap[0]).to.have.property(moduleIdSymbol, 'foo');
      });
    });
  });

  describe('removing an object from an override collection', () => {
    describe('if no shadow of said object exists', () => {
      let item;
      let collection;

      before(() => {
        collection = makeOverrideCollection(new Collection(), getModuleId);
        item = new VcsObject({ name: 'foo' });
        item[moduleIdSymbol] = 'foo';
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
        collection = makeOverrideCollection(
          new Collection(),
          getModuleId,
          null,
          (option) => new VcsObject(option),
        );

        const existingItem = new VcsObject({ name: 'foo' });
        existingItem[moduleIdSymbol] = 'foo';
        collection.add(existingItem);

        item = new VcsObject({ name: 'foo' });
        item[moduleIdSymbol] = 'bar';
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
          getModuleId,
          null,
          (option) => Promise.resolve(new VcsObject(option)),
        );

        const existingItem = new VcsObject({ name: 'foo' });
        existingItem[moduleIdSymbol] = 'foo';
        collection.add(existingItem);

        item = new VcsObject({ name: 'foo' });
        item[moduleIdSymbol] = 'bar';
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
        collection = makeOverrideCollection(
          new Collection(),
          getModuleId,
          null,
          (option) => new VcsObject(option),
        );
        const existingItem1 = new VcsObject({ name: 'foo' });
        existingItem1[moduleIdSymbol] = 'foo';
        collection.add(existingItem1);

        const existingItem2 = new VcsObject({ name: 'foo' });
        existingItem2[moduleIdSymbol] = 'bar';
        collection.override(existingItem2);

        item = new VcsObject({ name: 'foo' });
        item[moduleIdSymbol] = 'baz';
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
        expect(reincarnation).to.have.property(moduleIdSymbol, 'bar');
      });

      it('should keep previous shadows of the object', () => {
        expect(collection.shadowMap.has('foo')).to.be.true;
        const fooShadowMap = collection.shadowMap.get('foo');
        expect(fooShadowMap).to.be.an('array').and.to.have.lengthOf(1);
        expect(fooShadowMap[0]).to.have.property('name', 'foo');
        expect(fooShadowMap[0]).to.have.property(moduleIdSymbol, 'foo');
      });
    });

    describe('if one shadow of said object exists and the collection is an indexed collection', () => {
      let item;
      let collection;
      let currentIndex;

      before(() => {
        collection = makeOverrideCollection(
          new IndexedCollection(),
          getModuleId,
          null,
          (option) => new VcsObject(option),
        );

        const placeHolderBefore = new VcsObject({ name: 'placeHolderBefore' });
        placeHolderBefore[moduleIdSymbol] = 'foo';
        collection.add(placeHolderBefore);

        const existingItem = new VcsObject({ name: 'foo' });
        existingItem[moduleIdSymbol] = 'foo';
        collection.add(existingItem);

        const placeHolderAfter = new VcsObject({ name: 'placeHolderAfter' });
        placeHolderAfter[moduleIdSymbol] = 'foo';
        collection.add(placeHolderAfter);

        item = new VcsObject({ name: 'foo' });
        item[moduleIdSymbol] = 'bar';
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

  describe('removing a module from an override collection', () => {
    describe('shadowMap handling', () => {
      let collection;

      beforeEach(() => {
        collection = makeOverrideCollection(
          new Collection(),
          getModuleId,
          null,
          (option) => new VcsObject(option),
        );
      });

      afterEach(() => {
        destroyCollection(collection);
      });

      it('should remove a shadow, if its part of the module', async () => {
        const item1 = new VcsObject({ name: 'foo' });
        item1[moduleIdSymbol] = 'foo';
        collection.add(item1);

        const item2 = new VcsObject({ name: 'foo' });
        item2[moduleIdSymbol] = 'bar';
        collection.override(item2);

        const item3 = new VcsObject({ name: 'foo' });
        item3[moduleIdSymbol] = 'baz';
        collection.override(item3);

        await collection.removeModule('foo');

        expect(collection.shadowMap.has('foo')).to.be.true;
        const fooShadowMap = collection.shadowMap.get('foo');
        expect(fooShadowMap).to.be.an('array').and.to.have.lengthOf(1);
        expect(fooShadowMap[0]).to.have.property('name', 'foo');
        expect(fooShadowMap[0]).to.have.property(moduleIdSymbol, 'bar');
      });

      it('should remove all shadows of a module', async () => {
        const item1 = new VcsObject({ name: 'foo' });
        item1[moduleIdSymbol] = 'foo';
        collection.add(item1);

        const item2 = new VcsObject({ name: 'foo' });
        item2[moduleIdSymbol] = 'foo';
        collection.override(item2);

        const item3 = new VcsObject({ name: 'foo' });
        item3[moduleIdSymbol] = 'bar';
        collection.override(item3);

        const item4 = new VcsObject({ name: 'foo' });
        item4[moduleIdSymbol] = 'baz';
        collection.override(item4);

        await collection.removeModule('foo');

        expect(collection.shadowMap.has('foo')).to.be.true;
        const fooShadowMap = collection.shadowMap.get('foo');
        expect(fooShadowMap).to.be.an('array').and.to.have.lengthOf(1);
        expect(fooShadowMap[0]).to.have.property('name', 'foo');
        expect(fooShadowMap[0]).to.have.property(moduleIdSymbol, 'bar');
      });

      it('should remove the map entry, if there are no more shadows after removing the module', async () => {
        const item1 = new VcsObject({ name: 'foo' });
        item1[moduleIdSymbol] = 'foo';
        collection.add(item1);

        const item2 = new VcsObject({ name: 'foo' });
        item2[moduleIdSymbol] = 'bar';
        collection.override(item2);

        await collection.removeModule('foo');

        expect(collection.shadowMap.has('foo')).to.be.false;
      });
    });

    describe('if there is an object with said module', () => {
      let collection;
      let item;

      before(async () => {
        collection = makeOverrideCollection(
          new Collection(),
          getModuleId,
          null,
          (option) => new VcsObject(option),
        );
        item = new VcsObject({ name: 'foo' });
        item[moduleIdSymbol] = 'foo';
        collection.add(item);
        await collection.removeModule('foo');
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

    describe('if there is an object with said module and there is one shadow of the object', () => {
      let collection;
      let item;

      before(async () => {
        collection = makeOverrideCollection(
          new Collection(),
          getModuleId,
          null,
          (option) => new VcsObject(option),
        );

        const item1 = new VcsObject({ name: 'foo' });
        item1[moduleIdSymbol] = 'foo';
        collection.add(item1);

        item = new VcsObject({ name: 'foo' });
        item[moduleIdSymbol] = 'bar';
        collection.override(item);

        await collection.removeModule('bar');
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
        expect(reincarnation).to.have.property(moduleIdSymbol, 'foo');
      });
    });

    describe('if there is an object with said module and there is more then one shadow of the object', () => {
      let collection;
      let item;

      before(async () => {
        collection = makeOverrideCollection(
          new Collection(),
          getModuleId,
          null,
          (option) => new VcsObject(option),
        );
        const item1 = new Layer({ name: 'foo' });
        item1[moduleIdSymbol] = 'foo';
        collection.add(item1);

        const item2 = new Layer({ name: 'foo' });
        item2[moduleIdSymbol] = 'bar';
        collection.override(item2);

        item = new Layer({ name: 'foo' });
        item[moduleIdSymbol] = 'baz';
        collection.override(item);

        await collection.removeModule('baz');
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
        expect(fooShadowMap).to.be.an('array').and.to.have.lengthOf(1);
        expect(fooShadowMap[0]).to.have.property('name', 'foo');
        expect(fooShadowMap[0]).to.have.property(moduleIdSymbol, 'foo');
      });

      it('should reincarnate the last pushed shadow', () => {
        const reincarnation = collection.getByKey('foo');
        expect(reincarnation).to.be.an.instanceOf(VcsObject);
        expect(reincarnation).to.have.property(moduleIdSymbol, 'bar');
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
          getModuleId,
          null,
          (option) => new VcsObject(option),
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
        items = [...collection].filter((i) => i[moduleIdSymbol] === 'foo');
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should add valid instances to the collection', () => {
        expect(items).to.have.length(2);
        expect(items.every((l) => l instanceof VcsObject)).to.be.true;
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
        collection = makeOverrideCollection(
          new Collection(),
          getModuleId,
          null,
          getObjectFromClassRegistry.bind(null, layerClassRegistry),
          Layer,
        );
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
        items = [...collection].filter((i) => i[moduleIdSymbol] === 'foo');
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should add valid instances to the collection', () => {
        expect(items).to.have.length(2);
        expect(items.every((l) => l instanceof Layer)).to.be.true;
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
        collection = makeOverrideCollection(
          new Collection(),
          getModuleId,
          null,
          getObjectFromClassRegistry.bind(null, layerClassRegistry),
          Layer,
        );
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
        items = [...collection].filter((i) => i[moduleIdSymbol] === 'foo');
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should add valid instances to the collection', () => {
        expect(items).to.have.length(2);
        expect(items.every((l) => l instanceof Layer)).to.be.true;
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
        collection = makeOverrideCollection(
          new Collection(),
          getModuleId,
          null,
          getObjectFromClassRegistry.bind(null, layerClassRegistry),
          Layer,
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
          {
            type: 'Layer',
            name: 'foo',
            properties: {
              test: true,
            },
          },
        ];
        await collection.parseItems(config, 'foo');
        items = [...collection].filter((i) => i[moduleIdSymbol] === 'foo');
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should add instances to the collection', () => {
        expect(items).to.have.length(2);
        expect(items.every((l) => l instanceof Layer)).to.be.true;
      });

      it('should ensure the items are ordered', () => {
        expect(items[0]).to.have.property('name', 'bar');
        expect(items[1]).to.have.property('name', 'foo');
        expect(items[1])
          .to.have.property('properties')
          .and.to.have.property('test', true);
      });

      it('should add duplicate entries to the shadow map', () => {
        expect(collection.shadowMap.has('foo')).to.be.true;
      });
    });

    describe('and removing the entire module, if the array contains duplicate entries', () => {
      let collection;

      before(async () => {
        collection = makeOverrideCollection(
          new Collection(),
          getModuleId,
          null,
          getObjectFromClassRegistry.bind(null, layerClassRegistry),
          Layer,
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
          {
            type: 'Layer',
            name: 'foo',
            properties: {
              test: true,
            },
          },
        ];
        await collection.parseItems(config, 'foo');
        await collection.removeModule('foo');
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should not recreate the shadows of the same module', () => {
        expect([...collection]).to.be.empty;
      });

      it('should ensure all shadows are gone', () => {
        expect(collection.shadowMap).to.be.empty;
      });
    });
  });

  describe('serializing a module', () => {
    describe('which has no shadows', () => {
      let items;
      let collection;
      let serializedModule;

      before(() => {
        collection = makeOverrideCollection(
          new IndexedCollection(),
          getModuleId,
        );

        items = ['foo', 'bar', 'baz'].map((name) => {
          const item = new VcsObject({ name });
          item[moduleIdSymbol] = 'foo';
          collection.override(item);
          return item;
        });

        collection.override(new VcsObject({ name: 'grape' }));
        serializedModule = collection.serializeModule('foo');
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should serialize all items of said module', () => {
        expect(serializedModule).to.have.lengthOf(items.length);
      });

      it('should return the serialized representation', () => {
        expect(serializedModule).to.have.deep.ordered.members(
          items.map((i) => i.toJSON()),
        );
      });
    });

    describe('which has shadows', () => {
      let items;
      let collection;
      let serializedModule;

      before(() => {
        collection = makeOverrideCollection(
          new IndexedCollection(),
          getModuleId,
        );

        items = ['foo', 'bar', 'baz'].map((name) => {
          const item = new VcsObject({ name });
          item[moduleIdSymbol] = 'foo';
          collection.override(item);
          return item;
        });

        collection.override(new VcsObject({ name: 'bar' }));
        serializedModule = collection.serializeModule('foo');
      });

      after(() => {
        destroyCollection(collection);
      });

      it('should serialize all items of said module', () => {
        expect(serializedModule).to.have.lengthOf(items.length);
      });

      it('should return the serialized representation, maintaining the index', () => {
        expect(serializedModule).to.have.deep.ordered.members(
          items.map((i) => i.toJSON()),
        );
      });
    });
  });
});
