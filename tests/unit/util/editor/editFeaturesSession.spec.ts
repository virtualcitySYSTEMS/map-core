import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';

import {
  Cartesian2,
  Cartesian3,
  Math as CesiumMath,
  Ray,
} from '@vcmap-cesium/engine';
import { Point } from 'ol/geom.js';
import Feature from 'ol/Feature.js';
import { unByKey } from 'ol/Observable.js';
import { Coordinate } from 'ol/coordinate.js';

import {
  AxisAndPlanes,
  CesiumMap,
  createSync,
  EditFeaturesSession,
  EventType,
  mercatorToCartesian,
  ModificationKeyType,
  ObliqueMap,
  OpenlayersMap,
  PointerEventType,
  PointerKeyType,
  Projection,
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
import { timeout } from '../../helpers/helpers.js';

describe('startEditFeaturesSession', () => {
  let app: VcsApp;
  let layer: VectorLayer;
  let defaultMap: OpenlayersMap;
  let obliqueMap: ObliqueMap;
  let cesiumMap: CesiumMap;
  const interactionId = 'edit_features_test';

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

  describe('setting features', () => {
    let session: EditFeaturesSession;
    let feature: Feature;

    before(() => {
      session = startEditFeaturesSession(app, layer);
      feature = createFeatureWithId(new Point([0, 0, 0]));
      session.setFeatures([feature]);
    });

    after(() => {
      session.stop();
    });

    it('should set the features', () => {
      expect(session.features).to.have.members([feature]);
    });

    it('should set allowPicking false', () => {
      expect(feature.getProperties()).to.have.property(
        'olcs_allowPicking',
        false,
      );
    });

    it('should set createSync on the feature', () => {
      expect(feature[createSync]).to.exist;
    });

    describe('changing features', () => {
      let newFeature: Feature;

      before(() => {
        newFeature = new Feature({ geometry: new Point([0, 0, 0]) });
        session.setFeatures([newFeature]);
      });

      it('should set the new features', () => {
        expect(session.features).to.have.members([newFeature]);
      });

      it('should clear allow picking for previous features', () => {
        expect(feature.getProperties()).to.not.have.property(
          'olcs_allowPicking',
        );
      });

      it('should clear createSync for previous features', () => {
        expect(feature[createSync]).to.not.exist;
      });
    });

    describe('removing all features', () => {
      before(() => {
        session.setFeatures([]);
      });

      it('should have an empty array as features', () => {
        expect(session.features).to.be.empty;
      });
    });
  });

  describe('removing features should restore original allowPicking and createSync values', () => {
    it('should maintain allowPicking', () => {
      const feature = createFeatureWithId(new Point([0, 0, 0]));
      feature.set('olcs_allowPicking', true);
      layer.addFeatures([feature]);

      const session = startEditFeaturesSession(app, layer);
      session.setFeatures([feature]);
      expect(feature.get('olcs_allowPicking')).to.be.false;
      session.setFeatures([]);
      expect(feature.get('olcs_allowPicking')).to.be.true;
    });

    it('should maintain createSync', () => {
      const feature = createFeatureWithId(new Point([0, 0, 0]));
      layer.addFeatures([feature]);

      feature[createSync] = true;
      const session = startEditFeaturesSession(app, layer);
      session.setFeatures([feature]);
      expect(feature[createSync]).to.exist;
      session.setFeatures([]);
      expect(feature[createSync]).to.exist;
    });
  });

  describe('right clicking a feature', () => {
    it('should allow picking during the event', async () => {
      const feature = createFeatureWithId(new Point([0, 0, 0]));
      layer.addFeatures([feature]);
      const session = startEditFeaturesSession(app, layer);
      session.setFeatures([feature]);

      const propertyChanged = sinon.spy();
      const listener = feature.on('propertychange', propertyChanged);

      app.maps.eventHandler.handleMapEvent({
        map: defaultMap,
        windowPosition: Cartesian2.ONE,
        pointerEvent: PointerEventType.DOWN,
        pointer: PointerKeyType.RIGHT,
        key: ModificationKeyType.NONE,
      });
      await timeout(20);
      app.maps.eventHandler.handleMapEvent({
        map: defaultMap,
        windowPosition: Cartesian2.ONE,
        pointerEvent: PointerEventType.UP,
        pointer: PointerKeyType.RIGHT,
        key: ModificationKeyType.NONE,
      });

      await timeout(20);
      unByKey(listener);
      expect(propertyChanged).to.have.been.calledTwice;
    });
  });

  describe('stopping an edit session', () => {
    let session: EditFeaturesSession;

    beforeEach(() => {
      session = startEditFeaturesSession(app, layer);
    });

    it('should remove the interaction', () => {
      const interaction = app.maps.eventHandler.interactions[4];
      session.stop();
      expect(app.maps.eventHandler.interactions).to.not.include(interaction);
    });

    it('should call stopped', () => {
      const spy = sinon.spy();
      session.stopped.addEventListener(spy);
      session.stop();
      expect(spy).to.have.been.called;
    });

    it('should unset allowPicking false', () => {
      const feature = createFeatureWithId(new Point([0, 0, 0]));
      session.setFeatures([feature]);
      session.stop();
      expect(feature.getProperties()).to.not.have.property('olcs_allowPicking');
    });

    it('should unset createSync false', () => {
      const feature = createFeatureWithId(new Point([0, 0, 0]));
      session.setFeatures([feature]);
      session.stop();
      expect(feature[createSync]).to.not.exist;
    });
  });

  describe('starting a TRANSLATE session', () => {
    let session: EditFeaturesSession;

    before(() => {
      session = startEditFeaturesSession(
        app,
        layer,
        interactionId,
        TransformationMode.TRANSLATE,
      );
    });

    after(() => {
      session.stop();
    });

    it('should set the mode on the session', () => {
      expect(session.mode).to.equal(TransformationMode.TRANSLATE);
    });

    it('should add a an exclusive listener to the event handler', () => {
      expect(app.maps.eventHandler.interactions[4]).to.be.an.instanceof(
        InteractionChain,
      );
    });

    it('should add the translate interaction and work for 3D geometries', async () => {
      const point = new Point([1, 1, 1]);
      session.setFeatures([createFeatureWithId(point)]);
      const feature = createHandlerFeature(AxisAndPlanes.X);
      const map = app.maps.activeMap!;
      const pointerEvent = PointerEventType.DOWN;
      const windowPosition = new Cartesian2(0, 0);
      await app.maps.eventHandler.interactions[4].pipe({
        pointerEvent,
        windowPosition,
        map,
        feature,
        positionOrPixel: [2, 1, 1],
        type: EventType.DRAGSTART,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[4].pipe({
        pointerEvent,
        windowPosition,
        map,
        feature,
        positionOrPixel: [3, 1, 1],
        type: EventType.DRAG,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[4].pipe({
        pointerEvent,
        windowPosition,
        map,
        feature,
        positionOrPixel: [3, 1, 1],
        type: EventType.DRAGEND,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      expect(point.getCoordinates()).to.have.ordered.members([2, 1, 1]);
    });

    it('should add the translate interaction and work for 2D geometries', async () => {
      const point = new Point([1, 1]);
      session.setFeatures([createFeatureWithId(point)]);
      const feature = createHandlerFeature(AxisAndPlanes.X);
      const map = app.maps.activeMap!;
      const pointerEvent = PointerEventType.DOWN;
      const windowPosition = new Cartesian2(0, 0);
      await app.maps.eventHandler.interactions[4].pipe({
        pointerEvent,
        windowPosition,
        map,
        feature,
        positionOrPixel: [2, 1, 1],
        type: EventType.DRAGSTART,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[4].pipe({
        pointerEvent,
        windowPosition,
        map,
        feature,
        positionOrPixel: [3, 1, 1],
        type: EventType.DRAG,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[4].pipe({
        pointerEvent,
        windowPosition,
        map,
        feature,
        positionOrPixel: [3, 1, 1],
        type: EventType.DRAGEND,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      expect(point.getCoordinates()).to.have.ordered.members([2, 1]);
    });
  });

  describe('starting a ROTATE session', () => {
    let session: EditFeaturesSession;

    before(() => {
      session = startEditFeaturesSession(
        app,
        layer,
        interactionId,
        TransformationMode.ROTATE,
      );
    });

    after(() => {
      session.stop();
    });

    it('should set the mode on the session', () => {
      expect(session.mode).to.equal(TransformationMode.ROTATE);
    });

    it('should add a an exclusive listener to the event handler', () => {
      expect(app.maps.eventHandler.interactions[4]).to.be.an.instanceof(
        InteractionChain,
      );
    });

    it('should add the rotate interaction and work for 3D geometries', async () => {
      const point1 = new Point([1, 1, 0]);
      const point2 = new Point([-1, -1, 0]);
      session.setFeatures([
        createFeatureWithId(point1),
        createFeatureWithId(point2),
      ]);
      const feature = createHandlerFeature(AxisAndPlanes.X);
      const map = app.maps.activeMap!;
      const pointerEvent = PointerEventType.DOWN;
      const windowPosition = new Cartesian2(0, 0);
      await app.maps.eventHandler.interactions[4].pipe({
        pointerEvent,
        windowPosition,
        map,
        feature,
        positionOrPixel: [0.5, 0.5, 1],
        type: EventType.DRAGSTART,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[4].pipe({
        pointerEvent,
        windowPosition,
        map,
        feature,
        positionOrPixel: [-0.5, -0.5, 1],
        type: EventType.DRAG,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[4].pipe({
        pointerEvent,
        windowPosition,
        map,
        feature,
        positionOrPixel: [-0.5, -0.5, 1],
        type: EventType.DRAGEND,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      expect(
        point1.getCoordinates().map((c) => Math.round(c)),
      ).to.have.ordered.members([-1, -1, 0]);
      expect(
        point2.getCoordinates().map((c) => Math.round(c)),
      ).to.have.ordered.members([1, 1, 0]);
    });

    it('should add the rotate interaction and work for 2D geometries', async () => {
      const point1 = new Point([1, 1]);
      const point2 = new Point([-1, -1]);
      session.setFeatures([
        createFeatureWithId(point1),
        createFeatureWithId(point2),
      ]);
      const feature = createHandlerFeature(AxisAndPlanes.X);
      const map = app.maps.activeMap!;
      const pointerEvent = PointerEventType.DOWN;
      const windowPosition = new Cartesian2(0, 0);
      await app.maps.eventHandler.interactions[4].pipe({
        pointerEvent,
        windowPosition,
        map,
        feature,
        positionOrPixel: [0.5, 0.5, 1],
        type: EventType.DRAGSTART,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[4].pipe({
        pointerEvent,
        windowPosition,
        map,
        feature,
        positionOrPixel: [-0.5, -0.5, 1],
        type: EventType.DRAG,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[4].pipe({
        pointerEvent,
        windowPosition,
        map,
        feature,
        positionOrPixel: [-0.5, -0.5, 1],
        type: EventType.DRAGEND,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      expect(
        point1.getCoordinates().map((c) => Math.round(c)),
      ).to.have.ordered.members([-1, -1]);
      expect(
        point2.getCoordinates().map((c) => Math.round(c)),
      ).to.have.ordered.members([1, 1]);
    });

    describe('rotating models', () => {
      let pointFeature: Feature<Point>;

      beforeEach(() => {
        const point1 = new Point([0, 0, 0]);
        pointFeature = createFeatureWithId(point1);
        pointFeature.set('olcs_modelUrl', 'model.glb');
        session.setFeatures([pointFeature]);
      });

      it('should set heading', async () => {
        const feature = createHandlerFeature(AxisAndPlanes.Z);
        const map = app.maps.activeMap!;
        const pointerEvent = PointerEventType.DOWN;
        const windowPosition = new Cartesian2(0, 0);
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [0.5, 0.5, 1],
          type: EventType.DRAGSTART,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [-0.5, -0.5, 1],
          type: EventType.DRAG,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [-0.5, -0.5, 1],
          type: EventType.DRAGEND,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        expect(
          pointFeature
            .getGeometry()!
            .getCoordinates()
            .map((c) => Math.round(c)),
        ).to.have.ordered.members([0, 0, 0]);
        expect(pointFeature.get('olcs_modelHeading')).to.equal(180);
      });

      it('should set pitch', async () => {
        const feature = createHandlerFeature(AxisAndPlanes.X);
        const map = app.maps.activeMap!;
        const pointerEvent = PointerEventType.DOWN;
        const windowPosition = new Cartesian2(0, 0);
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [0.5, 0.5, 1],
          type: EventType.DRAGSTART,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [-0.5, -0.5, 0],
          type: EventType.DRAG,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [-0.5, -0.5, 0],
          type: EventType.DRAGEND,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        expect(
          pointFeature
            .getGeometry()!
            .getCoordinates()
            .map((c) => Math.round(c)),
        ).to.have.ordered.members([0, 0, 0]);
        expect(pointFeature.get('olcs_modelPitch')).to.equal(180);
      });

      it('should set roll', async () => {
        const feature = createHandlerFeature(AxisAndPlanes.Y);
        const map = app.maps.activeMap!;
        const pointerEvent = PointerEventType.DOWN;
        const windowPosition = new Cartesian2(0, 0);
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [0.5, 0.5, 1],
          type: EventType.DRAGSTART,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [-0.5, -0.5, 0],
          type: EventType.DRAG,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [-0.5, -0.5, 0],
          type: EventType.DRAGEND,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        expect(
          pointFeature
            .getGeometry()!
            .getCoordinates()
            .map((c) => Math.round(c)),
        ).to.have.ordered.members([0, 0, 0]);
        expect(pointFeature.get('olcs_modelRoll')).to.equal(180);
      });
    });

    describe('rotating primitives', () => {
      let pointFeature: Feature<Point>;

      beforeEach(() => {
        const point1 = new Point([0, 0, 0]);
        pointFeature = createFeatureWithId(point1);
        pointFeature.set('olcs_primitiveOptions', {
          type: 'sphere',
          geometryOptions: { radius: 1 },
        });
        session.setFeatures([pointFeature]);
      });

      it('should set heading', async () => {
        const feature = createHandlerFeature(AxisAndPlanes.Z);
        const map = app.maps.activeMap!;
        const pointerEvent = PointerEventType.DOWN;
        const windowPosition = new Cartesian2(0, 0);
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [0.5, 0.5, 1],
          type: EventType.DRAGSTART,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [-0.5, -0.5, 1],
          type: EventType.DRAG,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [-0.5, -0.5, 1],
          type: EventType.DRAGEND,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        expect(
          pointFeature
            .getGeometry()!
            .getCoordinates()
            .map((c) => Math.round(c)),
        ).to.have.ordered.members([0, 0, 0]);
        expect(pointFeature.get('olcs_modelHeading')).to.equal(180);
      });

      it('should set pitch', async () => {
        const feature = createHandlerFeature(AxisAndPlanes.X);
        const map = app.maps.activeMap!;
        const pointerEvent = PointerEventType.DOWN;
        const windowPosition = new Cartesian2(0, 0);
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [0.5, 0.5, 1],
          type: EventType.DRAGSTART,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [-0.5, -0.5, 0],
          type: EventType.DRAG,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [-0.5, -0.5, 0],
          type: EventType.DRAGEND,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        expect(
          pointFeature
            .getGeometry()!
            .getCoordinates()
            .map((c) => Math.round(c)),
        ).to.have.ordered.members([0, 0, 0]);
        expect(pointFeature.get('olcs_modelPitch')).to.equal(180);
      });

      it('should set roll', async () => {
        const feature = createHandlerFeature(AxisAndPlanes.Y);
        const map = app.maps.activeMap!;
        const pointerEvent = PointerEventType.DOWN;
        const windowPosition = new Cartesian2(0, 0);
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [0.5, 0.5, 1],
          type: EventType.DRAGSTART,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [-0.5, -0.5, 0],
          type: EventType.DRAG,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [-0.5, -0.5, 0],
          type: EventType.DRAGEND,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        expect(
          pointFeature
            .getGeometry()!
            .getCoordinates()
            .map((c) => Math.round(c)),
        ).to.have.ordered.members([0, 0, 0]);
        expect(pointFeature.get('olcs_modelRoll')).to.equal(180);
      });
    });
  });

  describe('starting a SCALE session', () => {
    let session: EditFeaturesSession;

    before(() => {
      session = startEditFeaturesSession(
        app,
        layer,
        interactionId,
        TransformationMode.SCALE,
      );
    });

    after(() => {
      session.stop();
    });

    it('should set the mode on the session', () => {
      expect(session.mode).to.equal(TransformationMode.SCALE);
    });

    it('should add a an exclusive listener to the event handler', () => {
      expect(app.maps.eventHandler.interactions[4]).to.be.an.instanceof(
        InteractionChain,
      );
    });

    it('should add the scale interaction and work for 3D geometries', async () => {
      const point1 = new Point([1, 1, 0]);
      const point2 = new Point([-1, -1, 0]);
      session.setFeatures([
        createFeatureWithId(point1),
        createFeatureWithId(point2),
      ]);
      const feature = createHandlerFeature(AxisAndPlanes.X);
      const map = app.maps.activeMap!;
      const pointerEvent = PointerEventType.DOWN;
      const windowPosition = new Cartesian2(0, 0);
      await app.maps.eventHandler.interactions[4].pipe({
        pointerEvent,
        windowPosition,
        map,
        feature,
        positionOrPixel: [0.5, 0.5, 1],
        type: EventType.DRAGSTART,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[4].pipe({
        pointerEvent,
        windowPosition,
        map,
        feature,
        positionOrPixel: [-0.5, -0.5, 1],
        type: EventType.DRAG,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[4].pipe({
        pointerEvent,
        windowPosition,
        map,
        feature,
        positionOrPixel: [-0.5, -0.5, 1],
        type: EventType.DRAGEND,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      expect(
        point1.getCoordinates().map((c) => Math.round(c)),
      ).to.have.ordered.members([-1, 1, 0]);
      expect(
        point2.getCoordinates().map((c) => Math.round(c)),
      ).to.have.ordered.members([1, -1, 0]);
    });

    it('should add the scale interaction and work for 2D geometries', async () => {
      const point1 = new Point([1, 1]);
      const point2 = new Point([-1, -1]);
      session.setFeatures([
        createFeatureWithId(point1),
        createFeatureWithId(point2),
      ]);
      const feature = createHandlerFeature(AxisAndPlanes.X);
      const map = app.maps.activeMap!;
      const pointerEvent = PointerEventType.DOWN;
      const windowPosition = new Cartesian2(0, 0);
      await app.maps.eventHandler.interactions[4].pipe({
        pointerEvent,
        windowPosition,
        map,
        feature,
        positionOrPixel: [0.5, 0.5, 1],
        type: EventType.DRAGSTART,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[4].pipe({
        pointerEvent,
        windowPosition,
        map,
        feature,
        positionOrPixel: [-0.5, -0.5, 1],
        type: EventType.DRAG,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[4].pipe({
        pointerEvent,
        windowPosition,
        map,
        feature,
        positionOrPixel: [-0.5, -0.5, 1],
        type: EventType.DRAGEND,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      expect(
        point1.getCoordinates().map((c) => Math.round(c)),
      ).to.have.ordered.members([-1, 1]);
      expect(
        point2.getCoordinates().map((c) => Math.round(c)),
      ).to.have.ordered.members([1, -1]);
    });

    describe('scaling models', () => {
      let pointFeature: Feature<Point>;
      let patchedPickRay: undefined | (() => void);

      before(async () => {
        await app.maps.setActiveMap(cesiumMap.name);
      });

      beforeEach(() => {
        const point1 = new Point([0, 0, 0]);
        pointFeature = createFeatureWithId(point1);
        pointFeature.set('olcs_modelUrl', 'model.glb');
        session.setFeatures([pointFeature]);
      });

      afterEach(() => {
        patchedPickRay?.();
      });

      after(async () => {
        await app.maps.setActiveMap(defaultMap.name);
      });

      it('should scale the model X', async () => {
        const feature = createHandlerFeature(AxisAndPlanes.X);
        const map = app.maps.activeMap!;
        const pointerEvent = PointerEventType.DOWN;
        const windowPosition = new Cartesian2(0, 0);
        patchedPickRay = patchPickRay([
          mercatorToCartesian([1, 1, 1]),
          mercatorToCartesian([2, 2, 1]),
          mercatorToCartesian([2, 2, 1]),
        ]);

        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [1, 1, 1],
          type: EventType.DRAGSTART,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [2, 2, 1],
          type: EventType.DRAG,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [2, 2, 1],
          type: EventType.DRAGEND,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        expect(pointFeature.get('olcs_modelScaleX')).to.be.closeTo(2, 0.1);
      });

      it('should scale the model Y', async () => {
        const feature = createHandlerFeature(AxisAndPlanes.Y);
        const map = app.maps.activeMap!;
        const pointerEvent = PointerEventType.DOWN;
        const windowPosition = new Cartesian2(0, 0);
        patchedPickRay = patchPickRay([
          mercatorToCartesian([1, 1, 1]),
          mercatorToCartesian([2, 2, 1]),
          mercatorToCartesian([2, 2, 1]),
        ]);
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [1, 1, 1],
          type: EventType.DRAGSTART,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });

        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [2, 2, 1],
          type: EventType.DRAG,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });

        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [2, 2, 1],
          type: EventType.DRAGEND,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        expect(pointFeature.get('olcs_modelScaleY')).to.be.closeTo(2, 0.1);
      });

      it('should scale the model Z', async () => {
        const feature = createHandlerFeature(AxisAndPlanes.Z);
        const map = app.maps.activeMap!;
        const pointerEvent = PointerEventType.DOWN;
        const windowPosition = new Cartesian2(0, 0);
        patchedPickRay = patchPickRay([
          mercatorToCartesian([1, 1, 1]),
          mercatorToCartesian([1, 1, 2]),
          mercatorToCartesian([1, 1, 2]),
        ]);
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [1, 1, 1],
          type: EventType.DRAGSTART,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });

        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [2, 2, 1],
          type: EventType.DRAG,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });

        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [2, 2, 1],
          type: EventType.DRAGEND,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        expect(pointFeature.get('olcs_modelScaleZ')).to.be.closeTo(2, 0.1);
      });

      it('should scale the model XYZ evenly', async () => {
        const feature = createHandlerFeature(AxisAndPlanes.XYZ);
        const map = app.maps.activeMap!;
        const pointerEvent = PointerEventType.DOWN;
        const windowPosition = new Cartesian2(0, 0);
        patchedPickRay = patchPickRay([
          mercatorToCartesian([1, 1, 1]),
          mercatorToCartesian([2, 2, 2]),
          mercatorToCartesian([2, 2, 2]),
        ]);
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [1, 1, 1],
          type: EventType.DRAGSTART,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });

        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [2, 2, 1],
          type: EventType.DRAG,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });

        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [2, 2, 1],
          type: EventType.DRAGEND,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        expect(pointFeature.get('olcs_modelScaleX')).to.be.closeTo(2, 0.1);
        expect(pointFeature.get('olcs_modelScaleY')).to.be.closeTo(2, 0.1);
        expect(pointFeature.get('olcs_modelScaleZ')).to.be.closeTo(2, 0.1);
      });
    });

    describe('scaling primitives', () => {
      let pointFeature: Feature<Point>;
      let patchedPickRay: undefined | (() => void);

      before(async () => {
        await app.maps.setActiveMap(cesiumMap.name);
      });

      beforeEach(() => {
        const point1 = new Point([0, 0, 0]);
        pointFeature = createFeatureWithId(point1);
        pointFeature.set('olcs_primitiveOptions', {
          type: 'sphere',
          geometryOptions: { radius: 1 },
        });
        session.setFeatures([pointFeature]);
      });

      afterEach(() => {
        patchedPickRay?.();
      });

      after(async () => {
        await app.maps.setActiveMap(defaultMap.name);
      });

      it('should scale the model X', async () => {
        const feature = createHandlerFeature(AxisAndPlanes.X);
        const map = app.maps.activeMap!;
        const pointerEvent = PointerEventType.DOWN;
        const windowPosition = new Cartesian2(0, 0);
        patchedPickRay = patchPickRay([
          mercatorToCartesian([1, 1, 1]),
          mercatorToCartesian([2, 2, 1]),
          mercatorToCartesian([2, 2, 1]),
        ]);

        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [1, 1, 1],
          type: EventType.DRAGSTART,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [2, 2, 1],
          type: EventType.DRAG,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [2, 2, 1],
          type: EventType.DRAGEND,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        expect(pointFeature.get('olcs_modelScaleX')).to.be.closeTo(2, 0.1);
      });

      it('should scale the model Y', async () => {
        const feature = createHandlerFeature(AxisAndPlanes.Y);
        const map = app.maps.activeMap!;
        const pointerEvent = PointerEventType.DOWN;
        const windowPosition = new Cartesian2(0, 0);
        patchedPickRay = patchPickRay([
          mercatorToCartesian([1, 1, 1]),
          mercatorToCartesian([2, 2, 1]),
          mercatorToCartesian([2, 2, 1]),
        ]);
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [1, 1, 1],
          type: EventType.DRAGSTART,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });

        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [2, 2, 1],
          type: EventType.DRAG,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });

        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [2, 2, 1],
          type: EventType.DRAGEND,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        expect(pointFeature.get('olcs_modelScaleY')).to.be.closeTo(2, 0.1);
      });

      it('should scale the model Z', async () => {
        const feature = createHandlerFeature(AxisAndPlanes.Z);
        const map = app.maps.activeMap!;
        const pointerEvent = PointerEventType.DOWN;
        const windowPosition = new Cartesian2(0, 0);
        patchedPickRay = patchPickRay([
          mercatorToCartesian([1, 1, 1]),
          mercatorToCartesian([1, 1, 2]),
          mercatorToCartesian([1, 1, 2]),
        ]);
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [1, 1, 1],
          type: EventType.DRAGSTART,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });

        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [2, 2, 1],
          type: EventType.DRAG,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });

        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [2, 2, 1],
          type: EventType.DRAGEND,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        expect(pointFeature.get('olcs_modelScaleZ')).to.be.closeTo(2, 0.1);
      });

      it('should scale the model XYZ evenly', async () => {
        const feature = createHandlerFeature(AxisAndPlanes.XYZ);
        const map = app.maps.activeMap!;
        const pointerEvent = PointerEventType.DOWN;
        const windowPosition = new Cartesian2(0, 0);
        patchedPickRay = patchPickRay([
          mercatorToCartesian([1, 1, 1]),
          mercatorToCartesian([2, 2, 2]),
          mercatorToCartesian([2, 2, 2]),
        ]);
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [1, 1, 1],
          type: EventType.DRAGSTART,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });

        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [2, 2, 1],
          type: EventType.DRAG,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });

        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature,
          positionOrPixel: [2, 2, 1],
          type: EventType.DRAGEND,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        expect(pointFeature.get('olcs_modelScaleX')).to.be.closeTo(2, 0.1);
        expect(pointFeature.get('olcs_modelScaleY')).to.be.closeTo(2, 0.1);
        expect(pointFeature.get('olcs_modelScaleZ')).to.be.closeTo(2, 0.1);
      });
    });
  });

  describe('starting a EXTRUDE session', () => {
    let session: EditFeaturesSession;

    before(async () => {
      await app.maps.setActiveMap(cesiumMap.name);
      session = startEditFeaturesSession(
        app,
        layer,
        interactionId,
        TransformationMode.EXTRUDE,
      );
    });

    after(async () => {
      session.stop();
      await app.maps.setActiveMap(defaultMap.name);
    });

    it('should set the mode on the session', () => {
      expect(session.mode).to.equal(TransformationMode.EXTRUDE);
    });

    it('should add a an exclusive listener to the event handler', () => {
      expect(app.maps.eventHandler.interactions[4]).to.be.an.instanceof(
        InteractionChain,
      );
    });

    describe('extruding a feature', () => {
      let stub: SinonStub;
      let restorePick: () => void;

      beforeEach(() => {
        restorePick = patchPickRay([
          mercatorToCartesian([1, 1, 1]),
          mercatorToCartesian([1, 1, 4]),
          mercatorToCartesian([1, 1, 4]),
        ]);
        stub = sinon
          .stub(cesiumMap, 'getHeightFromTerrain')
          .callsFake((coords): Promise<Coordinate[]> => {
            coords.forEach((c) => {
              c[2] = 1;
            });
            return Promise.resolve(coords);
          });
      });

      afterEach(() => {
        stub.restore();
        restorePick();
      });

      it('should add the extruded interaction and work for 3D geometries', async () => {
        const feature = createFeatureWithId(new Point([1, 1, 0]));
        session.setFeatures([feature]);
        const handlerFeature = createHandlerFeature(AxisAndPlanes.Z);
        const map = app.maps.activeMap!;
        const pointerEvent = PointerEventType.DOWN;
        const windowPosition = new Cartesian2(0, 0);
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature: handlerFeature,
          positionOrPixel: [1, 1, 1],
          type: EventType.DRAGSTART,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature: handlerFeature,
          positionOrPixel: [1, 1, 4],
          type: EventType.DRAG,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature: handlerFeature,
          positionOrPixel: [1, 1, 4],
          type: EventType.DRAGEND,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        expect(feature.get('olcs_extrudedHeight')).to.exist.and.to.be.closeTo(
          3,
          CesiumMath.EPSILON5,
        );
      });

      it('should add the extruded interaction and work for 2D geometries', async () => {
        const feature = createFeatureWithId(new Point([1, 1]));
        session.setFeatures([feature]);
        const handlerFeature = createHandlerFeature(AxisAndPlanes.Z);
        const map = app.maps.activeMap!;
        const pointerEvent = PointerEventType.DOWN;
        const windowPosition = new Cartesian2(0, 0);
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature: handlerFeature,
          positionOrPixel: [1, 1, 1],
          type: EventType.DRAGSTART,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature: handlerFeature,
          positionOrPixel: [1, 1, 4],
          type: EventType.DRAG,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[4].pipe({
          pointerEvent,
          windowPosition,
          map,
          feature: handlerFeature,
          positionOrPixel: [1, 1, 4],
          type: EventType.DRAGEND,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        expect(feature.get('olcs_extrudedHeight')).to.exist.and.to.be.closeTo(
          3,
          CesiumMath.EPSILON5,
        );
      });
    });
  });

  describe('setting olcs properties on a set feature', () => {
    let session: EditFeaturesSession;
    let features: Feature[];

    before(() => {
      session = startEditFeaturesSession(app, layer);
    });

    beforeEach(() => {
      features = [
        createFeatureWithId(new Point([0, 0, 0])),
        createFeatureWithId(new Point([1, 0, 0])),
      ];
      session.setFeatures(features);
    });

    after(() => {
      session.stop();
    });

    it('should recalculate the handlers, when changing altitude mode', () => {
      const scratchLayer = [...app.layers].pop() as VectorLayer;
      const scratchFeatures = scratchLayer.getFeatures();
      expect(scratchFeatures[0]).to.exist;
      const changed = sinon.spy();
      scratchFeatures[0].once('change', changed);
      features[0].set('olcs_altitudeMode', 'absolute');
      expect(changed).to.have.been.calledOnce;
    });

    it('should recalculate the handlers, when changing ground level', () => {
      const scratchLayer = [...app.layers].pop() as VectorLayer;
      const scratchFeatures = scratchLayer.getFeatures();
      expect(scratchFeatures[0]).to.exist;
      const changed = sinon.spy();
      scratchFeatures[0].once('change', changed);
      features[0].set('olcs_groundLevel', 2);
      expect(changed).to.have.been.calledOnce;
    });

    it('should recalculate the handlers, when changing height above ground', () => {
      const scratchLayer = [...app.layers].pop() as VectorLayer;
      const scratchFeatures = scratchLayer.getFeatures();
      expect(scratchFeatures[0]).to.exist;
      const changed = sinon.spy();
      scratchFeatures[0].once('change', changed);
      features[0].set('olcs_heightAboveGround', 20);
      expect(changed).to.have.been.calledOnce;
    });
  });

  describe('starting a EXTRUDE session without having an active cesium map', () => {
    let session: EditFeaturesSession;

    before(() => {
      session = startEditFeaturesSession(
        app,
        layer,
        interactionId,
        TransformationMode.EXTRUDE,
      );
    });

    after(() => {
      session.stop();
    });

    it('should set the mode to TRANSLATE instead', () => {
      expect(session.mode).to.equal(TransformationMode.TRANSLATE);
    });
  });

  describe('changing the mode', () => {
    let session: EditFeaturesSession;

    beforeEach(() => {
      session = startEditFeaturesSession(
        app,
        layer,
        TransformationMode.TRANSLATE,
      );
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

  describe('changing the active map from a cesium map with extrude mode on', () => {
    let session: EditFeaturesSession;

    beforeEach(async () => {
      await app.maps.setActiveMap(cesiumMap.name);
      session = startEditFeaturesSession(
        app,
        layer,
        interactionId,
        TransformationMode.EXTRUDE,
      );
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
      expect(modeChangeListener).to.have.been.calledWithExactly(
        TransformationMode.TRANSLATE,
      );
    });
  });

  describe('forcefully removing a session', () => {
    let session: EditFeaturesSession;

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
