import { expect } from 'chai';
import type {
  Collection,
  HiddenObject,
  OverrideCollection,
  OverrideCollectionItem,
} from '../../../index.js';
import {
  GlobalHider,
  createHiddenObjectsCollection,
  moduleIdSymbol,
} from '../../../index.js';

describe('Hidden Object', () => {
  describe('adding hidden objects', () => {
    describe('normal', () => {
      let globalHider: GlobalHider;
      let collection: OverrideCollection<
        HiddenObject,
        Collection<HiddenObject>
      >;

      before(() => {
        globalHider = new GlobalHider();
        collection = createHiddenObjectsCollection(() => 'foo', globalHider);
        collection.add({ id: 'foo' });
      });

      after(() => {
        collection.destroy();
        globalHider.destroy();
      });

      it('should add the item to the global hider', () => {
        expect(globalHider.hiddenObjects).to.have.property('foo', 1);
      });
    });

    describe('override', () => {
      let globalHider: GlobalHider;
      let collection: OverrideCollection<
        HiddenObject,
        Collection<HiddenObject>
      >;

      before(() => {
        globalHider = new GlobalHider();
        collection = createHiddenObjectsCollection(() => 'foo', globalHider);
        collection.add({ id: 'foo' });
        const override: OverrideCollectionItem & HiddenObject = { id: 'foo ' };
        override[moduleIdSymbol] = 'bar';
        collection.override(override);
      });

      after(() => {
        collection.destroy();
        globalHider.destroy();
      });

      it('should add the item to the global hider only once', () => {
        expect(globalHider.hiddenObjects).to.have.property('foo', 1);
      });
    });
  });

  describe('removing hidden objects', () => {
    describe('normal', () => {
      let globalHider: GlobalHider;
      let collection: OverrideCollection<
        HiddenObject,
        Collection<HiddenObject>
      >;

      before(() => {
        globalHider = new GlobalHider();
        collection = createHiddenObjectsCollection(() => 'foo', globalHider);
        const item = { id: 'foo' };
        collection.add(item);
        collection.remove(item);
      });

      after(() => {
        collection.destroy();
        globalHider.destroy();
      });

      it('should remove the item from the global hider', () => {
        expect(globalHider.hiddenObjects).to.not.have.property('foo');
      });
    });

    describe('override', () => {
      let globalHider: GlobalHider;
      let collection: OverrideCollection<
        HiddenObject,
        Collection<HiddenObject>
      >;

      before(() => {
        globalHider = new GlobalHider();
        collection = createHiddenObjectsCollection(() => 'foo', globalHider);
        collection.add({ id: 'foo' });
        const override: OverrideCollectionItem & HiddenObject = { id: 'foo ' };
        override[moduleIdSymbol] = 'bar';
        collection.override(override);
        collection.remove(override);
      });

      it('should still hide the item', () => {
        expect(globalHider.hiddenObjects).to.have.property('foo', 1);
      });
    });
  });
});
