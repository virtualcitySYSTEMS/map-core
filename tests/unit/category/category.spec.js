import OlFeature from 'ol/Feature.js';
import { Point } from 'ol/geom.js';
import Category from '../../../src/category/category.js';
import IndexedCollection from '../../../src/util/indexedCollection.js';
import VectorStyleItem from '../../../src/style/vectorStyleItem.js';
import VcsApp from '../../../src/vcsApp.js';
import VcsObject from '../../../src/vcsObject.js';
import { contextIdSymbol } from '../../../src/vcsAppContextHelpers.js';

describe('Category', () => {
  let app;
  let sandbox;

  before(() => {
    app = new VcsApp();
    sandbox = sinon.createSandbox();
  });

  after(() => {
    app.destroy();
  });

  describe('setting the collection on a category', () => {
    describe('with a valid empty new collection', () => {
      let category;
      let collection;
      let oldCollection;
      let itemAddedSpy;
      let itemRemovedSpy;
      let itemMovedSpy;
      let destroyedSpy;

      before(() => {
        category = new Category({});
        category.setApp(app);
        oldCollection = category.collection;
        destroyedSpy = sandbox.spy(oldCollection, 'destroy');
        collection = new IndexedCollection();
        itemAddedSpy = sandbox.spy(category, '_itemAdded');
        itemRemovedSpy = sandbox.spy(category, '_itemRemoved');
        itemMovedSpy = sandbox.spy(category, '_itemMoved');
        category.setCollection(collection);
      });

      after(() => {
        sandbox.restore();
        category.destroy();
      });

      it('should destroy the old collection', () => {
        expect(destroyedSpy).to.have.been.called;
      });

      it('should set the new collection', () => {
        expect(category.collection).to.equal(collection);
      });

      describe('collection listeners', () => {
        it('should add add listeners to the new collection', () => {
          const item = { name: 'foo' };
          collection.add(item);
          expect(itemAddedSpy).to.have.been.calledWith(item);
          collection.add({ name: 'bar' });
          collection.raise(item, 1);
          expect(itemMovedSpy).to.have.been.calledWith(item);
          collection.remove(item);
          expect(itemRemovedSpy).to.have.been.calledWith(item);
        });

        it('should no longer listen to the old collections events', () => {
          const item = { name: 'foo' };
          oldCollection.add(item);
          oldCollection.add({ name: 'bar' });
          oldCollection.raise(item, 1);
          oldCollection.remove(item);

          expect(itemAddedSpy).to.have.been.called;
          expect(itemMovedSpy).to.have.been.called;
          expect(itemRemovedSpy).to.have.been.called;
        });
      });
    });

    describe('while the current collection is already filled', () => {
      it('should destroy any items inside', () => {
        const category = new Category({});
        category.setApp(app);
        const item = new VcsObject({});
        category.collection.add(item);
        category.setCollection(new IndexedCollection());
        expect(item.isDestroyed).to.be.true;
        category.destroy();
      });

      it('should remove all feature from the category layer', () => {
        const category = new Category({
          featureProperty: 'feature',
        });
        category.setApp(app);
        category.collection.add({ name: 'foo', feature: new OlFeature() });
        category.setCollection(new IndexedCollection());
        expect(category.layer.getFeatures()).to.be.empty;
        category.destroy();
      });
    });

    describe('if the new collection is already filled', () => {
      it('should call added for each item newly added', () => {
        const item = { name: 'foo' };
        const category = new Category({});
        category.setApp(app);
        const itemAddedSpy = sandbox.spy(category, '_itemAdded');
        category.setCollection(IndexedCollection.from([item]));
        expect(itemAddedSpy).to.have.been.calledWith(item);
        category.destroy();
      });
    });

    it('should fail, if the keyProperty of the collection does not match the categories key property', () => {
      const category = new Category({ keyProperty: 'foo' });
      expect(() => { category.setCollection(new IndexedCollection()); }).to.throw;
      category.destroy();
    });

    it('should raise the category changed event', () => {
      const spy = sinon.spy();
      const category = new Category({});
      category.collectionChanged.addEventListener(spy);
      category.setCollection(new IndexedCollection());
      expect(spy).to.have.been.called;
      category.destroy();
    });
  });

  describe('adding items to the collection', () => {
    describe('if there is no feature property', () => {
      /** @type {Category} */
      let category;
      let app1;

      before(async () => {
        app1 = new VcsApp();
        category = await app1.categories.requestCategory({ name: 'foo' });
      });

      after(() => {
        app1.destroy();
      });

      it('should add the dynamic context Id of the app to the feature, if it does not have a context ID set', () => {
        const item = { name: 'foo' };
        category.collection.add(item);
        expect(item).to.have.property(contextIdSymbol, app1.dynamicContextId);
      });

      it('should not overwrite the context id of an item which already has a context id', () => {
        const item = { name: 'bar' };
        item[contextIdSymbol] = 'bar';
        category.collection.add(item);
        expect(item).to.have.property(contextIdSymbol, 'bar');
      });
    });

    describe('if there is a featureProperty', () => {
      /** @type {Category} */
      let category;
      let app1;

      before(async () => {
        app1 = new VcsApp();
        category = await app1.categories.requestCategory({ name: 'foo', featureProperty: 'feature' });
      });

      after(() => {
        app1.destroy();
      });

      it('should add an ol.Feature to the layer', (done) => {
        const item = { name: 'foo', feature: new OlFeature() };
        category.collection.add(item);

        setTimeout(() => {
          expect(category.layer.getFeatureById(item.name)).to.equal(item.feature);
          done();
        }, 20);
      });

      it('should assure, the id and the item key property match', () => {
        const feature = new OlFeature();
        feature.setId('foo');
        const item = { name: 'bar', feature };
        category.collection.add(item);
        expect(feature.getId()).to.equal(item.name);
      });

      it('should create an ol.Feature from a geojson feature object', (done) => {
        const item = {
          name: 'baz',
          feature: {
            type: 'Feature',
            properties: { foo: true },
            geometry: { type: 'Point', coordinates: [0, 0, 1] },
          },
        };
        category.collection.add(item);
        setTimeout(() => {
          const feature = category.layer.getFeatureById(item.name);
          expect(feature).to.be.an.instanceOf(OlFeature);
          expect(feature.getProperties()).to.have.property('foo', true);
          done();
        }, 20);
      });

      it('should serialize an ol.Feature on replace', (done) => {
        const item = {
          name: 'baz',
          feature: {
            type: 'Feature',
            properties: { foo: true },
            geometry: { type: 'Point', coordinates: [0, 0, 1] },
          },
        };
        category.collection.add(item);
        const otherItem = { name: 'baz' };
        category.collection.override(otherItem);

        const otherFeature = category.layer.getFeatureById(item.name);
        expect(otherFeature).to.be.null;

        category.collection.remove(otherItem);
        setTimeout(() => {
          const feature = category.layer.getFeatureById(item.name);
          expect(feature).to.be.an.instanceOf(OlFeature);
          done();
        }, 20);
      });
    });
  });

  describe('serializing a category for a context', () => {
    describe('of an empty category', () => {
      it('should return null', () => {
        const category = new Category({});
        expect(category.serializeContext('foo')).to.be.null;
        category.destroy();
      });
    });

    describe('of a category with a filled collection', () => {
      let serialized;
      let fooItem;

      before(() => {
        const category = new Category({
          name: 'bar',
        });
        category.setApp(app);
        fooItem = { name: 'foo', [contextIdSymbol]: 'foo' };
        category.collection.add(fooItem);
        category.collection.add({ name: 'bar' });
        const bazItem = new VcsObject({ name: 'baz' });
        bazItem[contextIdSymbol] = 'foo';
        category.collection.add(bazItem);
        serialized = category.serializeContext('foo');
        category.destroy();
      });

      it('should serialize the items of said context', () => {
        expect(serialized).to.have.property('items').and.to.have.lengthOf(2);
        expect(serialized.items.map(i => i.name)).to.have.members(['foo', 'baz']);
      });

      it('should copy/serialize the items', () => {
        const serializedFooItem = serialized.items.find(i => i.name === 'foo');
        expect(serializedFooItem).to.have.all.keys('name');
        expect(serializedFooItem).to.not.equal(fooItem);

        const serializedBazItem = serialized.items.find(i => i.name === 'baz');
        expect(serializedBazItem).to.not.be.an.instanceOf(VcsObject);
      });
    });

    describe('of a category with a feature property', () => {
      let serialized;
      let fooItem;

      before(async () => {
        const category = new Category({
          name: 'bar',
          featureProperty: 'feat',
        });
        category.setApp(app);
        fooItem = { name: 'foo', [contextIdSymbol]: 'foo', feat: new OlFeature({ geometry: new Point([1, 1, 0]) }) };
        category.collection.add(fooItem);
        category.collection.add({ name: 'bar' });
        const bazItem = new VcsObject({ name: 'baz' });
        bazItem[contextIdSymbol] = 'foo';
        category.collection.add(bazItem);

        await new Promise((done) => {
          setTimeout(() => {
            serialized = category.serializeContext('foo');
            category.destroy();
            done();
          }, 20);
        });
      });

      it('should serialize the items of said context', () => {
        expect(serialized).to.have.property('items').and.to.have.lengthOf(2);
        expect(serialized.items.map(i => i.name)).to.have.members(['foo', 'baz']);
      });

      it('should serialize a features property', () => {
        expect(serialized.items[0]).to.have.property('feat')
          .and.to.have.property('type', 'Feature');
      });
    });
  });

  describe('merging of category options', () => {
    describe('of valid options', () => {
      describe('of a default category', () => {
        let category;
        let options;

        before(() => {
          options = {
            title: 'foo',
            layerOptions: {
              zIndex: 5,
            },
          };
          category = new Category({});
          category.mergeOptions(options);
        });

        after(() => {
          category.destroy();
        });

        it('should configure title', () => {
          expect(category).to.have.property('title', options.title);
        });

        it('should ignore layerOptions', () => {
          expect(category.layer).to.be.null;
        });
      });

      describe('of a classRegistryName category with feature & key properties', () => {
        let category;
        let options;

        before(() => {
          options = {
            title: 'foo',
            classRegistryName: 'styleClassRegistry',
            featureProperty: 'feature',
            keyProperty: 'key',
            layerOptions: {
              style: new VectorStyleItem({}),
              highlightStyle: new VectorStyleItem({}),
              vectorProperties: {
                extrudedHeight: 80,
              },
              zIndex: 5,
            },
          };
          category = new Category({
            classRegistryName: 'styleClassRegistry',
            featureProperty: 'feature',
            keyProperty: 'key',
          });
          category.mergeOptions(options);
        });

        after(() => {
          category.destroy();
        });

        it('should configure title', () => {
          expect(category).to.have.property('title', options.title);
        });

        it('should set layerOptions style', () => {
          expect(category.layer).to.have.property('style', options.layerOptions.style);
        });

        it('should set layerOptions highlightStyle', () => {
          expect(category.layer).to.have.property('highlightStyle', options.layerOptions.highlightStyle);
        });

        it('should set layerOptions zIndex', () => {
          expect(category.layer).to.have.property('zIndex', options.layerOptions.zIndex);
        });

        it('should set layerOptions vectorProperties', () => {
          expect(category.layer).to.have.property('vectorProperties')
            .and.to.have.property('extrudedHeight', options.layerOptions.vectorProperties.extrudedHeight);
        });
      });
    });

    describe('of invalid options', () => {
      describe('of a default category', () => {
        let category;

        before(() => {
          category = new Category({});
        });

        after(() => {
          category.destroy();
        });

        it('should throw on resetting classRegistryName', () => {
          expect(() => category.mergeOptions({ classRegistryName: 'foo' })).to.throw;
        });

        it('should throw on resetting featureProperty', () => {
          expect(() => category.mergeOptions({ featureProperty: 'foo' })).to.throw;
        });

        it('should throw on resetting keyProperty', () => {
          expect(() => category.mergeOptions({ keyProperty: 'foo' })).to.throw;
        });
      });

      describe('of a classRegistryName category with feature & key properties', () => {
        let category;
        let options;

        before(() => {
          options = {
            classRegistryName: 'styleClassRegistry',
            featureProperty: 'feature',
            keyProperty: 'key',
          };
          category = new Category(options);
        });

        after(() => {
          category.destroy();
        });

        it('should throw on resetting classRegistryName', () => {
          expect(() => category.mergeOptions({ ...options, classRegistryName: 'layerClassRegistry' })).to.throw;
        });

        it('should throw on resetting featureProperty', () => {
          expect(() => category.mergeOptions({ ...options, featureProperty: 'foo' })).to.throw;
        });

        it('should throw on resetting keyProperty', () => {
          expect(() => category.mergeOptions({ ...options, keyProperty: 'foo' })).to.throw;
        });

        it('should throw on omitting classRegistryName', () => {
          const missingOptions = { ...options };
          delete missingOptions.classRegistryName;
          expect(() => category.mergeOptions(missingOptions)).to.throw;
        });

        it('should throw on omitting featureProperty', () => {
          const missingOptions = { ...options };
          delete missingOptions.featureProperty;
          expect(() => category.mergeOptions(missingOptions)).to.throw;
        });

        it('should throw on omitting keyProperty', () => {
          const missingOptions = { ...options };
          delete missingOptions.keyProperty;
          expect(() => category.mergeOptions(missingOptions)).to.throw;
        });
      });
    });
  });

  describe('serializing a category', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const config = new Category({}).toJSON();
        expect(config).to.have.all.keys('name', 'type');
      });
    });

    describe('of a configured layer', () => {
      let inputConfig;
      let outputConfig;
      let configureCategory;

      before(() => {
        inputConfig = {
          title: 'foo',
          featureProperty: 'feature',
          classRegistryName: 'layers',
          layerOptions: {
            name: 'foo',
          },
          keyProperty: 'bar',
        };
        configureCategory = new Category(inputConfig);
        outputConfig = configureCategory.toJSON();
      });

      after(() => {
        configureCategory.destroy();
      });

      it('should configure title', () => {
        expect(outputConfig).to.have.property('title', inputConfig.title);
      });

      it('should configure featureProperty', () => {
        expect(outputConfig).to.have.property('featureProperty', inputConfig.featureProperty);
      });

      it('should configure classRegistryName', () => {
        expect(outputConfig).to.have.property('classRegistryName', inputConfig.classRegistryName);
      });

      it('should configure keyProperty', () => {
        expect(outputConfig).to.have.property('keyProperty', inputConfig.keyProperty);
      });

      it('should configure layerOptions', () => {
        expect(outputConfig).to.have.property('layerOptions').and.to.eql(inputConfig.layerOptions);
      });
    });
  });
});
