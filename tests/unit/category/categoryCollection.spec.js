import Category from '../../../src/category/category.js';
import VectorLayer from '../../../src/layer/vectorLayer.js';
import VcsApp from '../../../src/vcsApp.js';
import { moduleIdSymbol } from '../../../src/vcsModuleHelpers.js';

describe('CategoryCollection', () => {
  describe('parsing of items', () => {
    describe('of an untyped category', () => {
      let app;

      before(async () => {
        app = new VcsApp();
        const items = [
          {
            name: 'foo',
          },
          {
            name: 'bar',
          },
        ];
        await app.categories.requestCategory({
          name: 'foo',
          type: Category.className,
        });
        await app.categories.parseCategoryItems('foo', items, 'foo');
      });

      after(() => {
        app.destroy();
      });

      it('should add the category', () => {
        expect(app.categories.getByKey('foo')).to.be.an.instanceOf(Category);
      });

      it('should add the items to the collection of the category', () => {
        const category = app.categories.getByKey('foo');
        const items = [...category.collection];
        expect(items).to.have.lengthOf(2);
        expect(items[0]).to.have.property('name', 'foo');
        expect(items[1]).to.have.property('name', 'bar');
      });
    });

    describe('of a typed category', () => {
      let app;

      before(async () => {
        app = new VcsApp();
        const items = [
          {
            name: 'foo',
            type: VectorLayer.className,
          },
          {
            name: 'bar',
            type: VectorLayer.className,
          },
        ];
        await app.categories.requestCategory({
          name: 'foo',
          type: Category.className,
          classRegistryName: 'layerClassRegistry',
        });
        await app.categories.parseCategoryItems('foo', items, 'foo');
      });

      after(() => {
        app.destroy();
      });

      it('should add the category', () => {
        expect(app.categories.getByKey('foo')).to.be.an.instanceOf(Category);
      });

      it('should add the items to the collection of the category', () => {
        const category = app.categories.getByKey('foo');
        const items = [...category.collection];
        expect(items).to.have.lengthOf(2);
        expect(items[0]).to.have.property('name', 'foo');
        expect(items[1]).to.have.property('name', 'bar');
      });

      it('should instantiate the items', () => {
        const category = app.categories.getByKey('foo');
        const items = [...category.collection];
        expect(items[0]).to.be.an.instanceOf(VectorLayer);
        expect(items[1]).to.be.an.instanceOf(VectorLayer);
      });
    });

    describe('of a later requested category', () => {
      let app;

      before(async () => {
        app = new VcsApp();
        const items = [
          {
            name: 'foo',
            type: VectorLayer.className,
          },
          {
            name: 'bar',
            type: VectorLayer.className,
          },
        ];
        await app.categories.parseCategoryItems('foo', items, 'foo');
        await app.categories.requestCategory({
          name: 'foo',
          type: Category.className,
          classRegistryName: 'layerClassRegistry',
        });
      });

      after(() => {
        app.destroy();
      });

      it('should add the items to the collection of the category', () => {
        const category = app.categories.getByKey('foo');
        const items = [...category.collection];
        expect(items).to.have.lengthOf(2);
        expect(items[0]).to.have.property('name', 'foo');
        expect(items[1]).to.have.property('name', 'bar');
      });

      it('should instantiate the items', () => {
        const category = app.categories.getByKey('foo');
        const items = [...category.collection];
        expect(items[0]).to.be.an.instanceOf(VectorLayer);
        expect(items[1]).to.be.an.instanceOf(VectorLayer);
      });
    });

    describe('of an unrequested category, if the module of said items gets removed later on', () => {
      let app;

      before(async () => {
        app = new VcsApp();
        const items = [
          {
            name: 'foo',
            type: VectorLayer.className,
          },
          {
            name: 'bar',
            type: VectorLayer.className,
          },
        ];
        await app.categories.parseCategoryItems('foo', items, 'foo');
        app.moduleRemoved.raiseEvent({ _id: 'foo' });
        await app.categories.requestCategory({
          name: 'foo',
          type: Category.className,
          classRegistryName: 'layerClassRegistry',
        });
      });

      after(() => {
        app.destroy();
      });

      it('should add items, once the was requested category', () => {
        expect(app.categories.getByKey('foo')).to.be.an.instanceOf(Category);
      });

      it('should not add the items to the collection of the category', () => {
        const category = app.categories.getByKey('foo');
        const items = [...category.collection];
        expect(items).to.be.empty;
      });
    });
  });

  describe('requesting', () => {
    describe('of a normal category', () => {
      let category;
      let app;

      before(async () => {
        app = new VcsApp();
        category = await app.categories.requestCategory({
          name: 'foo',
          type: Category.className,
        });
      });

      after(() => {
        app.destroy();
      });

      it('should create the category', () => {
        expect(category).to.be.an.instanceOf(Category);
      });

      it('should add the category to the categories collection', () => {
        expect(app.categories.has(category)).to.be.true;
      });

      it('should set the vcsApp (tested via add public interface, which requires the app to be set)', () => {
        const item = { name: 'foo' };
        category.collection.add(item);
        expect(item).to.have.property(moduleIdSymbol, app.dynamicModuleId);
      });
    });

    describe('of a category which has already been requested', () => {
      let category;
      let categoryAgain;
      let app;

      before(async () => {
        app = new VcsApp();
        category = await app.categories.requestCategory({
          name: 'foo',
          type: Category.className,
          title: 'foo',
        });
        categoryAgain = await app.categories.requestCategory({
          name: 'foo',
          type: Category.className,
          title: 'bar',
        });
      });

      after(() => {
        app.destroy();
      });

      it('should return the existing category', () => {
        expect(categoryAgain).to.equal(category);
      });

      it('should add the category to the categories collection', () => {
        expect(app.categories.has(categoryAgain)).to.be.true;
      });

      it('should merge options', () => {
        expect(category).to.have.property('title', 'bar');
      });
    });

    describe('of a category without a type', () => {
      it('should infer the type', async () => {
        const app = new VcsApp();
        const category = await app.categories.requestCategory({ name: 'foo' });
        expect(category).to.be.an.instanceOf(Category);
      });
    });

    describe('of a category with items', () => {
      it('should ignore items', async () => {
        const app = new VcsApp();
        const category = await app.categories.requestCategory({
          name: 'foo',
          items: [{ name: 'foo' }],
          type: Category.className,
        });
        expect([...category.collection]).to.be.empty;
      });
    });
  });
});
