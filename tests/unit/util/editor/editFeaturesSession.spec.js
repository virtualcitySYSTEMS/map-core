import { Cartesian2, Math as CesiumMath } from '@vcmap-cesium/engine';
import { Point } from 'ol/geom.js';
import {
  AXIS_AND_PLANES,
  createSync,
  EventType, mercatorToCartesian,
  ModificationKeyType,
  ObliqueMap,
  OpenlayersMap,
  PointerKeyType,
  startEditFeaturesSession,
  TransformationMode,
} from '../../../../index.js';
import VcsApp from '../../../../src/vcsApp.js';
import VectorLayer from '../../../../src/layer/vectorLayer.js';
import InteractionChain from '../../../../src/interaction/interactionChain.js';
import {
  createFeatureWithId,
  createHandlerFeature,
  patchPickRay,
} from './transformation/setupTransformationHandler.js';
import { getVcsEventSpy, getCesiumMap } from '../../helpers/cesiumHelpers.js';


describe('startEditFeaturesSession', () => {
  let app;
  let layer;
  let defaultMap;
  let obliqueMap;
  let cesiumMap;

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
  });

  after(() => {
    app.destroy();
  });

  describe('starting a TRANSLATE session', () => {
    /** @type {EditFeaturesSession} */
    let session;

    before(() => {
      session = startEditFeaturesSession(app, layer, TransformationMode.TRANSLATE);
    });

    after(() => {
      session.stop();
    });

    it('should set the mode on the session', () => {
      expect(session.mode).to.equal(TransformationMode.TRANSLATE);
    });

    it('should add a an exclusive listener to the event handler', () => {
      expect(app.maps.eventHandler.interactions[3]).to.be.an.instanceof(InteractionChain);
    });

    it('should add the translate interaction', async () => {
      const point = new Point([1, 1, 1]);
      await session.featureSelection.setSelectionSet([createFeatureWithId(point)]);
      const feature = createHandlerFeature(AXIS_AND_PLANES.X);
      await app.maps.eventHandler.interactions[3].pipe({
        map: app.maps.activeMap,
        feature,
        positionOrPixel: [2, 1, 1],
        type: EventType.DRAGSTART,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[3].pipe({
        map: app.maps.activeMap,
        feature,
        positionOrPixel: [3, 1, 1],
        type: EventType.DRAG,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[3].pipe({
        map: app.maps.activeMap,
        feature,
        positionOrPixel: [3, 1, 1],
        type: EventType.DRAGEND,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      expect(point.getCoordinates()).to.have.ordered.members([2, 1, 1]);
    });
  });

  describe('starting a ROTATE session', () => {
    /** @type {EditFeaturesSession} */
    let session;

    before(() => {
      session = startEditFeaturesSession(app, layer, TransformationMode.ROTATE);
    });

    after(() => {
      session.stop();
    });

    it('should set the mode on the session', () => {
      expect(session.mode).to.equal(TransformationMode.ROTATE);
    });

    it('should add a an exclusive listener to the event handler', () => {
      expect(app.maps.eventHandler.interactions[3]).to.be.an.instanceof(InteractionChain);
    });

    it('should add the rotate interaction', async () => {
      const point1 = new Point([1, 1, 0]);
      const point2 = new Point([-1, -1, 0]);
      await session.featureSelection.setSelectionSet([
        createFeatureWithId(point1),
        createFeatureWithId(point2),
      ]);
      const feature = createHandlerFeature(AXIS_AND_PLANES.X);
      await app.maps.eventHandler.interactions[3].pipe({
        map: app.maps.activeMap,
        feature,
        positionOrPixel: [0.5, 0.5, 1],
        type: EventType.DRAGSTART,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[3].pipe({
        map: app.maps.activeMap,
        feature,
        positionOrPixel: [-0.5, -0.5, 1],
        type: EventType.DRAG,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[3].pipe({
        map: app.maps.activeMap,
        feature,
        positionOrPixel: [-0.5, -0.5, 1],
        type: EventType.DRAGEND,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      expect(point1.getCoordinates().map(c => Math.round(c))).to.have.ordered.members([-1, -1, 0]);
      expect(point2.getCoordinates().map(c => Math.round(c))).to.have.ordered.members([1, 1, 0]);
    });
  });

  describe('starting a SCALE session', () => {
    /** @type {EditFeaturesSession} */
    let session;

    before(() => {
      session = startEditFeaturesSession(app, layer, TransformationMode.SCALE);
    });

    after(() => {
      session.stop();
    });

    it('should set the mode on the session', () => {
      expect(session.mode).to.equal(TransformationMode.SCALE);
    });

    it('should add a an exclusive listener to the event handler', () => {
      expect(app.maps.eventHandler.interactions[3]).to.be.an.instanceof(InteractionChain);
    });

    it('should add the scale interaction', async () => {
      const point1 = new Point([1, 1, 0]);
      const point2 = new Point([-1, -1, 0]);
      await session.featureSelection.setSelectionSet([
        createFeatureWithId(point1),
        createFeatureWithId(point2),
      ]);
      const feature = createHandlerFeature(AXIS_AND_PLANES.X);
      await app.maps.eventHandler.interactions[3].pipe({
        map: app.maps.activeMap,
        feature,
        positionOrPixel: [0.5, 0.5, 1],
        type: EventType.DRAGSTART,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[3].pipe({
        map: app.maps.activeMap,
        feature,
        positionOrPixel: [-0.5, -0.5, 1],
        type: EventType.DRAG,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[3].pipe({
        map: app.maps.activeMap,
        feature,
        positionOrPixel: [-0.5, -0.5, 1],
        type: EventType.DRAGEND,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      expect(point1.getCoordinates().map(c => Math.round(c))).to.have.ordered.members([-1, 1, 0]);
      expect(point2.getCoordinates().map(c => Math.round(c))).to.have.ordered.members([1, -1, 0]);
    });
  });

  describe('starting a EXTRUDE session', () => {
    /** @type {EditFeaturesSession} */
    let session;

    before(async () => {
      await app.maps.setActiveMap(cesiumMap.name);
      session = startEditFeaturesSession(app, layer, TransformationMode.EXTRUDE);
    });

    after(async () => {
      session.stop();
      await app.maps.setActiveMap(defaultMap.name);
    });

    it('should set the mode on the session', () => {
      expect(session.mode).to.equal(TransformationMode.EXTRUDE);
    });

    it('should add a an exclusive listener to the event handler', () => {
      expect(app.maps.eventHandler.interactions[3]).to.be.an.instanceof(InteractionChain);
    });

    describe('extruding a feature', () => {
      let stub;
      let restorePick;
      let feature;

      before(async () => {
        restorePick = patchPickRay([
          mercatorToCartesian([1, 1, 1]),
          mercatorToCartesian([1, 1, 4]),
          mercatorToCartesian([1, 1, 4]),
        ]);
        stub = sinon.stub(cesiumMap, 'getHeightFromTerrain').callsFake(async (coords) => {
          coords.forEach((c) => { c[2] = 1; });
          return coords;
        });

        feature = createFeatureWithId(new Point([1, 1, 0]));
        await session.featureSelection.setSelectionSet([
          feature,
        ]);
        const handlerFeature = createHandlerFeature(AXIS_AND_PLANES.Z);

        await app.maps.eventHandler.interactions[3].pipe({
          map: app.maps.activeMap,
          feature: handlerFeature,
          positionOrPixel: [1, 1, 1],
          windowPosition: new Cartesian2(0, 0),
          type: EventType.DRAGSTART,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[3].pipe({
          map: app.maps.activeMap,
          feature: handlerFeature,
          positionOrPixel: [1, 1, 4],
          windowPosition: new Cartesian2(0, 0),
          type: EventType.DRAG,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[3].pipe({
          map: app.maps.activeMap,
          feature: handlerFeature,
          positionOrPixel: [1, 1, 4],
          windowPosition: new Cartesian2(0, 0),
          type: EventType.DRAGEND,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
      });

      after(() => {
        stub.restore();
        restorePick();
      });

      it('should add the extruded interaction', () => {
        expect(feature.get('olcs_extrudedHeight')).to.exist.and.to.be.closeTo(3, CesiumMath.EPSILON5);
      });

      it('it should ensure the feature is absolute', () => {
        expect(feature.get('olcs_altitudeMode')).to.exist.and.equal('absolute');
      });

      it('should place the feature onto the terrain', () => {
        expect(feature.getGeometry().getCoordinates()).to.have.ordered.members([1, 1, 1]);
      });
    });
  });

  describe('starting a EXTRUDE session without having an active cesium map', () => {
    /** @type {EditFeaturesSession} */
    let session;

    before(async () => {
      session = startEditFeaturesSession(app, layer, TransformationMode.EXTRUDE);
    });

    after(async () => {
      session.stop();
    });

    it('should set the mode to TRANSLATE instead', () => {
      expect(session.mode).to.equal(TransformationMode.TRANSLATE);
    });
  });

  describe('changing the mode', () => {
    /** @type {EditFeaturesSession} */
    let session;

    beforeEach(() => {
      session = startEditFeaturesSession(app, layer, TransformationMode.TRANSLATE);
    });

    afterEach(() => {
      session.stop();
    });

    it('should change the mode', () => {
      session.setMode(TransformationMode.ROTATE);
      expect(session.mode).to.equal(TransformationMode.ROTATE);
    });

    it('should call mode changed', () => {
      const spy = getVcsEventSpy(session.modeChanged);
      session.setMode(TransformationMode.ROTATE);
      expect(spy).to.have.been.calledWith(TransformationMode.ROTATE);
    });

    it('should only call mode changed once', () => {
      const spy = getVcsEventSpy(session.modeChanged);
      session.setMode(TransformationMode.ROTATE);
      session.setMode(TransformationMode.ROTATE);
      expect(spy).to.have.been.calledOnce;
      expect(spy).to.have.been.calledWith(TransformationMode.ROTATE);
    });

    it('should not allow changing the mode to extrude, if the map is not a cesium map', () => {
      session.setMode(TransformationMode.EXTRUDE);
      expect(session.mode).to.equal(TransformationMode.TRANSLATE);
    });
  });

  describe('feature selection', () => {
    describe('selecting a feature', () => {
      let feature;

      before(async () => {
        feature = createFeatureWithId(new Point([0, 0, 0]));
      });

      after(async () => { // catch all if oblique spec throws
        await app.maps.setActiveMap(defaultMap.name);
      });

      describe('selecting a feature', () => {
        let session;

        before(async () => {
          session = startEditFeaturesSession(app, layer);
          await session.featureSelection.setSelectionSet([feature]);
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

        it('should set allowPicking false', async () => {
          expect(feature.getProperties()).to.have.property('olcs_allowPicking', false);
        });
      });

      describe('oblique map handling', () => {
        it('should set switchEnabled false on oblique maps', async () => {
          const session = startEditFeaturesSession(app, layer);
          await app.maps.setActiveMap(obliqueMap.name);
          await session.featureSelection.setSelectionSet([feature]);
          expect(obliqueMap.switchEnabled).to.be.false;
          session.stop();
          await app.maps.setActiveMap(defaultMap.name);
        });
      });
    });

    describe('clearing the feature selection', () => {
      let feature;

      before(async () => {
        feature = createFeatureWithId(new Point([0, 0, 0]));
        layer.addFeatures([feature]);
      });

      after(async () => { // catch all if oblique spec throws
        await app.maps.setActiveMap(defaultMap.name);
        layer.removeFeaturesById([feature.getId()]);
      });

      describe('deselecting a feature', () => {
        let session;

        before(async () => {
          session = startEditFeaturesSession(app, layer);
          await session.featureSelection.setSelectionSet([feature]);
          session.featureSelection.clear();
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

        it('should unset allowPicking false', async () => {
          expect(feature.getProperties()).to.not.have.property('olcs_allowPicking');
        });
      });

      describe('oblique map handling', () => {
        it('should set switchEnabled true if unselecting a feature', async () => {
          const session = startEditFeaturesSession(app, layer);
          await app.maps.setActiveMap(obliqueMap.name);
          await session.featureSelection.setSelectionSet([feature]);
          await session.featureSelection.clear();
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
          session = startEditFeaturesSession(app, layer);
          await session.featureSelection.setSelectionSet([feature1, feature2]);
          await session.featureSelection.setSelectionSet([feature1, feature3]);
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

        it('should unset/set allowPicking accordingly', async () => {
          expect(feature1.getProperties()).to.have.property('olcs_allowPicking', false);
          expect(feature2.getProperties()).to.not.have.property('olcs_allowPicking');
          expect(feature3.getProperties()).to.have.property('olcs_allowPicking', false);
        });
      });

      describe('oblique map handling', () => {
        it('should set switchEnabled false on oblique maps', async () => {
          const session = startEditFeaturesSession(app, layer);
          await app.maps.setActiveMap(obliqueMap.name);
          await session.featureSelection.setSelectionSet([feature1, feature2]);
          await session.featureSelection.setSelectionSet([feature1, feature3]);
          expect(obliqueMap.switchEnabled).to.be.false;
          session.stop();
          await app.maps.setActiveMap(defaultMap.name);
        });
      });
    });

    describe('unselecting a feature with allowPicking set', () => {
      it('should maintain allowPicking', async () => {
        const feature = createFeatureWithId(new Point([0, 0, 0]));
        feature.set('olcs_allowPicking', true);
        layer.addFeatures([feature]);

        const session = startEditFeaturesSession(app, layer);
        await session.featureSelection.setSelectionSet([feature]);
        expect(feature.get('olcs_allowPicking')).to.be.false;
        session.featureSelection.clear();
        expect(feature.get('olcs_allowPicking')).to.be.true;
      });
    });
  });

  describe('stopping a session', () => {
    let session;

    beforeEach(() => {
      session = startEditFeaturesSession(app, layer);
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
      let feature;

      beforeEach(async () => {
        feature = createFeatureWithId(new Point([0, 0, 0]));
        await session.featureSelection.setSelectionSet([feature]);
        layer.addFeatures([feature]);
      });

      afterEach(() => {
        layer.removeFeaturesById([feature.getId()]);
      });

      it('should remove create sync on the features', async () => {
        session.stop();
        expect(feature).to.not.have.property(createSync);
      });

      it('should unhighlight the feature', async () => {
        session.stop();
        expect(layer.featureVisibility.highlightedObjects).to.not.have.property(feature.getId());
      });

      it('should unset allowPicking false', async () => {
        session.stop();
        expect(feature.getProperties()).to.not.have.property('olcs_allowPicking');
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
      session = startEditFeaturesSession(app, layer);
    });

    afterEach(async () => {
      session.stop();
      await app.maps.setActiveMap(defaultMap.name);
    });

    it('should clear the current selection', async () => {
      await session.featureSelection.setSelectionSet([createFeatureWithId(new Point([0, 0, 0]))]);
      await app.maps.setActiveMap(obliqueMap.name);
      expect(session.featureSelection.selectedFeatures).to.be.empty;
    });

    describe('image changed listener', async () => {
      beforeEach(async () => {
        await app.maps.setActiveMap(obliqueMap.name);
      });

      it('should clear the current selection', async () => {
        await session.featureSelection.setSelectionSet([createFeatureWithId(new Point([0, 0, 0]))]);
        obliqueMap.imageChanged.raiseEvent();
        expect(session.featureSelection.selectedFeatures).to.be.empty;
      });
    });
  });

  describe('changing the active map from an oblique map', () => {
    let session;

    before(async () => {
      await app.maps.setActiveMap(obliqueMap.name);
      session = startEditFeaturesSession(app, layer);
    });

    after(async () => {
      session.stop();
      await app.maps.setActiveMap(defaultMap.name);
    });

    it('should clear the current selection', async () => {
      await session.featureSelection.setSelectionSet([createFeatureWithId(new Point([0, 0, 0]))]);
      await app.maps.setActiveMap(defaultMap.name);
      expect(session.featureSelection.selectedFeatures).to.be.empty;
    });

    it('should no longer listen to image changed', async () => {
      await app.maps.setActiveMap(defaultMap.name);
      const feature = createFeatureWithId(new Point([0, 0, 0]));
      await session.featureSelection.setSelectionSet([feature]);
      obliqueMap.imageChanged.raiseEvent();
      expect(session.featureSelection.selectedFeatures).to.include.members([feature]);
    });

    it('should reset switchEnabled, if a feature was selected', async () => {
      await session.featureSelection.setSelectionSet([createFeatureWithId(new Point([0, 0, 0]))]);
      await app.maps.setActiveMap(defaultMap.name);
      expect(obliqueMap.switchEnabled).to.be.true;
    });
  });

  describe('changing the active map from a cesium map with extrude mode on', () => {
    let session;

    beforeEach(async () => {
      await app.maps.setActiveMap(cesiumMap.name);
      session = startEditFeaturesSession(app, layer, TransformationMode.EXTRUDE);
    });

    afterEach(async () => {
      session.stop();
      await app.maps.setActiveMap(defaultMap.name);
    });

    it('should change the mode to TRANSLATE', async () => {
      await app.maps.setActiveMap(defaultMap.name);
      expect(session.mode).to.equal(TransformationMode.TRANSLATE);
    });

    it('should call modeChanged', async () => {
      const modeChangeListener = getVcsEventSpy(session.modeChanged);
      await app.maps.setActiveMap(defaultMap.name);
      expect(modeChangeListener).to.have.been.calledWithExactly(TransformationMode.TRANSLATE);
    });
  });

  describe('forcefully removing a session', () => {
    let session;

    beforeEach(() => {
      session = startEditFeaturesSession(app, layer);
    });

    it('should stop the session', () => {
      const spy = sinon.spy();
      session.stopped.addEventListener(spy);
      app.maps.eventHandler.removeExclusive();
      expect(spy).to.have.been.called;
    });
  });
});
