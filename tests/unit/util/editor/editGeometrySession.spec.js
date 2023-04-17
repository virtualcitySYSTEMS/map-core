import { expect } from 'chai';
import { Feature } from 'ol';
import { Circle, LineString, MultiPoint, Point, Polygon } from 'ol/geom.js';
import {
  EventType,
  ModificationKeyType,
  ObliqueMap,
  OpenlayersMap, PointerKeyType,
  createSync,
  startEditGeometrySession,
} from '../../../../index.js';
import VcsApp from '../../../../src/vcsApp.js';
import VectorLayer from '../../../../src/layer/vectorLayer.js';
import InteractionChain from '../../../../src/interaction/interactionChain.js';
import { createFeatureWithId } from './transformation/setupTransformationHandler.js';

describe('EditGeometrySession', () => {
  let app;
  let layer;
  let defaultMap;
  let obliqueMap;

  before(async () => {
    defaultMap = new OpenlayersMap({});
    app = new VcsApp();
    app.maps.add(defaultMap);
    obliqueMap = new ObliqueMap({});
    app.maps.add(obliqueMap);
    await app.maps.setActiveMap(defaultMap.name);
    layer = new VectorLayer({});
    app.layers.add(layer);
  });

  after(() => {
    app.destroy();
  });

  describe('starting a session', () => {
    let session;

    beforeEach(() => {
      session = startEditGeometrySession(app, layer);
    });

    afterEach(() => {
      session.stop();
    });

    it('should add a an exclusive listener to the event handler', () => {
      expect(app.maps.eventHandler.interactions[3]).to.be.an.instanceof(InteractionChain);
    });

    describe('setting a feature', () => {
      let feature;
      beforeEach(() => {
        feature = createFeatureWithId(new Point([0, 0, 0]));
        layer.addFeatures([feature]);
        session.setFeature(feature);
      });

      it('should return the feature that was set before', () => {
        expect(session.feature).to.equal(feature);
      });

      it('should set createSync on feature', () => {
        expect(feature).to.have.property(createSync, true);
      });

      describe('unsetting feature', () => {
        beforeEach(() => {
          session.setFeature(null);
        });

        it('should remove createSync', () => {
          expect(feature).to.not.have.property(createSync);
        });
      });
    });

    describe('line string editing', () => {
      let feature;
      let vertices;

      beforeEach(async () => {
        feature = new Feature({ geometry: new LineString([[0, 0, 0], [1, 1, 0]]) });
        layer.addFeatures([feature]);
        await session.setFeature(feature);
        vertices = [...app.layers].pop().getFeatures();
      });

      it('should add vertices to the scratch layer', () => {
        expect(vertices).to.have.length(2);
      });

      it('should update the geometry, if changing a vertex', async () => {
        const vertex = vertices[0];
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAGSTART,
          feature: vertex,
          positionOrPixel: [0, 0, 0],
        });
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAG,
          feature: vertex,
          positionOrPixel: [1, 0, 0],
        });
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAGEND,
          feature: vertex,
          positionOrPixel: [1, 0, 0],
        });
        expect(feature.getGeometry().getCoordinates()).to.have.ordered.deep.members([[1, 0, 0], [1, 1, 0]]);
      });

      it('should update the geometry, if removing a vertex', async () => {
        const vertex = vertices[0];
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.SHIFT,
          map: defaultMap,
          type: EventType.CLICK,
          feature: vertex,
          positionOrPixel: [0, 0, 0],
        });
        expect(feature.getGeometry().getCoordinates()).to.have.ordered.deep.members([[1, 1, 0]]);
      });

      it('should update the feature, on insert of a vertex', async () => {
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.CLICK,
          feature,
          positionOrPixel: [0.5, 0.5, 0],
        });
        expect(feature.getGeometry().getCoordinates())
          .to.have.ordered.deep.members([[0, 0, 0], [0.5, 0.5, 0], [1, 1, 0]]);
      });
    });

    describe('polygon editing', () => {
      let feature;
      let vertices;

      beforeEach(async () => {
        feature = new Feature({ geometry: new Polygon([[[0, 0, 0], [1, 1, 0], [0, 1, 0]]]) });
        layer.addFeatures([feature]);
        await session.setFeature(feature);
        vertices = [...app.layers].pop().getFeatures();
      });

      it('should add vertices to the scratch layer', () => {
        expect(vertices).to.have.length(3);
      });

      it('should update the geometry, if changing a vertex', async () => {
        const vertex = vertices[0];
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAGSTART,
          feature: vertex,
          positionOrPixel: [0, 0, 0],
        });
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAG,
          feature: vertex,
          positionOrPixel: [1, 0, 0],
        });
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAGEND,
          feature: vertex,
          positionOrPixel: [1, 0, 0],
        });
        expect(feature.getGeometry().getCoordinates())
          .to.have.ordered.deep.members([[[1, 0, 0], [1, 1, 0], [0, 1, 0]]]);
      });

      it('should update the geometry, if removing a vertex', async () => {
        const vertex = vertices[0];
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.SHIFT,
          map: defaultMap,
          type: EventType.CLICK,
          feature: vertex,
          positionOrPixel: [0, 0, 0],
        });
        expect(feature.getGeometry().getCoordinates()).to.have.ordered.deep.members([[[1, 1, 0], [0, 1, 0]]]);
      });

      it('should update the feature, on insert of a vertex', async () => {
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.CLICK,
          feature,
          positionOrPixel: [0.5, 0.5, 0],
        });
        expect(feature.getGeometry().getCoordinates())
          .to.have.ordered.deep.members([[[0, 0, 0], [0.5, 0.5, 0], [1, 1, 0], [0, 1, 0]]]);
      });
    });

    describe('point editing', () => {
      let feature;
      let vertices;

      beforeEach(async () => {
        feature = new Feature({ geometry: new Point([0, 0, 0]) });
        layer.addFeatures([feature]);
        await session.setFeature(feature);
        vertices = [...app.layers].pop().getFeatures();
      });

      it('should add vertices to the scratch layer', () => {
        expect(vertices).to.have.length(1);
      });

      it('should translate the point, if moving the center vertex', async () => {
        const vertex = vertices[0];
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAGSTART,
          feature: vertex,
          positionOrPixel: [0, 0, 0],
        });
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAG,
          feature: vertex,
          positionOrPixel: [1, 0, 0],
        });
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAGEND,
          feature: vertex,
          positionOrPixel: [1, 0, 0],
        });
        expect(feature.getGeometry().getCoordinates()).to.have.ordered.members([1, 0, 0]);
      });
    });

    describe('circle editing', () => {
      let feature;
      let vertices;

      beforeEach(async () => {
        feature = new Feature({ geometry: new Circle([0, 0, 0], 1, 'XYZ') });
        layer.addFeatures([feature]);
        await session.setFeature(feature);
        vertices = [...app.layers].pop().getFeatures();
      });

      it('should add vertices to the scratch layer', () => {
        expect(vertices).to.have.length(2);
      });

      it('should translate the circles center, if moving the center vertex', async () => {
        const vertex = vertices[0];
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAGSTART,
          feature: vertex,
          positionOrPixel: [0, 0, 0],
        });
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAG,
          feature: vertex,
          positionOrPixel: [1, 0, 0],
        });
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAGEND,
          feature: vertex,
          positionOrPixel: [1, 0, 0],
        });
        expect(feature.getGeometry().getCenter()).to.have.ordered.members([1, 0, 0]);
        expect(feature.getGeometry().getRadius()).to.equal(1);
      });

      it('should translate the circle radius, if moving the outer vertex', async () => {
        const vertex = vertices[1];
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAGSTART,
          feature: vertex,
          positionOrPixel: [1, 0, 0],
        });
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAG,
          feature: vertex,
          positionOrPixel: [2, 0, 0],
        });
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAGEND,
          feature: vertex,
          positionOrPixel: [2, 0, 0],
        });
        expect(feature.getGeometry().getCenter()).to.have.ordered.members([0, 0, 0]);
        expect(feature.getGeometry().getRadius()).to.equal(2);
      });
    });

    describe('bbox editing', () => {
      let feature;
      let vertices;

      beforeEach(async () => {
        const geometry = new Polygon([[[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]]);
        geometry.set('_vcsGeomType', 'BBox');
        feature = new Feature({ geometry });
        layer.addFeatures([feature]);
        await session.setFeature(feature);
        vertices = [...app.layers].pop().getFeatures();
      });

      it('should add vertices to the scratch layer', () => {
        expect(vertices).to.have.length(4);
      });

      it('should ensure bbox, if moving bottom left vertex', async () => {
        const vertex = vertices[0];
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAGSTART,
          feature: vertex,
          positionOrPixel: [0, 0, 0],
        });
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAG,
          feature: vertex,
          positionOrPixel: [-1, -1, 0],
        });
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAGEND,
          feature: vertex,
          positionOrPixel: [-1, -1, 0],
        });
        expect(feature.getGeometry().getCoordinates())
          .to.have.ordered.deep.members([[[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]]]);
      });

      it('should ensure bbox, if moving bottom right vertex', async () => {
        const vertex = vertices[1];
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAGSTART,
          feature: vertex,
          positionOrPixel: [1, 0, 0],
        });
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAG,
          feature: vertex,
          positionOrPixel: [2, -1, 0],
        });
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAGEND,
          feature: vertex,
          positionOrPixel: [2, -1, 0],
        });
        expect(feature.getGeometry().getCoordinates())
          .to.have.ordered.deep.members([[[0, -1, 0], [2, -1, 0], [2, 1, 0], [0, 1, 0]]]);
      });

      it('should ensure bbox, if moving top right vertex', async () => {
        const vertex = vertices[2];
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAGSTART,
          feature: vertex,
          positionOrPixel: [1, 1, 0],
        });
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAG,
          feature: vertex,
          positionOrPixel: [2, 2, 0],
        });
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAGEND,
          feature: vertex,
          positionOrPixel: [2, 2, 0],
        });
        expect(feature.getGeometry().getCoordinates())
          .to.have.ordered.deep.members([[[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0]]]);
      });

      it('should ensure bbox, if moving top left vertex', async () => {
        const vertex = vertices[3];
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAGSTART,
          feature: vertex,
          positionOrPixel: [0, 1, 0],
        });
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAG,
          feature: vertex,
          positionOrPixel: [-1, 2, 0],
        });
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAGEND,
          feature: vertex,
          positionOrPixel: [-1, 2, 0],
        });
        expect(feature.getGeometry().getCoordinates())
          .to.have.ordered.deep.members([[[-1, 0, 0], [1, 0, 0], [1, 2, 0], [-1, 2, 0]]]);
      });

      it('should prevent collapsing of the bbox', async () => {
        const vertex = vertices[0];
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAGSTART,
          feature: vertex,
          positionOrPixel: [0, 0, 0],
        });
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAG,
          feature: vertex,
          positionOrPixel: [1, 1, 0],
        });
        await app.maps.eventHandler.interactions[3].pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          map: defaultMap,
          type: EventType.DRAGEND,
          feature: vertex,
          positionOrPixel: [1, 1, 0],
        });
        const newVertexCoordinates = vertex.getGeometry().getCoordinates();
        expect(newVertexCoordinates).to.not.have.ordered.members([1, 1, 0]);
        expect(newVertexCoordinates.map(c => Math.round(c))).to.have.ordered.members([1, 1, 0]);
      });
    });

    describe('unsupported geometries', () => {
      it('should not accept unsupported geometries', () => {
        const complexFeature = new Feature({ geometry: new MultiPoint([[1, 1, 0]]) });
        session.setFeature(complexFeature);
        expect(session.feature).to.be.null;
      });
    });

    describe('unsetting invalid geometries', () => {
      it('should remove invalid geometries from layer', () => {
        const invalidFeature = new Feature({ geometry: new LineString([[0, 0, 0]]) });
        const otherFeature = new Feature({ geometry: new Point([0, 0, 0]) });
        layer.addFeatures([invalidFeature]);
        session.setFeature(invalidFeature);
        session.setFeature(otherFeature);
        expect(layer.getFeatures()).to.not.include(invalidFeature);
      });
    });
  });

  describe('stopping a session', () => {
    let session;

    beforeEach(() => {
      session = startEditGeometrySession(app, layer);
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
  });

  describe('forcefully removing a session', () => {
    let session;

    beforeEach(() => {
      session = startEditGeometrySession(app, layer);
    });

    it('should stop the session', () => {
      const spy = sinon.spy();
      session.stopped.addEventListener(spy);
      app.maps.eventHandler.removeExclusive();
      expect(spy).to.have.been.called;
    });
  });
});
