import { expect } from 'chai';
import { Point } from 'ol/geom.js';
import {
  createSync,
  ObliqueMap,
  OpenlayersMap,
  SelectionMode,
  startSelectFeaturesSession,
} from '../../../../index.js';
import VcsApp from '../../../../src/vcsApp.js';
import VectorLayer from '../../../../src/layer/vectorLayer.js';
import { createFeatureWithId } from './transformation/setupTransformationHandler.js';
import { getCesiumMap } from '../../helpers/cesiumHelpers.js';

describe('startSelectFeaturesSession', () => {
  let app;
  let layer;
  let defaultMap;
  let obliqueMap;
  let cesiumMap;
  let feature;

  before(async () => {
    defaultMap = new OpenlayersMap({});
    app = new VcsApp();
    app.maps.add(defaultMap);
    obliqueMap = new ObliqueMap({});
    app.maps.add(obliqueMap);
    cesiumMap = getCesiumMap();
    app.maps.add(cesiumMap);
    await app.maps.setActiveMap(defaultMap.name);
    layer = new VectorLayer({});
    app.layers.add(layer);
    feature = createFeatureWithId({ geometry: new Point([0, 0, 0]) });
    layer.addFeatures([feature]);
  });

  describe('multi mode', () => {
    describe('selecting a feature', () => {
      after(async () => { // catch all if oblique spec throws
        await app.maps.setActiveMap(defaultMap.name);
      });

      describe('feature selection', () => {
        let session;

        before(async () => {
          session = startSelectFeaturesSession(app, layer);
          await session.setCurrentFeatures([feature]);
        });

        after(() => {
          session.stop();
        });

        it('should set create sync on the features', async () => {
          expect(feature).to.have.property(createSync, true);
        });

        it('should highlight the feature', async () => {
          expect(layer.featureVisibility.highlightedObjects).to.have.property(feature.getId());
        });
      });

      describe('oblique map handling', () => {
        it('should set switchEnabled false on oblique maps', async () => {
          const session = startSelectFeaturesSession(app, layer);
          await app.maps.setActiveMap(obliqueMap.name);
          await session.setCurrentFeatures([feature]);
          expect(obliqueMap.switchEnabled).to.be.false;
          session.stop();
          await app.maps.setActiveMap(defaultMap.name);
        });
      });
    });

    describe('clearing the feature selection', () => {
      after(async () => { // catch all if oblique spec throws
        await app.maps.setActiveMap(defaultMap.name);
      });

      describe('deselecting a feature', () => {
        let session;

        before(async () => {
          session = startSelectFeaturesSession(app, layer);
          await session.setCurrentFeatures([feature]);
          session.clearSelection();
        });

        after(() => {
          session.stop();
        });

        it('should unset create sync on the features', async () => {
          expect(feature).to.not.have.property(createSync);
        });

        it('should unhighlight the feature', async () => {
          expect(layer.featureVisibility.highlightedObjects).to.not.have.property(feature.getId());
        });
      });

      describe('oblique map handling', () => {
        it('should set switchEnabled true if unselecting a feature', async () => {
          const session = startSelectFeaturesSession(app, layer);
          await app.maps.setActiveMap(obliqueMap.name);
          await session.setCurrentFeatures([feature]);
          await session.clearSelection();
          expect(obliqueMap.switchEnabled).to.be.true;
          session.stop();
          await app.maps.setActiveMap(defaultMap.name);
        });
      });
    });

    describe('changing a selection set', () => {
      let feature1;
      let feature2;
      let feature3;

      before(async () => {
        feature1 = createFeatureWithId(new Point([0, 0, 0]));
        feature2 = createFeatureWithId(new Point([0, 0, 0]));
        feature3 = createFeatureWithId(new Point([0, 0, 0]));
        layer.addFeatures([feature1, feature2, feature3]);
      });

      after(async () => { // catch all if oblique spec throws
        await app.maps.setActiveMap(defaultMap.name);
        layer.removeFeaturesById([feature1.getId(), feature2.getId(), feature3.getId()]);
      });

      describe('deselecting a feature', () => {
        let session;

        before(async () => {
          session = startSelectFeaturesSession(app, layer);
          await session.setCurrentFeatures([feature1, feature2]);
          await session.setCurrentFeatures([feature1, feature3]);
        });

        after(() => {
          session.stop();
        });

        it('should set create sync on the features', async () => {
          expect(feature1).to.have.property(createSync, true);
          expect(feature2).to.not.have.property(createSync);
          expect(feature3).to.have.property(createSync, true);
        });

        it('should highlight the feature', async () => {
          expect(layer.featureVisibility.highlightedObjects).to.have.keys([feature1.getId(), feature3.getId()]);
        });
      });

      describe('oblique map handling', () => {
        it('should set switchEnabled false on oblique maps', async () => {
          const session = startSelectFeaturesSession(app, layer);
          await app.maps.setActiveMap(obliqueMap.name);
          await session.setCurrentFeatures([feature1, feature2]);
          await session.setCurrentFeatures([feature1, feature3]);
          expect(obliqueMap.switchEnabled).to.be.false;
          session.stop();
          await app.maps.setActiveMap(defaultMap.name);
        });
      });
    });
  });

  describe('stopping a session', () => {
    let session;

    beforeEach(() => {
      session = startSelectFeaturesSession(app, layer);
    });

    after(async () => { // catch all if oblique spec throws
      await app.maps.setActiveMap(defaultMap.name);
    });

    it('should remove the interaction', () => {
      const interaction = app.maps.eventHandler.interactions[3];
      session.stop();
      expect(app.maps.eventHandler.interactions).to.not.include(interaction);
    });

    it('should call stopped', () => {
      const spy = sinon.spy();
      session.stopped.addEventListener(spy);
      session.stop();
      expect(spy).to.have.been.called;
    });

    describe('with a feature selected', () => {
      beforeEach(async () => {
        await session.setCurrentFeatures([feature]);
      });

      it('should remove create sync on the features', async () => {
        session.stop();
        expect(feature).to.not.have.property(createSync);
      });

      it('should unhighlight the feature', async () => {
        session.stop();
        expect(layer.featureVisibility.highlightedObjects).to.not.have.property(feature.getId());
      });

      it('should reset switchEnabled on oblique maps', async () => {
        await app.maps.setActiveMap(obliqueMap.name);
        session.stop();
        expect(obliqueMap.switchEnabled).to.be.true;
        await app.maps.setActiveMap(defaultMap.name);
      });
    });
  });

  describe('changing the active map to an oblique map', () => {
    let session;

    beforeEach(() => {
      session = startSelectFeaturesSession(app, layer);
    });

    afterEach(async () => {
      session.stop();
      await app.maps.setActiveMap(defaultMap.name);
    });

    it('should clear the current selection', async () => {
      await session.setCurrentFeatures([feature]);
      await app.maps.setActiveMap(obliqueMap.name);
      expect(session.currentFeatures).to.be.empty;
    });

    describe('image changed listener', async () => {
      beforeEach(async () => {
        await app.maps.setActiveMap(obliqueMap.name);
      });

      it('should clear the current selection', async () => {
        await session.setCurrentFeatures([feature]);
        obliqueMap.imageChanged.raiseEvent();
        expect(session.currentFeatures).to.be.empty;
      });
    });
  });

  describe('changing the active map from an oblique map', () => {
    let session;

    before(async () => {
      await app.maps.setActiveMap(obliqueMap.name);
      session = startSelectFeaturesSession(app, layer);
    });

    after(async () => {
      session.stop();
      await app.maps.setActiveMap(defaultMap.name);
    });

    it('should clear the current selection', async () => {
      await session.setCurrentFeatures([feature]);
      await app.maps.setActiveMap(defaultMap.name);
      expect(session.currentFeatures).to.be.empty;
    });

    it('should no longer listen to image changed', async () => {
      await app.maps.setActiveMap(defaultMap.name);
      await session.setCurrentFeatures([feature]);
      obliqueMap.imageChanged.raiseEvent();
      expect(session.currentFeatures).to.include.members([feature]);
    });

    it('should reset switchEnabled, if a feature was selected', async () => {
      await session.setCurrentFeatures([feature]);
      await app.maps.setActiveMap(defaultMap.name);
      expect(obliqueMap.switchEnabled).to.be.true;
    });
  });

  describe('single mode', () => {
    describe('selecting a feature', () => {
      after(async () => { // catch all if oblique spec throws
        await app.maps.setActiveMap(defaultMap.name);
      });

      it('should set create sync on the feature', async () => {
        const session = startSelectFeaturesSession(app, layer, undefined, SelectionMode.SINGLE);
        await session.setCurrentFeatures(feature);
        expect(feature).to.have.property(createSync, true);
        session.stop();
      });

      it('should set switchEnabled false on oblique maps', async () => {
        const session = startSelectFeaturesSession(app, layer, undefined, SelectionMode.SINGLE);
        await app.maps.setActiveMap(obliqueMap.name);
        await session.setCurrentFeatures(feature);
        expect(obliqueMap.switchEnabled).to.be.false;
        session.stop();
        await app.maps.setActiveMap(defaultMap.name);
      });

      it('should set switchEnabled true if unselecting a feature', async () => {
        const session = startSelectFeaturesSession(app, layer, undefined, SelectionMode.SINGLE);
        await app.maps.setActiveMap(obliqueMap.name);
        await session.setCurrentFeatures(feature);
        await session.clearSelection();
        expect(obliqueMap.switchEnabled).to.be.true;
        session.stop();
        await app.maps.setActiveMap(defaultMap.name);
      });
    });

    describe('unselecting a feature', () => {
      after(async () => { // catch all if oblique spec throws
        await app.maps.setActiveMap(defaultMap.name);
      });

      it('should no longer have create sync set on the feature', async () => {
        const session = startSelectFeaturesSession(app, layer, undefined, SelectionMode.SINGLE);
        await session.setCurrentFeatures(feature);
        session.clearSelection();
        expect(feature).to.not.have.property(createSync);
        session.stop();
      });

      it('should reset switchEnabled on oblique maps', async () => {
        const session = startSelectFeaturesSession(app, layer, undefined, SelectionMode.SINGLE);
        await app.maps.setActiveMap(obliqueMap.name);
        await session.setCurrentFeatures(feature);
        session.clearSelection();
        expect(obliqueMap.switchEnabled).to.be.true;
        session.stop();
        await app.maps.setActiveMap(defaultMap.name);
      });
    });
  });

  describe('stopping a session', () => {
    let session;

    beforeEach(() => {
      session = startSelectFeaturesSession(app, layer, undefined, SelectionMode.SINGLE);
    });

    after(async () => { // catch all if oblique spec throws
      await app.maps.setActiveMap(defaultMap.name);
    });

    it('should remove the interaction', () => {
      const interaction = app.maps.eventHandler.interactions[3];
      session.stop();
      expect(app.maps.eventHandler.interactions).to.not.include(interaction);
    });

    it('should call stopped', () => {
      const spy = sinon.spy();
      session.stopped.addEventListener(spy);
      session.stop();
      expect(spy).to.have.been.called;
    });

    it('should remove createSync from any currently selected features', async () => {
      await session.setCurrentFeatures(feature);
      session.stop();
      expect(feature).to.not.have.property(createSync);
    });

    it('should reset switchEnabled on oblique maps', async () => {
      await app.maps.setActiveMap(obliqueMap.name);
      await session.setCurrentFeatures(feature);
      session.stop();
      expect(obliqueMap.switchEnabled).to.be.true;
      await app.maps.setActiveMap(defaultMap.name);
    });
  });

  describe('changing the active map to an oblique map', () => {
    let session;

    beforeEach(() => {
      session = startSelectFeaturesSession(app, layer, undefined, SelectionMode.SINGLE);
    });

    afterEach(async () => {
      session.stop();
      await app.maps.setActiveMap(defaultMap.name);
    });

    it('should clear the current selection', async () => {
      await session.setCurrentFeatures(feature);
      await app.maps.setActiveMap(obliqueMap.name);
      expect(session.firstFeature).to.be.null;
    });

    describe('image changed listener', async () => {
      beforeEach(async () => {
        await app.maps.setActiveMap(obliqueMap.name);
      });

      it('should clear the current selection', async () => {
        await session.setCurrentFeatures(feature);
        obliqueMap.imageChanged.raiseEvent();
        expect(session.firstFeature).to.be.null;
      });
    });
  });

  describe('changing the active map from an oblique map', () => {
    let session;

    before(async () => {
      await app.maps.setActiveMap(obliqueMap.name);
      session = startSelectFeaturesSession(app, layer, undefined, SelectionMode.SINGLE);
    });

    after(async () => {
      session.stop();
      await app.maps.setActiveMap(defaultMap.name);
    });

    it('should no longer listen to image changed', async () => {
      await app.maps.setActiveMap(defaultMap.name);
      await session.setCurrentFeatures(feature);
      obliqueMap.imageChanged.raiseEvent();
      expect(session.firstFeature).to.equal(feature);
    });

    it('should reset switchEnabled, if a feature was selected', async () => {
      await session.setCurrentFeatures(feature);
      await app.maps.setActiveMap(defaultMap.name);
      expect(obliqueMap.switchEnabled).to.be.true;
    });
  });
});
