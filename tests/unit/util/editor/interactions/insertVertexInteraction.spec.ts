import { expect } from 'chai';
import type { SinonSpy } from 'sinon';
import sinon from 'sinon';
import { Cartesian2 } from '@vcmap-cesium/engine';
import { Feature } from 'ol';
import { LineString, Polygon } from 'ol/geom.js';
import type { VertexInsertedEvent } from '../../../../../src/util/editor/interactions/insertVertexInteraction.js';
import InsertVertexInteraction from '../../../../../src/util/editor/interactions/insertVertexInteraction.js';
import type { CesiumMap } from '../../../../../index.js';
import {
  EventType,
  ModificationKeyType,
  OpenlayersMap,
  PointerEventType,
  PointerKeyType,
  VectorProperties,
} from '../../../../../index.js';
import { getCesiumMap } from '../../../helpers/cesiumHelpers.js';

describe('InsertVertexInteraction', () => {
  let cesiumMap: CesiumMap;
  let openlayersMap: OpenlayersMap;
  let vectorProperties: VectorProperties;
  let eventBase: {
    type: EventType;
    key: ModificationKeyType;
    pointer: PointerKeyType;
    pointerEvent: PointerEventType;
    windowPosition: Cartesian2;
  };

  before(() => {
    eventBase = {
      type: EventType.CLICK,
      key: ModificationKeyType.NONE,
      pointer: PointerKeyType.ALL,
      pointerEvent: PointerEventType.UP,
      windowPosition: new Cartesian2(0, 0),
    };
    openlayersMap = new OpenlayersMap({});
    cesiumMap = getCesiumMap({});
    cesiumMap.getCurrentResolution = (): number => 1;
    vectorProperties = new VectorProperties({});
  });

  after(() => {
    cesiumMap.destroy();
    openlayersMap.destroy();
    vectorProperties.destroy();
  });

  describe('inserting into geometries in 3D', () => {
    describe('if the geometry is a 3D line string', () => {
      let feature: Feature<LineString>;
      let interaction: InsertVertexInteraction;

      before(() => {
        const geometry = new LineString([
          [0, 0, 0],
          [1, 1, 0],
          [2, 2, 0],
        ]);
        feature = new Feature({ geometry });
        interaction = new InsertVertexInteraction(
          feature,
          geometry,
          vectorProperties,
        );
      });

      after(() => {
        interaction.destroy();
      });

      describe('clicking on the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [0.5, 0.5, 0],
            positionOrPixel: [0.5, 0.5, 0],
            map: cesiumMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.have.been.calledOnce;
        });

        it('should create a vertex at the clicked location', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event)
            .to.have.property('vertex')
            .and.to.be.an.instanceOf(Feature);
          expect(
            event.vertex.getGeometry()?.getCoordinates(),
          ).to.have.ordered.members([0.5, 0.5, 0]);
        });

        it('should return the index at which to insert the new index', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event).to.have.property('index', 1);
        });
      });

      describe('clicking close to the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [1.5, 1, 0],
            positionOrPixel: [1.5, 1, 0],
            map: cesiumMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.have.been.calledOnce;
        });

        it('should create a vertex at the clicked location', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event)
            .to.have.property('vertex')
            .and.to.be.an.instanceOf(Feature);
          expect(
            event.vertex.getGeometry()?.getCoordinates(),
          ).to.have.ordered.members([1.25, 1.25, 0]);
        });

        it('should return the index at which to insert the new index', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event).to.have.property('index', 2);
        });
      });

      describe('clicking far from the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [10.5, 5, 0],
            positionOrPixel: [10.5, 5, 0],
            map: cesiumMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.not.have.been.called;
        });
      });
    });

    describe('if the geometry is a 2D line string', () => {
      let feature: Feature<LineString>;
      let interaction: InsertVertexInteraction;

      before(() => {
        const geometry = new LineString([
          [0, 0],
          [1, 1],
          [2, 2],
        ]);
        feature = new Feature({ geometry });
        interaction = new InsertVertexInteraction(
          feature,
          geometry,
          vectorProperties,
        );
      });

      after(() => {
        interaction.destroy();
      });

      describe('clicking on the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [0.5, 0.5, 0],
            positionOrPixel: [0.5, 0.5, 0],
            map: cesiumMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.have.been.calledOnce;
        });

        it('should create a vertex at the clicked location', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event)
            .to.have.property('vertex')
            .and.to.be.an.instanceOf(Feature);
          expect(
            event.vertex.getGeometry()?.getCoordinates(),
          ).to.have.ordered.members([0.5, 0.5]);
        });

        it('should return the index at which to insert the new index', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event).to.have.property('index', 1);
        });
      });

      describe('clicking close to the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [1.5, 1, 0],
            positionOrPixel: [1.5, 1, 0],
            map: cesiumMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.have.been.calledOnce;
        });

        it('should create a vertex at the clicked location', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event)
            .to.have.property('vertex')
            .and.to.be.an.instanceOf(Feature);
          expect(
            event.vertex.getGeometry()?.getCoordinates(),
          ).to.have.ordered.members([1.25, 1.25]);
        });

        it('should return the index at which to insert the new index', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event).to.have.property('index', 2);
        });
      });

      describe('clicking far from the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [10.5, 5, 0],
            positionOrPixel: [10.5, 5, 0],
            map: cesiumMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.not.have.been.called;
        });
      });
    });

    describe('if the geometry is a 3D linear ring', () => {
      let feature: Feature<Polygon>;
      let interaction: InsertVertexInteraction;

      before(() => {
        const polygon = new Polygon([
          [
            [0, 0, 0],
            [0, 1, 0],
            [1, 1, 0],
          ],
        ]);
        const geometry = polygon.getLinearRing(0)!;
        feature = new Feature({ geometry: polygon });
        interaction = new InsertVertexInteraction(
          feature,
          geometry,
          vectorProperties,
        );
      });

      after(() => {
        interaction.destroy();
      });

      describe('clicking on the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [0, 0.5, 0],
            positionOrPixel: [0, 0.5, 0],
            map: cesiumMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.have.been.calledOnce;
        });

        it('should create a vertex at the clicked location', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event)
            .to.have.property('vertex')
            .and.to.be.an.instanceOf(Feature);
          expect(
            event.vertex.getGeometry()?.getCoordinates(),
          ).to.have.ordered.members([0, 0.5, 0]);
        });

        it('should return the index at which to insert the new index', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event).to.have.property('index', 1);
        });
      });

      describe('clicking close to the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [1.5, 1, 0],
            positionOrPixel: [1.5, 1, 0],
            map: cesiumMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.have.been.calledOnce;
        });

        it('should create a vertex at the clicked location', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event)
            .to.have.property('vertex')
            .and.to.be.an.instanceOf(Feature);
          expect(
            event.vertex.getGeometry()?.getCoordinates(),
          ).to.have.ordered.members([1, 1, 0]);
        });

        it('should return the index at which to insert the new index', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event).to.have.property('index', 2);
        });
      });

      describe('clicking far from the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [10.5, 5, 0],
            positionOrPixel: [10.5, 5, 0],
            map: cesiumMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.not.have.been.called;
        });
      });

      describe('clicking the closing edge of the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [0.5, 0.5, 0],
            positionOrPixel: [0.5, 0.5, 0],
            map: cesiumMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.have.been.calledOnce;
        });

        it('should create a vertex at the clicked location', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event)
            .to.have.property('vertex')
            .and.to.be.an.instanceOf(Feature);
          expect(
            event.vertex.getGeometry()?.getCoordinates(),
          ).to.have.ordered.members([0.5, 0.5, 0]);
        });

        it('should return the index at which to insert the new index', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event).to.have.property('index', 3);
        });
      });
    });

    describe('if the geometry is a 2D linear ring', () => {
      let feature: Feature<Polygon>;
      let interaction: InsertVertexInteraction;

      before(() => {
        const polygon = new Polygon([
          [
            [0, 0],
            [0, 1],
            [1, 1],
          ],
        ]);
        const geometry = polygon.getLinearRing(0)!;
        feature = new Feature({ geometry: polygon });
        interaction = new InsertVertexInteraction(
          feature,
          geometry,
          vectorProperties,
        );
      });

      after(() => {
        interaction.destroy();
      });

      describe('clicking on the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [0, 0.5, 0],
            positionOrPixel: [0, 0.5, 0],
            map: cesiumMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.have.been.calledOnce;
        });

        it('should create a vertex at the clicked location', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event)
            .to.have.property('vertex')
            .and.to.be.an.instanceOf(Feature);
          expect(
            event.vertex.getGeometry()?.getCoordinates(),
          ).to.have.ordered.members([0, 0.5]);
        });

        it('should return the index at which to insert the new index', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event).to.have.property('index', 1);
        });
      });

      describe('clicking close to the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [1.5, 1, 0],
            positionOrPixel: [1.5, 1, 0],
            map: cesiumMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.have.been.calledOnce;
        });

        it('should create a vertex at the clicked location', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event)
            .to.have.property('vertex')
            .and.to.be.an.instanceOf(Feature);
          expect(
            event.vertex.getGeometry()?.getCoordinates(),
          ).to.have.ordered.members([1, 1]);
        });

        it('should return the index at which to insert the new index', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event).to.have.property('index', 2);
        });
      });

      describe('clicking far from the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [10.5, 5, 0],
            positionOrPixel: [10.5, 5, 0],
            map: cesiumMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.not.have.been.called;
        });
      });

      describe('clicking the closing edge of the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [0.5, 0.5, 0],
            positionOrPixel: [0.5, 0.5, 0],
            map: cesiumMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.have.been.calledOnce;
        });

        it('should create a vertex at the clicked location', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event)
            .to.have.property('vertex')
            .and.to.be.an.instanceOf(Feature);
          expect(
            event.vertex.getGeometry()?.getCoordinates(),
          ).to.have.ordered.members([0.5, 0.5]);
        });

        it('should return the index at which to insert the new index', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event).to.have.property('index', 3);
        });
      });
    });
  });

  describe('inserting into geometries in 2D', () => {
    describe('if the geometry is a 3D line string', () => {
      let feature: Feature<LineString>;
      let interaction: InsertVertexInteraction;

      before(() => {
        const geometry = new LineString([
          [0, 0, 0],
          [1, 1, 0],
          [2, 2, 0],
        ]);
        feature = new Feature({ geometry });
        interaction = new InsertVertexInteraction(
          feature,
          geometry,
          vectorProperties,
        );
      });

      after(() => {
        interaction.destroy();
      });

      describe('clicking on the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [0.5, 0.5],
            positionOrPixel: [0.5, 0.5],
            map: openlayersMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.have.been.calledOnce;
        });

        it('should create a vertex at the clicked location', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event)
            .to.have.property('vertex')
            .and.to.be.an.instanceOf(Feature);
          expect(
            event.vertex.getGeometry()?.getCoordinates(),
          ).to.have.ordered.members([0.5, 0.5, 0]);
        });

        it('should return the index at which to insert the new index', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event).to.have.property('index', 1);
        });
      });

      describe('clicking close to the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [1.5, 1],
            positionOrPixel: [1.5, 1],
            map: openlayersMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.have.been.calledOnce;
        });

        it('should create a vertex at the clicked location', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event)
            .to.have.property('vertex')
            .and.to.be.an.instanceOf(Feature);
          expect(
            event.vertex.getGeometry()?.getCoordinates(),
          ).to.have.ordered.members([1.25, 1.25, 0]);
        });

        it('should return the index at which to insert the new index', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event).to.have.property('index', 2);
        });
      });

      describe('clicking far from the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [10.5, 5],
            positionOrPixel: [10.5, 5],
            map: openlayersMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.not.have.been.called;
        });
      });
    });

    describe('if the geometry is a 2D line string', () => {
      let feature: Feature<LineString>;
      let interaction: InsertVertexInteraction;

      before(() => {
        const geometry = new LineString([
          [0, 0],
          [1, 1],
          [2, 2],
        ]);
        feature = new Feature({ geometry });
        interaction = new InsertVertexInteraction(
          feature,
          geometry,
          vectorProperties,
        );
      });

      after(() => {
        interaction.destroy();
      });

      describe('clicking on the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [0.5, 0.5],
            positionOrPixel: [0.5, 0.5],
            map: openlayersMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.have.been.calledOnce;
        });

        it('should create a vertex at the clicked location', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event)
            .to.have.property('vertex')
            .and.to.be.an.instanceOf(Feature);
          expect(
            event.vertex.getGeometry()?.getCoordinates(),
          ).to.have.ordered.members([0.5, 0.5]);
        });

        it('should return the index at which to insert the new index', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event).to.have.property('index', 1);
        });
      });

      describe('clicking close to the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [1.5, 1],
            positionOrPixel: [1.5, 1],
            map: openlayersMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.have.been.calledOnce;
        });

        it('should create a vertex at the clicked location', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event)
            .to.have.property('vertex')
            .and.to.be.an.instanceOf(Feature);
          expect(
            event.vertex.getGeometry()?.getCoordinates(),
          ).to.have.ordered.members([1.25, 1.25]);
        });

        it('should return the index at which to insert the new index', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event).to.have.property('index', 2);
        });
      });

      describe('clicking far from the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [10.5, 5],
            positionOrPixel: [10.5, 5],
            map: openlayersMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.not.have.been.called;
        });
      });
    });

    describe('if the geometry is a 3D linear ring', () => {
      let feature: Feature<Polygon>;
      let interaction: InsertVertexInteraction;

      before(() => {
        const polygon = new Polygon([
          [
            [0, 0, 0],
            [0, 1, 0],
            [1, 1, 0],
          ],
        ]);
        const geometry = polygon.getLinearRing(0)!;
        feature = new Feature({ geometry: polygon });
        interaction = new InsertVertexInteraction(
          feature,
          geometry,
          vectorProperties,
        );
      });

      after(() => {
        interaction.destroy();
      });

      describe('clicking on the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [0, 0.5],
            positionOrPixel: [0, 0.5],
            map: openlayersMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.have.been.calledOnce;
        });

        it('should create a vertex at the clicked location', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event)
            .to.have.property('vertex')
            .and.to.be.an.instanceOf(Feature);
          expect(
            event.vertex.getGeometry()?.getCoordinates(),
          ).to.have.ordered.members([0, 0.5, 0]);
        });

        it('should return the index at which to insert the new index', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event).to.have.property('index', 1);
        });
      });

      describe('clicking close to the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [1.5, 1],
            positionOrPixel: [1.5, 1],
            map: openlayersMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.have.been.calledOnce;
        });

        it('should create a vertex at the clicked location', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event)
            .to.have.property('vertex')
            .and.to.be.an.instanceOf(Feature);
          expect(
            event.vertex.getGeometry()?.getCoordinates(),
          ).to.have.ordered.members([1, 1, 0]);
        });

        it('should return the index at which to insert the new index', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event).to.have.property('index', 2);
        });
      });

      describe('clicking far from the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [10.5, 5],
            positionOrPixel: [10.5, 5],
            map: openlayersMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.not.have.been.called;
        });
      });

      describe('clicking the closing edge of the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [0.5, 0.5],
            positionOrPixel: [0.5, 0.5],
            map: openlayersMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.have.been.calledOnce;
        });

        it('should create a vertex at the clicked location', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event)
            .to.have.property('vertex')
            .and.to.be.an.instanceOf(Feature);
          expect(
            event.vertex.getGeometry()?.getCoordinates(),
          ).to.have.ordered.members([0.5, 0.5, 0]);
        });

        it('should return the index at which to insert the new index', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event).to.have.property('index', 3);
        });
      });
    });

    describe('if the geometry is a 2D linear ring', () => {
      let feature: Feature<Polygon>;
      let interaction: InsertVertexInteraction;

      before(() => {
        const polygon = new Polygon([
          [
            [0, 0],
            [0, 1],
            [1, 1],
          ],
        ]);
        const geometry = polygon.getLinearRing(0)!;
        feature = new Feature({ geometry: polygon });
        interaction = new InsertVertexInteraction(
          feature,
          geometry,
          vectorProperties,
        );
      });

      after(() => {
        interaction.destroy();
      });

      describe('clicking on the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [0, 0.5],
            positionOrPixel: [0, 0.5],
            map: openlayersMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.have.been.calledOnce;
        });

        it('should create a vertex at the clicked location', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event)
            .to.have.property('vertex')
            .and.to.be.an.instanceOf(Feature);
          expect(
            event.vertex.getGeometry()?.getCoordinates(),
          ).to.have.ordered.members([0, 0.5]);
        });

        it('should return the index at which to insert the new index', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event).to.have.property('index', 1);
        });
      });

      describe('clicking close to the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [1.5, 1],
            positionOrPixel: [1.5, 1],
            map: openlayersMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.have.been.calledOnce;
        });

        it('should create a vertex at the clicked location', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event)
            .to.have.property('vertex')
            .and.to.be.an.instanceOf(Feature);
          expect(
            event.vertex.getGeometry()?.getCoordinates(),
          ).to.have.ordered.members([1, 1]);
        });

        it('should return the index at which to insert the new index', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event).to.have.property('index', 2);
        });
      });

      describe('clicking far from the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [10.5, 5],
            positionOrPixel: [10.5, 5],
            map: openlayersMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.not.have.been.called;
        });
      });

      describe('clicking the closing edge of the feature', () => {
        let vertexInsertedListener: SinonSpy<VertexInsertedEvent[]>;

        before(async () => {
          vertexInsertedListener = sinon.spy() as SinonSpy<
            VertexInsertedEvent[]
          >;
          interaction.vertexInserted.addEventListener(vertexInsertedListener);
          await interaction.pipe({
            ...eventBase,
            feature,
            position: [0.5, 0.5],
            positionOrPixel: [0.5, 0.5],
            map: openlayersMap,
          });
        });

        after(() => {
          interaction.vertexInserted.removeEventListener(
            vertexInsertedListener,
          );
        });

        it('should call vertex added', () => {
          expect(vertexInsertedListener).to.have.been.calledOnce;
        });

        it('should create a vertex at the clicked location', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event)
            .to.have.property('vertex')
            .and.to.be.an.instanceOf(Feature);
          expect(
            event.vertex.getGeometry()?.getCoordinates(),
          ).to.have.ordered.members([0.5, 0.5]);
        });

        it('should return the index at which to insert the new index', () => {
          const [event] = vertexInsertedListener.getCall(0).args;
          expect(event).to.have.property('index', 3);
        });
      });
    });
  });
});
