import { expect } from 'chai';
import { Feature } from 'ol';
import sinon from 'sinon';
import { Circle, LineString, MultiPoint, Point, Polygon } from 'ol/geom.js';
import { Cartesian2, HeightReference } from '@vcmap-cesium/engine';
import type { EditGeometrySession, MapEvent } from '../../../../index.js';
import {
  createSync,
  EventType,
  ModificationKeyType,
  ObliqueMap,
  OpenlayersMap,
  PointerEventType,
  PointerKeyType,
  startEditGeometrySession,
} from '../../../../index.js';
import VcsApp from '../../../../src/vcsApp.js';
import VectorLayer from '../../../../src/layer/vectorLayer.js';
import InteractionChain from '../../../../src/interaction/interactionChain.js';
import { createFeatureWithId } from './transformation/setupTransformationHandler.js';

describe('EditGeometrySession', () => {
  let app: VcsApp;
  let layer: VectorLayer;
  let defaultMap: OpenlayersMap;
  let obliqueMap: ObliqueMap;
  let mapEvent: Pick<MapEvent, 'map' | 'windowPosition' | 'pointerEvent'>;

  before(async () => {
    defaultMap = new OpenlayersMap({});
    sinon.stub(defaultMap, 'getCurrentResolution').returns(0.05);
    app = new VcsApp();
    app.maps.add(defaultMap);
    obliqueMap = new ObliqueMap({});
    sinon.stub(obliqueMap, 'getCurrentResolution').returns(0.05);
    app.maps.add(obliqueMap);
    await app.maps.setActiveMap(defaultMap.name);
    layer = new VectorLayer({});
    app.layers.add(layer);
    mapEvent = {
      map: defaultMap,
      windowPosition: new Cartesian2(0, 0),
      pointerEvent: PointerEventType.UP,
    };
  });

  after(() => {
    app.destroy();
  });

  describe('starting a session', () => {
    let session: EditGeometrySession;
    let interactionChain: InteractionChain;

    beforeEach(() => {
      app.maps.eventHandler.exclusiveAdded.addEventListener((chain) => {
        interactionChain = chain as InteractionChain;
      });
      session = startEditGeometrySession(app, layer, undefined, {
        initialSnapToLayers: [],
      });
    });

    afterEach(() => {
      session.stop();
    });

    it('should add a an exclusive listener to the event handler', () => {
      expect(interactionChain).to.be.an.instanceof(InteractionChain);
    });

    it('should change the picking', () => {
      expect(app.maps.eventHandler.featureInteraction.pickPosition).to.equal(
        EventType.CLICKMOVE | EventType.DRAGEVENTS,
      );
    });

    it('should pause panorama selection', () => {
      expect(app.maps.pausePanoramaImageSelection).to.be.true;
    });

    describe('setting a feature', () => {
      let feature: Feature<Point>;

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

      it('should exclude the feature from picking', () => {
        expect(
          app.maps.eventHandler.featureInteraction.isExcludedFromPickPosition(
            feature,
          ),
        ).to.be.true;
      });

      describe('unsetting feature', () => {
        beforeEach(() => {
          session.setFeature();
        });

        it('should remove createSync', () => {
          expect(feature).to.not.have.property(createSync);
        });

        it('should include the feature in picking', () => {
          expect(
            app.maps.eventHandler.featureInteraction.isExcludedFromPickPosition(
              feature,
            ),
          ).to.be.false;
        });
      });
    });

    describe('line string editing', () => {
      let feature: Feature<LineString>;
      let vertices: Feature<Point>[];

      beforeEach(() => {
        feature = new Feature({
          geometry: new LineString([
            [0, 0, 0],
            [1, 1, 0],
          ]),
        });
        layer.addFeatures([feature]);
        session.setFeature(feature);
        vertices = (
          [...app.layers].pop()! as VectorLayer
        ).getFeatures() as Feature<Point>[];
      });

      it('should add vertices to the scratch layer', () => {
        expect(vertices).to.have.length(2);
      });

      it('should update the geometry, if changing a vertex', async () => {
        const vertex = vertices[0];
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAGSTART,
          feature: vertex,
          positionOrPixel: [0, 0, 0],
          ...mapEvent,
        });
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAG,
          feature: vertex,
          positionOrPixel: [1, 0, 0],
          ...mapEvent,
        });
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAGEND,
          feature: vertex,
          positionOrPixel: [1, 0, 0],
          ...mapEvent,
        });

        expect(
          feature.getGeometry()!.getCoordinates(),
        ).to.have.deep.ordered.members([
          [1, 0, 0],
          [1, 1, 0],
        ]);
      });

      it('should update the geometry, if removing a vertex', async () => {
        const vertex = vertices[0];
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.SHIFT,
          type: EventType.CLICK,
          feature: vertex,
          positionOrPixel: [0, 0, 0],
          ...mapEvent,
        });
        expect(
          feature.getGeometry()!.getCoordinates(),
        ).to.have.deep.ordered.members([[1, 1, 0]]);
      });

      it('should update the feature, on insert of a vertex', async () => {
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.CLICK,
          feature,
          positionOrPixel: [0.5, 0.5, 0],
          ...mapEvent,
        });

        expect(
          feature.getGeometry()!.getCoordinates(),
        ).to.have.deep.ordered.members([
          [0, 0, 0],
          [0.5, 0.5, 0],
          [1, 1, 0],
        ]);
      });
    });

    describe('polygon editing', () => {
      let feature: Feature<Polygon>;
      let vertices: Feature<Point>[];

      beforeEach(() => {
        feature = new Feature({
          geometry: new Polygon([
            [
              [0, 0, 0],
              [1, 1, 0],
              [0, 1, 0],
            ],
          ]),
        });
        layer.addFeatures([feature]);
        session.setFeature(feature);
        vertices = (
          [...app.layers].pop()! as VectorLayer
        ).getFeatures() as Feature<Point>[];
      });

      it('should add vertices to the scratch layer', () => {
        expect(vertices).to.have.length(3);
      });

      it('should update the geometry, if changing a vertex', async () => {
        const vertex = vertices[0];
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAGSTART,
          feature: vertex,
          positionOrPixel: [0, 0, 0],
          ...mapEvent,
        });
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAG,
          feature: vertex,
          positionOrPixel: [1, 0, 0],
          ...mapEvent,
        });
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAGEND,
          feature: vertex,
          positionOrPixel: [1, 0, 0],
          ...mapEvent,
        });
        expect(
          feature.getGeometry()!.getCoordinates(),
        ).to.have.deep.ordered.members([
          [
            [1, 0, 0],
            [1, 1, 0],
            [0, 1, 0],
          ],
        ]);
      });

      it('should update the geometry, if removing a vertex', async () => {
        const vertex = vertices[0];
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.SHIFT,
          type: EventType.CLICK,
          feature: vertex,
          positionOrPixel: [0, 0, 0],
          ...mapEvent,
        });

        expect(
          feature.getGeometry()!.getCoordinates(),
        ).to.have.deep.ordered.members([
          [
            [1, 1, 0],
            [0, 1, 0],
          ],
        ]);
      });

      it('should update the feature, on insert of a vertex', async () => {
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.CLICK,
          feature,
          positionOrPixel: [0.5, 0.5, 0],
          ...mapEvent,
        });
        expect(
          feature.getGeometry()!.getCoordinates(),
        ).to.have.deep.ordered.members([
          [
            [0, 0, 0],
            [0.5, 0.5, 0],
            [1, 1, 0],
            [0, 1, 0],
          ],
        ]);
      });
    });

    describe('point editing', () => {
      let feature: Feature<Point>;
      let vertices: Feature<Point>[];

      beforeEach(() => {
        feature = new Feature({ geometry: new Point([0, 0, 0]) });
        layer.addFeatures([feature]);
        session.setFeature(feature);
        vertices = (
          [...app.layers].pop()! as VectorLayer
        ).getFeatures() as Feature<Point>[];
      });

      it('should add vertices to the scratch layer', () => {
        expect(vertices).to.have.length(1);
      });

      it('should translate the point, if moving the center vertex', async () => {
        const vertex = vertices[0];
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAGSTART,
          feature: vertex,
          positionOrPixel: [0, 0, 0],
          ...mapEvent,
        });
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAG,
          feature: vertex,
          positionOrPixel: [1, 0, 0],
          ...mapEvent,
        });
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAGEND,
          feature: vertex,
          positionOrPixel: [1, 0, 0],
          ...mapEvent,
        });
        expect(feature.getGeometry()!.getCoordinates()).to.have.ordered.members(
          [1, 0, 0],
        );
      });
    });

    describe('circle editing', () => {
      let feature: Feature<Circle>;
      let vertices: Feature<Point>[];

      beforeEach(() => {
        feature = new Feature({ geometry: new Circle([0, 0, 0], 1, 'XYZ') });
        layer.addFeatures([feature]);
        session.setFeature(feature);
        vertices = (
          [...app.layers].pop()! as VectorLayer
        ).getFeatures() as Feature<Point>[];
      });

      it('should add vertices to the scratch layer', () => {
        expect(vertices).to.have.length(2);
      });

      it('should translate the circles center, if moving the center vertex', async () => {
        const vertex = vertices[0];
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAGSTART,
          feature: vertex,
          positionOrPixel: [0, 0, 0],
          ...mapEvent,
        });
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAG,
          feature: vertex,
          positionOrPixel: [1, 0, 0],
          ...mapEvent,
        });
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAGEND,
          feature: vertex,
          positionOrPixel: [1, 0, 0],
          ...mapEvent,
        });
        expect(feature.getGeometry()!.getCenter()).to.have.ordered.members([
          1, 0, 0,
        ]);
        expect(feature.getGeometry()!.getRadius()).to.equal(1);
      });

      it('should translate the circle radius, if moving the outer vertex', async () => {
        const vertex = vertices[1];
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAGSTART,
          feature: vertex,
          positionOrPixel: [1, 0, 0],
          ...mapEvent,
        });
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAG,
          feature: vertex,
          positionOrPixel: [2, 0, 0],
          ...mapEvent,
        });
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAGEND,
          feature: vertex,
          positionOrPixel: [2, 0, 0],
          ...mapEvent,
        });
        expect(feature.getGeometry()!.getCenter()).to.have.ordered.members([
          0, 0, 0,
        ]);
        expect(feature.getGeometry()!.getRadius()).to.equal(2);
      });
    });

    describe('bbox editing', () => {
      let feature: Feature<Polygon>;
      let vertices: Feature<Point>[];

      beforeEach(() => {
        const geometry = new Polygon([
          [
            [0, 0, 0],
            [1, 0, 0],
            [1, 1, 0],
            [0, 1, 0],
          ],
        ]);
        geometry.set('_vcsGeomType', 'BBox');
        feature = new Feature({ geometry });
        layer.addFeatures([feature]);
        session.setFeature(feature);
        vertices = (
          [...app.layers].pop()! as VectorLayer
        ).getFeatures() as Feature<Point>[];
      });

      it('should add vertices to the scratch layer', () => {
        expect(vertices).to.have.length(4);
      });

      it('should ensure bbox, if moving bottom left vertex', async () => {
        const vertex = vertices[0];
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAGSTART,
          feature: vertex,
          positionOrPixel: [0, 0, 0],
          ...mapEvent,
        });
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAG,
          feature: vertex,
          positionOrPixel: [-1, -1, 0],
          ...mapEvent,
        });
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAGEND,
          feature: vertex,
          positionOrPixel: [-1, -1, 0],
          ...mapEvent,
        });
        expect(
          feature.getGeometry()!.getCoordinates(),
        ).to.have.deep.ordered.members([
          [
            [-1, -1, 0],
            [1, -1, 0],
            [1, 1, 0],
            [-1, 1, 0],
          ],
        ]);
      });

      it('should ensure bbox, if moving bottom right vertex', async () => {
        const vertex = vertices[1];
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAGSTART,
          feature: vertex,
          positionOrPixel: [1, 0, 0],
          ...mapEvent,
        });
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAG,
          feature: vertex,
          positionOrPixel: [2, -1, 0],
          ...mapEvent,
        });
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAGEND,
          feature: vertex,
          positionOrPixel: [2, -1, 0],
          ...mapEvent,
        });
        expect(
          feature.getGeometry()!.getCoordinates(),
        ).to.have.deep.ordered.members([
          [
            [0, -1, 0],
            [2, -1, 0],
            [2, 1, 0],
            [0, 1, 0],
          ],
        ]);
      });

      it('should ensure bbox, if moving top right vertex', async () => {
        const vertex = vertices[2];
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAGSTART,
          feature: vertex,
          positionOrPixel: [1, 1, 0],
          ...mapEvent,
        });
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAG,
          feature: vertex,
          positionOrPixel: [2, 2, 0],
          ...mapEvent,
        });
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAGEND,
          feature: vertex,
          positionOrPixel: [2, 2, 0],
          ...mapEvent,
        });
        expect(
          feature.getGeometry()!.getCoordinates(),
        ).to.have.deep.ordered.members([
          [
            [0, 0, 0],
            [2, 0, 0],
            [2, 2, 0],
            [0, 2, 0],
          ],
        ]);
      });

      it('should ensure bbox, if moving top left vertex', async () => {
        const vertex = vertices[3];
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAGSTART,
          feature: vertex,
          positionOrPixel: [0, 1, 0],
          ...mapEvent,
        });
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAG,
          feature: vertex,
          positionOrPixel: [-1, 2, 0],
          ...mapEvent,
        });
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAGEND,
          feature: vertex,
          positionOrPixel: [-1, 2, 0],
          ...mapEvent,
        });
        expect(
          feature.getGeometry()!.getCoordinates(),
        ).to.have.deep.ordered.members([
          [
            [-1, 0, 0],
            [1, 0, 0],
            [1, 2, 0],
            [-1, 2, 0],
          ],
        ]);
      });

      it('should prevent collapsing of the bbox', async () => {
        const vertex = vertices[0];
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAGSTART,
          feature: vertex,
          positionOrPixel: [0, 0, 0],
          ...mapEvent,
        });
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAG,
          feature: vertex,
          positionOrPixel: [1, 1, 0],
          ...mapEvent,
        });
        await interactionChain.pipe({
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          type: EventType.DRAGEND,
          feature: vertex,
          positionOrPixel: [1, 1, 0],
          ...mapEvent,
        });
        const newVertexCoordinates = vertex.getGeometry()!.getCoordinates();
        expect(newVertexCoordinates).to.not.have.ordered.members([1, 1, 0]);
        expect(
          newVertexCoordinates.map((c) => Math.round(c)),
        ).to.have.ordered.members([1, 1, 0]);
      });
    });

    describe('unsupported geometries', () => {
      it('should not accept unsupported geometries', () => {
        const complexFeature = new Feature({
          geometry: new MultiPoint([[1, 1, 0]]),
        });
        session.setFeature(complexFeature);
        expect(session.feature).to.be.null;
      });
    });

    describe('unsetting invalid geometries', () => {
      it('should remove invalid geometries from layer', () => {
        const invalidFeature = new Feature({
          geometry: new LineString([[0, 0, 0]]),
        });
        const otherFeature = new Feature({ geometry: new Point([0, 0, 0]) });
        layer.addFeatures([invalidFeature]);
        session.setFeature(invalidFeature);
        session.setFeature(otherFeature);
        expect(layer.getFeatures()).to.not.include(invalidFeature);
      });
    });

    describe('setting olcs properties on a set feature', () => {
      let feature: Feature<Point>;
      let scratchLayer: VectorLayer;
      let scratchFeatures: Feature[];

      beforeEach(() => {
        feature = createFeatureWithId(new Point([0, 0, 0]));
        session.setFeature(feature);
        scratchLayer = [...app.layers].pop() as VectorLayer;
        scratchFeatures = scratchLayer.getFeatures();
      });

      it('should recalculate the handlers, when changing altitude mode', () => {
        feature.set('olcs_altitudeMode', 'absolute');
        expect(scratchLayer.getFeatures()[0]).to.not.equal(scratchFeatures[0])
          .and.to.not.be.undefined;
      });

      it('should set the altitude mode on the vertex', () => {
        feature.set('olcs_altitudeMode', 'absolute');
        expect(scratchLayer.getFeatures()[0].get('olcs_altitudeMode')).to.equal(
          'absolute',
        );
      });

      it('should recalculate the handlers, when changing ground level', () => {
        feature.set('olcs_groundLevel', 2);
        expect(scratchLayer.getFeatures()[0]).to.not.equal(scratchFeatures[0])
          .and.to.not.be.undefined;
      });

      it('should set the ground level on the vertex', () => {
        feature.set('olcs_groundLevel', 2);
        expect(scratchLayer.getFeatures()[0].get('olcs_groundLevel')).to.equal(
          2,
        );
      });

      it('should recalculate the handlers, when changing height above ground', () => {
        feature.set('olcs_heightAboveGround', 20);
        expect(scratchLayer.getFeatures()[0]).to.not.equal(scratchFeatures[0])
          .and.to.not.be.undefined;
      });

      it('should set the height above ground on the vertex', () => {
        feature.set('olcs_heightAboveGround', 2);
        expect(
          scratchLayer.getFeatures()[0].get('olcs_heightAboveGround'),
        ).to.equal(2);
      });
    });

    describe('setting vector properties on the layer', () => {
      let scratchLayer: VectorLayer;
      let initialAltitudeMode: HeightReference;
      let initialHeightAboveGround: number | undefined;
      let initialGroundLevel: number | undefined;

      before(() => {
        initialAltitudeMode = layer.vectorProperties.altitudeMode;
        initialGroundLevel = layer.vectorProperties.groundLevel;
        initialHeightAboveGround = layer.vectorProperties.heightAboveGround;
        scratchLayer = [...app.layers].pop() as VectorLayer;
      });

      afterEach(() => {
        layer.vectorProperties.altitudeMode = initialAltitudeMode;
        layer.vectorProperties.groundLevel = initialGroundLevel;
        layer.vectorProperties.heightAboveGround = initialHeightAboveGround;
      });

      it('should set the altitude mode on the scratchLayer', () => {
        layer.vectorProperties.altitudeMode = HeightReference.NONE;
        expect(scratchLayer.vectorProperties.altitudeMode).to.equal(
          HeightReference.NONE,
        );
      });

      it('should set the ground level on the scratch layer', () => {
        layer.vectorProperties.groundLevel = 12;
        expect(scratchLayer.vectorProperties.groundLevel).to.equal(12);
      });

      it('should set the height above ground on the scratch layer', () => {
        layer.vectorProperties.heightAboveGround = 12;
        expect(scratchLayer.vectorProperties.heightAboveGround).to.equal(12);
      });
    });
  });

  describe('starting a session with changed olcs properties on the layer', () => {
    let session: EditGeometrySession;
    let scratchLayer: VectorLayer;
    let initialAltitudeMode: HeightReference;
    let initialHeightAboveGround: number | undefined;
    let initialGroundLevel: number | undefined;

    before(() => {
      initialAltitudeMode = layer.vectorProperties.altitudeMode;
      initialGroundLevel = layer.vectorProperties.groundLevel;
      initialHeightAboveGround = layer.vectorProperties.heightAboveGround;
      layer.vectorProperties.altitudeMode = HeightReference.NONE;
      layer.vectorProperties.groundLevel = 12;
      layer.vectorProperties.heightAboveGround = 12;
      session = startEditGeometrySession(app, layer);
      scratchLayer = [...app.layers].pop() as VectorLayer;
    });

    after(() => {
      session.stop();
      layer.vectorProperties.altitudeMode = initialAltitudeMode;
      layer.vectorProperties.groundLevel = initialGroundLevel;
      layer.vectorProperties.heightAboveGround = initialHeightAboveGround;
    });

    it('should carry over vector properties already set on the layer onto the scratch layer', () => {
      expect(scratchLayer.vectorProperties.altitudeMode).to.equal(
        HeightReference.NONE,
      );
      expect(scratchLayer.vectorProperties.groundLevel).to.equal(12);
      expect(scratchLayer.vectorProperties.heightAboveGround).to.equal(12);
    });
  });

  describe('stopping a session', () => {
    let session: EditGeometrySession;
    let interactionChain: InteractionChain;

    beforeEach(() => {
      app.maps.eventHandler.exclusiveAdded.addEventListener((chain) => {
        interactionChain = chain as InteractionChain;
      });
      session = startEditGeometrySession(app, layer);
    });

    it('should remove the interaction', () => {
      session.stop();
      expect(app.maps.eventHandler.interactions).to.not.include(
        interactionChain,
      );
    });

    it('should call stopped', () => {
      const spy = sinon.spy();
      session.stopped.addEventListener(spy);
      session.stop();
      expect(spy).to.have.been.called;
    });

    it('should reset picking', () => {
      session.stop();
      expect(app.maps.eventHandler.featureInteraction.pickPosition).to.equal(
        EventType.CLICK,
      );
    });

    it('should unpause panorama selection', () => {
      expect(app.maps.pausePanoramaImageSelection).to.be.true;
      session.stop();
      expect(app.maps.pausePanoramaImageSelection).to.be.false;
    });

    describe('with a feature selected', () => {
      let feature: Feature<Point>;

      beforeEach(() => {
        feature = createFeatureWithId(new Point([0, 0, 0]));
        layer.addFeatures([feature]);
        session.setFeature(feature);
        session.stop();
      });

      it('should remove createSync', () => {
        expect(feature).to.not.have.property(createSync);
      });

      it('should include the feature in picking', () => {
        expect(
          app.maps.eventHandler.featureInteraction.isExcludedFromPickPosition(
            feature,
          ),
        ).to.be.false;
      });
    });
  });

  describe('forcefully removing a session', () => {
    let session: EditGeometrySession;

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

  describe('starting a session with disabled insertion and removal of vertices', () => {
    let session: EditGeometrySession;
    let feature: Feature<LineString>;
    let vertices: Feature<Point>[];
    let interactionChain: InteractionChain;

    beforeEach(() => {
      app.maps.eventHandler.exclusiveAdded.addEventListener((chain) => {
        interactionChain = chain as InteractionChain;
      });
      session = startEditGeometrySession(app, layer, undefined, {
        denyInsertion: true,
        denyRemoval: true,
      });
      feature = new Feature({
        geometry: new LineString([
          [0, 0, 0],
          [1, 1, 0],
        ]),
      });
      layer.addFeatures([feature]);
      session.setFeature(feature);
      vertices = (
        [...app.layers].pop()! as VectorLayer
      ).getFeatures() as Feature<Point>[];
    });

    afterEach(() => {
      session.stop();
    });

    it('should not insert a vertex', async () => {
      await interactionChain.pipe({
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        type: EventType.CLICK,
        feature,
        positionOrPixel: [0.5, 0.5, 0],
        ...mapEvent,
      });

      expect(
        feature.getGeometry()!.getCoordinates(),
      ).to.have.deep.ordered.members([
        [0, 0, 0],
        [1, 1, 0],
      ]);
    });

    it('should not remove a vertex', async () => {
      const vertex = vertices[0];

      await interactionChain.pipe({
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.SHIFT,
        type: EventType.CLICK,
        feature: vertex,
        positionOrPixel: [0, 0, 0],
        ...mapEvent,
      });

      expect(
        feature.getGeometry()!.getCoordinates(),
      ).to.have.deep.ordered.members([
        [0, 0, 0],
        [1, 1, 0],
      ]);
    });
  });
});
