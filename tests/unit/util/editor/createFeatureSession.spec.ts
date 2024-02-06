import { Feature } from 'ol';
import type { LineString } from 'ol/geom.js';
import { expect } from 'chai';
import sinon from 'sinon';
import { Cartesian2, HeightReference } from '@vcmap-cesium/engine';

import startCreateFeatureSession, {
  CreateFeatureSession,
} from '../../../../src/util/editor/createFeatureSession.js';
import { GeometryType } from '../../../../src/util/editor/editorSessionHelpers.js';
import VcsApp from '../../../../src/vcsApp.js';
import VectorLayer from '../../../../src/layer/vectorLayer.js';
import InteractionChain from '../../../../src/interaction/interactionChain.js';
import {
  EventType,
  ModificationKeyType,
  PointerEventType,
  PointerKeyType,
} from '../../../../src/interaction/interactionType.js';
import { createSync } from '../../../../src/layer/vectorSymbols.js';
import { MapEvent, ObliqueMap, OpenlayersMap } from '../../../../index.js';

describe('create feature session', () => {
  let app: VcsApp;
  let layer: VectorLayer;
  let defaultMap: OpenlayersMap;
  let mapEvent: Pick<MapEvent, 'map' | 'windowPosition' | 'pointerEvent'>;

  before(async () => {
    defaultMap = new OpenlayersMap({});
    mapEvent = {
      map: defaultMap,
      windowPosition: new Cartesian2(0, 0),
      pointerEvent: PointerEventType.UP,
    };
    app = new VcsApp();
    app.maps.add(defaultMap);
    await app.maps.setActiveMap(defaultMap.name);
    layer = new VectorLayer({});
    app.layers.add(layer);
  });

  after(() => {
    app.destroy();
  });

  describe('starting a session', () => {
    let session: CreateFeatureSession<GeometryType.LineString>;

    beforeEach(() => {
      session = startCreateFeatureSession(app, layer, GeometryType.LineString);
    });

    afterEach(() => {
      session.stop();
    });

    it('should add a an exclusive listener to the event handler', () => {
      expect(app.maps.eventHandler.interactions[3]).to.be.an.instanceof(
        InteractionChain,
      );
    });

    it('should trigger feature created, if a feature is created', async () => {
      const spy = sinon.spy();
      session.featureCreated.addEventListener(spy);
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
        ...mapEvent,
      });
      expect(spy).to.have.been.calledOnce;
    });

    it('should add created features to the layer', async () => {
      let feature;
      session.featureCreated.addEventListener((f) => {
        feature = f;
      });
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
        ...mapEvent,
      });
      expect(layer.getFeatures()).to.include(feature);
    });

    it('should set a created feature to createSync', async () => {
      let feature;
      session.featureCreated.addEventListener((f) => {
        feature = f;
      });
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
        ...mapEvent,
      });
      expect(feature).to.have.property(createSync, true);
    });

    it('should remove createSync, once the feature is finished', async () => {
      let feature;
      session.featureCreated.addEventListener((f) => {
        feature = f;
      });
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
        ...mapEvent,
      });
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [2, 2, 3],
        ...mapEvent,
      });
      session.finish();
      expect(feature).to.not.have.property(createSync);
    });

    it('should remove features, if they are not valid after finishing', async () => {
      let feature;
      session.featureCreated.addEventListener((f) => {
        feature = f;
      });
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
        ...mapEvent,
      });
      session.finish();
      expect(layer.getFeatures()).to.not.include(feature);
    });

    it('should continue creating features, after a feature is created', async () => {
      const spy = sinon.spy();
      session.featureCreated.addEventListener(spy);
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
        ...mapEvent,
      });
      session.finish();
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
        ...mapEvent,
      });
      expect(spy).to.have.been.calledTwice;
    });

    it('should trigger finish on finish, passing null if the feature is not valid', async () => {
      const spy = sinon.spy();
      session.creationFinished.addEventListener(spy);
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
        ...mapEvent,
      });
      session.finish();
      expect(spy).to.have.been.calledWith(null);
    });

    it('should trigger finish on finish, passing the feature if the feature is valid', async () => {
      const spy = sinon.spy();
      session.creationFinished.addEventListener(spy);
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
        ...mapEvent,
      });
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [2, 2, 0],
        positionOrPixel: [2, 2, 3],
        ...mapEvent,
      });
      session.finish();
      expect(spy).to.have.been.called;
      expect(spy.getCall(0).args[0]).to.be.an.instanceof(Feature);
    });
  });

  describe('stopping a session', () => {
    let session: CreateFeatureSession<GeometryType.LineString>;

    beforeEach(() => {
      session = startCreateFeatureSession(app, layer, GeometryType.LineString);
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

    it('should finish the current interaction', () => {
      const spy = sinon.spy();
      session.creationFinished.addEventListener(spy);
      session.stop();
      expect(spy).to.have.been.called;
    });
  });

  describe('changing the active map', () => {
    let session: CreateFeatureSession<GeometryType.LineString>;
    let otherMap: OpenlayersMap;

    before(() => {
      otherMap = new OpenlayersMap({});
      app.maps.add(otherMap);
    });

    beforeEach(() => {
      session = startCreateFeatureSession(app, layer, GeometryType.LineString);
    });

    afterEach(async () => {
      session.stop();
      await app.maps.setActiveMap(defaultMap.name);
      app.maps.remove(otherMap);
      otherMap.destroy();
    });

    it('should finish the current interaction', async () => {
      const spy = sinon.spy();
      session.creationFinished.addEventListener(spy);
      await app.maps.setActiveMap(otherMap.name);
      expect(spy).to.have.been.calledOnce;
    });

    it('should continue on the new map', async () => {
      const spy = sinon.spy();
      session.featureCreated.addEventListener(spy);
      await app.maps.setActiveMap(otherMap.name);
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
        ...mapEvent,
      });
      expect(spy).to.have.been.calledOnce;
    });
  });

  describe('changing the active map to an oblique map', () => {
    let session: CreateFeatureSession<GeometryType.LineString>;
    let otherMap: ObliqueMap;

    before(() => {
      otherMap = new ObliqueMap({});
      app.maps.add(otherMap);
    });

    beforeEach(() => {
      session = startCreateFeatureSession(app, layer, GeometryType.LineString);
    });

    afterEach(async () => {
      session.stop();
      await app.maps.setActiveMap(defaultMap.name);
    });

    after(() => {
      app.maps.remove(otherMap);
      otherMap.destroy();
    });

    it('should finish the current interaction', async () => {
      const spy = sinon.spy();
      session.creationFinished.addEventListener(spy);
      await app.maps.setActiveMap(otherMap.name);
      expect(spy).to.have.been.calledOnce;
    });

    it('should continue on the new map', async () => {
      const spy = sinon.spy();
      session.featureCreated.addEventListener(spy);
      await app.maps.setActiveMap(otherMap.name);
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
        ...mapEvent,
      });
      expect(spy).to.have.been.calledOnce;
    });

    describe('image changed listener', () => {
      beforeEach(async () => {
        await app.maps.setActiveMap(otherMap.name);
      });

      it('should finish the current interaction', () => {
        const spy = sinon.spy();
        session.creationFinished.addEventListener(spy);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        otherMap.imageChanged?.raiseEvent();
        expect(spy).to.have.been.calledOnce;
      });

      it('should continue on new image', async () => {
        const spy = sinon.spy();
        session.featureCreated.addEventListener(spy);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        otherMap.imageChanged.raiseEvent();
        await app.maps.eventHandler.interactions[3].pipe({
          type: EventType.CLICK,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          position: [1, 2, 0],
          positionOrPixel: [1, 2, 3],
          ...mapEvent,
        });
        expect(spy).to.have.been.calledOnce;
      });
    });
  });

  describe('changing the active map from an oblique map', () => {
    let session: CreateFeatureSession<GeometryType.LineString>;
    let obliqueMap: ObliqueMap;

    before(async () => {
      obliqueMap = new ObliqueMap({});
      app.maps.add(obliqueMap);
      await app.maps.setActiveMap(obliqueMap.name);
      session = startCreateFeatureSession(app, layer, GeometryType.LineString);
      await app.maps.setActiveMap(defaultMap.name);
    });

    after(() => {
      session.stop();
      app.maps.remove(obliqueMap);
      obliqueMap.destroy();
    });

    it('should no longer listen to image changed', () => {
      const spy = sinon.spy();
      session.creationFinished.addEventListener(spy);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      obliqueMap.imageChanged.raiseEvent();
      expect(spy).to.not.have.been.called;
    });
  });

  describe('stopping the session in the finished callback', () => {
    let session: CreateFeatureSession<GeometryType.Point>;

    beforeEach(() => {
      session = startCreateFeatureSession(app, layer, GeometryType.Point);
    });

    it('should not recreate the creation interaction', async () => {
      const interactionChain = app.maps.eventHandler
        .interactions[3] as InteractionChain;
      session.creationFinished.addEventListener(() => session.stop());

      await interactionChain.pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
        ...mapEvent,
      });
      expect(app.maps.eventHandler).to.not.include(interactionChain);
      expect(interactionChain.chain).to.be.empty;
    });

    it('should not call finished twice', async () => {
      const spy = sinon.spy();
      session.creationFinished.addEventListener(spy);
      session.creationFinished.addEventListener(() => session.stop());

      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
        ...mapEvent,
      });
      expect(spy).to.have.been.calledOnce;
    });
  });

  describe('forcefully removing a session', () => {
    let session: CreateFeatureSession<GeometryType.LineString>;

    beforeEach(() => {
      session = startCreateFeatureSession(app, layer, GeometryType.LineString);
    });

    it('should stop the session', () => {
      const spy = sinon.spy();
      session.stopped.addEventListener(spy);
      app.maps.eventHandler.removeExclusive();
      expect(spy).to.have.been.called;
    });
  });

  describe('altitude mode handling', () => {
    describe('setting the feature altitude mode on the session', () => {
      let session: CreateFeatureSession<GeometryType.LineString>;

      beforeEach(() => {
        session = startCreateFeatureSession(
          app,
          layer,
          GeometryType.LineString,
        );
      });

      afterEach(() => {
        session.stop();
      });

      it('should set the altitude mode on the next feature', async () => {
        session.featureAltitudeMode = 'absolute';
        let feature: Feature<LineString> | undefined;
        session.featureCreated.addEventListener((f) => {
          feature = f;
        });
        await app.maps.eventHandler.interactions[3].pipe({
          type: EventType.CLICK,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          position: [1, 2, 0],
          positionOrPixel: [1, 2, 3],
          ...mapEvent,
        });
        expect(feature?.get('olcs_altitudeMode')).to.equal('absolute');
      });

      it('should set the altitude mode on a feature in creation', async () => {
        let feature: Feature<LineString> | undefined;
        session.featureCreated.addEventListener((f) => {
          feature = f;
        });
        await app.maps.eventHandler.interactions[3].pipe({
          type: EventType.CLICK,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          position: [1, 2, 0],
          positionOrPixel: [1, 2, 3],
          ...mapEvent,
        });
        session.featureAltitudeMode = 'absolute';
        expect(feature?.get('olcs_altitudeMode')).to.equal('absolute');
      });

      it('should no longer set the altitude mode of created features', async () => {
        let feature: Feature<LineString> | undefined;
        session.featureCreated.addEventListener((f) => {
          feature = f;
        });
        await app.maps.eventHandler.interactions[3].pipe({
          type: EventType.CLICK,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          position: [1, 2, 0],
          positionOrPixel: [1, 2, 3],
          ...mapEvent,
        });
        await app.maps.eventHandler.interactions[3].pipe({
          type: EventType.DBLCLICK,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          position: [2, 2, 0],
          positionOrPixel: [1, 2, 3],
          ...mapEvent,
        });
        session.featureAltitudeMode = 'absolute';
        expect(feature?.get('olcs_altitudeMode')).to.be.undefined;
      });

      it('should change the picking behavior', () => {
        session.featureAltitudeMode = 'absolute';
        expect(app.maps.eventHandler.featureInteraction.pickPosition).to.equal(
          EventType.CLICKMOVE | EventType.DRAGEVENTS,
        );
      });
    });

    describe('unsetting the feature altitude mode on the session', () => {
      let session: CreateFeatureSession<GeometryType.LineString>;

      beforeEach(() => {
        session = startCreateFeatureSession(
          app,
          layer,
          GeometryType.LineString,
        );
        session.featureAltitudeMode = 'absolute';
      });

      afterEach(() => {
        session.stop();
      });

      it('should not set the altitude mode on the next feature', async () => {
        session.featureAltitudeMode = undefined;
        let feature: Feature<LineString> | undefined;
        session.featureCreated.addEventListener((f) => {
          feature = f;
        });
        await app.maps.eventHandler.interactions[3].pipe({
          type: EventType.CLICK,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          position: [1, 2, 0],
          positionOrPixel: [1, 2, 3],
          ...mapEvent,
        });
        expect(feature?.get('olcs_altitudeMode')).to.be.undefined;
      });

      it('should unset the altitude mode on a feature in creation', async () => {
        let feature: Feature<LineString> | undefined;
        session.featureCreated.addEventListener((f) => {
          feature = f;
        });
        await app.maps.eventHandler.interactions[3].pipe({
          type: EventType.CLICK,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          position: [1, 2, 0],
          positionOrPixel: [1, 2, 3],
          ...mapEvent,
        });
        session.featureAltitudeMode = undefined;
        expect(feature?.get('olcs_altitudeMode')).to.be.undefined;
      });

      it('should no longer set the altitude mode of created features', async () => {
        let feature: Feature<LineString> | undefined;
        session.featureCreated.addEventListener((f) => {
          feature = f;
        });
        await app.maps.eventHandler.interactions[3].pipe({
          type: EventType.CLICK,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          position: [1, 2, 0],
          positionOrPixel: [1, 2, 3],
          ...mapEvent,
        });
        await app.maps.eventHandler.interactions[3].pipe({
          type: EventType.DBLCLICK,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          position: [2, 2, 0],
          positionOrPixel: [1, 2, 3],
          ...mapEvent,
        });
        session.featureAltitudeMode = undefined;
        expect(feature?.get('olcs_altitudeMode')).to.equal('absolute');
      });

      it('should change the picking behavior', () => {
        session.featureAltitudeMode = undefined;
        expect(app.maps.eventHandler.featureInteraction.pickPosition).to.equal(
          EventType.NONE,
        );
      });
    });

    describe('setting the altitude mode on the feature currently in creation', () => {
      let session: CreateFeatureSession<GeometryType.LineString>;
      let feature: Feature<LineString> | undefined;

      beforeEach(async () => {
        session = startCreateFeatureSession(
          app,
          layer,
          GeometryType.LineString,
        );
        session.featureCreated.addEventListener((f) => {
          feature = f;
        });
        await app.maps.eventHandler.interactions[3].pipe({
          type: EventType.CLICK,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          position: [1, 2, 0],
          positionOrPixel: [1, 2, 3],
          ...mapEvent,
        });
      });

      afterEach(() => {
        session.stop();
      });

      it('should not set the feature altitude mode on the session', () => {
        feature?.set('olcs_altitudeMode', 'absolute');
        expect(session.featureAltitudeMode).to.be.undefined;
      });

      it('should no longer change picking behavior once created', async () => {
        await app.maps.eventHandler.interactions[3].pipe({
          type: EventType.DBLCLICK,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          position: [2, 2, 0],
          positionOrPixel: [1, 2, 3],
          ...mapEvent,
        });
        feature?.set('olcs_altitudeMode', 'absolute');
        expect(app.maps.eventHandler.featureInteraction.pickPosition).to.equal(
          EventType.NONE,
        );
      });

      it('should change the picking behavior while creating', () => {
        feature?.set('olcs_altitudeMode', 'absolute');
        expect(app.maps.eventHandler.featureInteraction.pickPosition).to.equal(
          EventType.CLICKMOVE | EventType.DRAGEVENTS,
        );
      });

      it('should revert picking behavior after creation is finished', async () => {
        feature?.set('olcs_altitudeMode', 'absolute');
        await app.maps.eventHandler.interactions[3].pipe({
          type: EventType.DBLCLICK,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          position: [2, 2, 0],
          positionOrPixel: [1, 2, 3],
          ...mapEvent,
        });
        expect(app.maps.eventHandler.featureInteraction.pickPosition).to.equal(
          EventType.NONE,
        );
      });
    });

    describe('changing the layer vector properties altitude mode', () => {
      let session: CreateFeatureSession<GeometryType.LineString>;
      let currentAltitudeMode: HeightReference;

      beforeEach(() => {
        currentAltitudeMode = layer.vectorProperties.altitudeMode;
        session = startCreateFeatureSession(
          app,
          layer,
          GeometryType.LineString,
        );
      });

      afterEach(() => {
        session.stop();
        layer.vectorProperties.altitudeMode = currentAltitudeMode;
      });

      it('should not change picking behavior, if there is no feature in creation and feature altitude mode is set', () => {
        session.featureAltitudeMode = 'clampToGround';
        layer.vectorProperties.altitudeMode = HeightReference.NONE;
        expect(app.maps.eventHandler.featureInteraction.pickPosition).to.equal(
          EventType.NONE,
        );
      });

      it('should not change picking behavior, if there is a feature in creation with altitude mode set', () => {
        session.featureAltitudeMode = 'clampToGround';
        layer.vectorProperties.altitudeMode = HeightReference.NONE;
        expect(app.maps.eventHandler.featureInteraction.pickPosition).to.equal(
          EventType.NONE,
        );
      });

      it("should change picking behavior, 'without an altitude mode set anywhere else", async () => {
        let feature: Feature<LineString> | undefined;
        session.featureCreated.addEventListener((f) => {
          feature = f;
        });
        await app.maps.eventHandler.interactions[3].pipe({
          type: EventType.CLICK,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          position: [1, 2, 0],
          positionOrPixel: [1, 2, 3],
          ...mapEvent,
        });
        feature?.set('olcs_altitudeMode', 'clampToGround');
        layer.vectorProperties.altitudeMode = HeightReference.NONE;
        expect(app.maps.eventHandler.featureInteraction.pickPosition).to.equal(
          EventType.NONE,
        );
      });
    });

    describe('stopping a session with a feature altitude mode of absolute', () => {
      let session: CreateFeatureSession<GeometryType.LineString> | undefined;
      let currentAltitudeMode: HeightReference;
      let feature: Feature<LineString> | undefined;

      beforeEach(async () => {
        currentAltitudeMode = layer.vectorProperties.altitudeMode;
        session = startCreateFeatureSession(
          app,
          layer,
          GeometryType.LineString,
        );
        session.featureCreated.addEventListener((f) => {
          feature = f;
        });
        await app.maps.eventHandler.interactions[3].pipe({
          type: EventType.CLICK,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          position: [1, 2, 0],
          positionOrPixel: [1, 2, 3],
          ...mapEvent,
        });
        session.featureAltitudeMode = 'absolute';
        session.stop();
      });

      afterEach(() => {
        layer.vectorProperties.altitudeMode = currentAltitudeMode;
      });

      it('should reset picking', () => {
        expect(app.maps.eventHandler.featureInteraction.pickPosition).to.equal(
          EventType.CLICK,
        );
      });

      it('should no longer listen to feature changes', () => {
        feature?.set('olcs_altitudeMode', 'clampToGround');
        feature?.set('olcs_altitudeMode', 'absolute');
        expect(app.maps.eventHandler.featureInteraction.pickPosition).to.equal(
          EventType.CLICK,
        );
      });

      it('should no longer listen to layer vector property changes', () => {
        layer.vectorProperties.altitudeMode = HeightReference.NONE;
        expect(app.maps.eventHandler.featureInteraction.pickPosition).to.equal(
          EventType.CLICK,
        );
      });
    });

    describe('starting a session with a layer with absolute altitude mode', () => {
      let session: CreateFeatureSession<GeometryType.LineString>;
      let initialAltitudeMode: HeightReference;

      beforeEach(() => {
        initialAltitudeMode = layer.vectorProperties.altitudeMode;
        layer.vectorProperties.altitudeMode = HeightReference.NONE;

        session = startCreateFeatureSession(
          app,
          layer,
          GeometryType.LineString,
        );
      });

      afterEach(() => {
        session.stop();
        layer.vectorProperties.altitudeMode = initialAltitudeMode;
      });

      it('should change the picking', () => {
        expect(app.maps.eventHandler.featureInteraction.pickPosition).to.equal(
          EventType.CLICKMOVE | EventType.DRAGEVENTS,
        );
      });
    });
  });
});
