import { Feature } from 'ol';
import { Circle, LineString, MultiPoint, Point, Polygon } from 'ol/geom.js';
import {
  createSync,
  EventType,
  ModificationKeyType,
  ObliqueMap,
  OpenlayersMap, PointerKeyType,
  startEditGeometrySession,
} from '../../../../index.js';
import VcsApp from '../../../../src/vcsApp.js';
import VectorLayer from '../../../../src/layer/vectorLayer.js';
import InteractionChain from '../../../../src/interaction/interactionChain.js';

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

    describe('line string editing', () => {
      let feature;
      let vertices;

      beforeEach(async () => {
        feature = new Feature({ geometry: new LineString([[0, 0, 0], [1, 1, 0]]) });
        layer.addFeatures([feature]);
        await session.featureSelection.selectFeature(feature);
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
        await session.featureSelection.selectFeature(feature);
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
        await session.featureSelection.selectFeature(feature);
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
        await session.featureSelection.selectFeature(feature);
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
        await session.featureSelection.selectFeature(feature);
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
  });

  describe('feature selection', () => {
    describe('selecting a feature', () => {
      let feature;

      before(async () => {
        feature = new Feature({ geometry: new Point([0, 0, 0]) });
      });

      after(async () => { // catch all if oblique spec throws
        await app.maps.setActiveMap(defaultMap.name);
      });

      it('should set create sync on the feature', async () => {
        const session = startEditGeometrySession(app, layer);
        await session.featureSelection.selectFeature(feature);
        expect(feature).to.have.property(createSync, true);
        session.stop();
      });

      it('should set switchEnabled false on oblique maps', async () => {
        const session = startEditGeometrySession(app, layer);
        await app.maps.setActiveMap(obliqueMap.name);
        await session.featureSelection.selectFeature(feature);
        expect(obliqueMap.switchEnabled).to.be.false;
        session.stop();
        await app.maps.setActiveMap(defaultMap.name);
      });

      it('should set switchEnabled true if unselecting a feature', async () => {
        const session = startEditGeometrySession(app, layer);
        await app.maps.setActiveMap(obliqueMap.name);
        await session.featureSelection.selectFeature(feature);
        await session.featureSelection.clear();
        expect(obliqueMap.switchEnabled).to.be.true;
        session.stop();
        await app.maps.setActiveMap(defaultMap.name);
      });

      it('should not select unsupported geometries', async () => {
        const session = startEditGeometrySession(app, layer);
        const complexFeature = new Feature({ geometry: new MultiPoint([[1, 1, 0]]) });
        await session.featureSelection.selectFeature(complexFeature);
        expect(session.featureSelection.selectedFeature).to.be.null;
      });
    });

    describe('unselecting a feature', () => {
      let feature;

      before(async () => {
        feature = new Feature({ geometry: new Point([0, 0, 0]) });
      });

      after(async () => { // catch all if oblique spec throws
        await app.maps.setActiveMap(defaultMap.name);
      });

      it('should no longer have create sync set on the feature', async () => {
        const session = startEditGeometrySession(app, layer);
        await session.featureSelection.selectFeature(feature);
        session.featureSelection.clear();
        expect(feature).to.not.have.property(createSync);
        session.stop();
      });

      it('should reset switchEnabled on oblique maps', async () => {
        const session = startEditGeometrySession(app, layer);
        await app.maps.setActiveMap(obliqueMap.name);
        await session.featureSelection.selectFeature(feature);
        session.featureSelection.clear();
        expect(obliqueMap.switchEnabled).to.be.true;
        session.stop();
        await app.maps.setActiveMap(defaultMap.name);
      });
    });

    describe('unselecting a feature which is no longer valid', () => {
      let session;
      let feature;

      before(async () => {
        session = startEditGeometrySession(app, layer);
        feature = new Feature({ geometry: new LineString([[0, 0, 0]]) });
        layer.addFeatures([feature]);
        await session.featureSelection.selectFeature(feature);
        session.featureSelection.clear();
      });

      after(() => {
        session.stop();
      });

      it('should not longer have create sync set on the feature', () => {
        expect(feature).to.not.have.property(createSync);
      });

      it('should remove the feature from the layer', () => {
        expect(layer.getFeatures()).to.not.include(feature);
      });
    });
  });

  describe('stopping a session', () => {
    let session;

    beforeEach(() => {
      session = startEditGeometrySession(app, layer);
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
      const feature = new Feature({ geometry: new Point([0, 0, 0]) });
      await session.featureSelection.selectFeature(feature);
      session.stop();
      expect(feature).to.not.have.property(createSync);
    });

    it('should reset switchEnabled on oblique maps', async () => {
      await app.maps.setActiveMap(obliqueMap.name);
      const feature = new Feature({ geometry: new Point([0, 0, 0]) });
      layer.addFeatures([feature]);
      await session.featureSelection.selectFeature(feature);
      session.stop();
      expect(obliqueMap.switchEnabled).to.be.true;
      await app.maps.setActiveMap(defaultMap.name);
    });
  });

  describe('changing the active map', () => {
    let session;
    let otherMap;

    before(() => {
      otherMap = new OpenlayersMap({});
      app.maps.add(otherMap);
    });

    beforeEach(() => {
      session = startEditGeometrySession(app, layer);
    });

    afterEach(async () => {
      session.stop();
      await app.maps.setActiveMap(defaultMap.name);
      app.maps.remove(otherMap);
      otherMap.destroy();
    });

    it('should clear the current selection', async () => {
      const feature = new Feature({ geometry: new Point([0, 0, 0]) });
      await session.featureSelection.selectFeature(feature);
      await app.maps.setActiveMap(otherMap.name);
      expect(session.featureSelection.selectedFeature).to.be.null;
    });
  });

  describe('changing the active map to an oblique map', () => {
    let session;

    beforeEach(() => {
      session = startEditGeometrySession(app, layer);
    });

    afterEach(async () => {
      session.stop();
      await app.maps.setActiveMap(defaultMap.name);
    });

    it('should clear the current selection', async () => {
      const feature = new Feature({ geometry: new Point([0, 0, 0]) });
      await session.featureSelection.selectFeature(feature);
      await app.maps.setActiveMap(obliqueMap.name);
      expect(session.featureSelection.selectedFeature).to.be.null;
    });

    describe('image changed listener', async () => {
      beforeEach(async () => {
        await app.maps.setActiveMap(obliqueMap.name);
      });

      it('should clear the current selection', async () => {
        const feature = new Feature({ geometry: new Point([0, 0, 0]) });
        await session.featureSelection.selectFeature(feature);
        obliqueMap.imageChanged.raiseEvent();
        expect(session.featureSelection.selectedFeature).to.be.null;
      });
    });
  });

  describe('changing the active map from an oblique map', () => {
    let session;

    before(async () => {
      await app.maps.setActiveMap(obliqueMap.name);
      session = startEditGeometrySession(app, layer);
    });

    after(async () => {
      session.stop();
      await app.maps.setActiveMap(defaultMap.name);
    });

    it('should no longer listen to image changed', async () => {
      await app.maps.setActiveMap(defaultMap.name);
      const feature = new Feature({ geometry: new Point([0, 0, 0]) });
      await session.featureSelection.selectFeature(feature);
      obliqueMap.imageChanged.raiseEvent();
      expect(session.featureSelection.selectedFeature).to.equal(feature);
    });

    it('should reset switchEnabled, if a feature was selected', async () => {
      const feature = new Feature({ geometry: new Point([0, 0, 0]) });
      await session.featureSelection.selectFeature(feature);
      await app.maps.setActiveMap(defaultMap.name);
      expect(obliqueMap.switchEnabled).to.be.true;
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
