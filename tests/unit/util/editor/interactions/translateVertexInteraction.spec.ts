import { expect } from 'chai';
import { Feature } from 'ol';
import { Point } from 'ol/geom.js';
import sinon from 'sinon';
import { Cartesian2 } from '@vcmap-cesium/engine';
import {
  CesiumMap,
  emptyStyle,
  EventAfterEventHandler,
  EventType,
  ModificationKeyType,
  OpenlayersMap,
  PointerEventType,
  PointerKeyType,
  TranslateVertexInteraction,
  vertexSymbol,
} from '../../../../../index.js';
import { getCesiumMap } from '../../../helpers/cesiumHelpers.js';
import { timeout } from '../../../helpers/helpers.js';

describe('TranslateVertexInteraction', () => {
  let cesiumMap: CesiumMap;
  let openlayersMap: OpenlayersMap;

  before(() => {
    cesiumMap = getCesiumMap({});
    openlayersMap = new OpenlayersMap({});
  });

  after(() => {
    cesiumMap.destroy();
    openlayersMap.destroy();
  });

  describe('translating in 3D', () => {
    let baseEvent: Omit<EventAfterEventHandler, 'feature' | 'type'>;

    before(() => {
      baseEvent = {
        key: ModificationKeyType.NONE,
        position: [0, 0, 1],
        pointer: PointerKeyType.LEFT,
        pointerEvent: PointerEventType.DOWN,
        positionOrPixel: [0, 0, 1],
        windowPosition: new Cartesian2(0, 0),
        map: cesiumMap,
      };
    });

    describe('with 3D geometries', () => {
      describe('dragging the vertex', () => {
        let vertex: Feature<Point>;
        let vertexChangedListener: () => void;
        let feature: Feature;

        before(async () => {
          vertex = new Feature({ geometry: new Point([0, 0, 0]) });
          vertex[vertexSymbol] = true;
          vertexChangedListener = sinon.spy();
          feature = new Feature();

          const interaction = new TranslateVertexInteraction();
          interaction.vertexChanged.addEventListener(vertexChangedListener);
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAGSTART,
            ...baseEvent,
          });
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAG,
            ...baseEvent,
            positionOrPixel: [1, 1, 0],
          });
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAG,
            ...baseEvent,
            positionOrPixel: [2, 1, 0],
          });
          interaction.destroy();
        });

        it('should set the vertex geometry to the position of the event', () => {
          expect(
            vertex.getGeometry()!.getCoordinates(),
          ).to.have.ordered.members([2, 1, 0]);
        });

        it('should call vertexChanged for each drag event', () => {
          expect(vertexChangedListener).to.have.been.calledTwice;
          expect(vertexChangedListener).to.have.been.calledWithExactly(vertex);
        });

        it('should set the vertex style to be the empty style', () => {
          expect(vertex.getStyle()).to.equal(emptyStyle);
        });
      });

      describe('finish dragging the vertex', () => {
        let vertex: Feature<Point>;
        let vertexChangedListener: () => void;
        let feature: Feature;

        before(async () => {
          vertex = new Feature({ geometry: new Point([0, 0, 0]) });
          vertex[vertexSymbol] = true;
          vertexChangedListener = sinon.spy();
          feature = new Feature();

          const interaction = new TranslateVertexInteraction();
          interaction.vertexChanged.addEventListener(vertexChangedListener);
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAGSTART,
            ...baseEvent,
          });
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAG,
            ...baseEvent,
            positionOrPixel: [1, 1, 0],
          });
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAG,
            ...baseEvent,
            positionOrPixel: [2, 1, 0],
          });
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAGEND,
            ...baseEvent,
            positionOrPixel: [2, 1, 0],
          });
          interaction.destroy();
        });

        it('should set the vertex geometry to the position of the event', () => {
          expect(
            vertex.getGeometry()!.getCoordinates(),
          ).to.have.ordered.members([2, 1, 0]);
        });

        it('should call vertexChanged for each drag event & drag end event', () => {
          expect(vertexChangedListener).to.have.been.calledThrice;
          expect(vertexChangedListener).to.have.been.calledWithExactly(vertex);
        });

        it('should reset the vertex style after a short timeout', async () => {
          await timeout(10);
          expect(vertex.getStyle()).to.be.undefined;
        });
      });
    });

    describe('with 2D geometries', () => {
      describe('dragging the vertex', () => {
        let vertex: Feature<Point>;
        let vertexChangedListener: () => void;
        let feature: Feature;

        before(async () => {
          vertex = new Feature({ geometry: new Point([0, 0]) });
          vertex[vertexSymbol] = true;
          vertexChangedListener = sinon.spy();
          feature = new Feature();

          const interaction = new TranslateVertexInteraction();
          interaction.vertexChanged.addEventListener(vertexChangedListener);
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAGSTART,
            ...baseEvent,
          });
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAG,
            ...baseEvent,
            positionOrPixel: [1, 1, 0],
          });
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAG,
            ...baseEvent,
            positionOrPixel: [2, 1, 0],
          });
          interaction.destroy();
        });

        it('should set the vertex geometry to the position of the event', () => {
          expect(
            vertex.getGeometry()!.getCoordinates(),
          ).to.have.ordered.members([2, 1, 0]);
        });

        it('should call vertexChanged for each drag event', () => {
          expect(vertexChangedListener).to.have.been.calledTwice;
          expect(vertexChangedListener).to.have.been.calledWithExactly(vertex);
        });

        it('should set the vertex style to be the empty style', () => {
          expect(vertex.getStyle()).to.equal(emptyStyle);
        });
      });

      describe('finish dragging the vertex', () => {
        let vertex: Feature<Point>;
        let vertexChangedListener: () => void;
        let feature: Feature;

        before(async () => {
          vertex = new Feature({ geometry: new Point([0, 0]) });
          vertex[vertexSymbol] = true;
          vertexChangedListener = sinon.spy();
          feature = new Feature();

          const interaction = new TranslateVertexInteraction();
          interaction.vertexChanged.addEventListener(vertexChangedListener);
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAGSTART,
            ...baseEvent,
          });
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAG,
            ...baseEvent,
            positionOrPixel: [1, 1, 0],
          });
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAG,
            ...baseEvent,
            positionOrPixel: [2, 1, 0],
          });
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAGEND,
            ...baseEvent,
            positionOrPixel: [2, 1, 0],
          });
          interaction.destroy();
        });

        it('should set the vertex geometry to the position of the event', () => {
          expect(
            vertex.getGeometry()!.getCoordinates(),
          ).to.have.ordered.members([2, 1, 0]);
        });

        it('should call vertexChanged for each drag event & drag end event', () => {
          expect(vertexChangedListener).to.have.been.calledThrice;
          expect(vertexChangedListener).to.have.been.calledWithExactly(vertex);
        });

        it('should reset the vertex style after a short timeout', async () => {
          await timeout(10);
          expect(vertex.getStyle()).to.be.undefined;
        });

        it('should unset allow picking of the feature', () => {
          expect(feature.get('olcs_allowPicking')).to.be.undefined;
        });
      });
    });
  });

  describe('translating in 2D', () => {
    let baseEvent: Omit<EventAfterEventHandler, 'feature' | 'type'>;

    before(() => {
      baseEvent = {
        key: ModificationKeyType.NONE,
        position: [0, 0],
        pointer: PointerKeyType.LEFT,
        pointerEvent: PointerEventType.DOWN,
        positionOrPixel: [0, 0],
        windowPosition: new Cartesian2(0, 0),
        map: openlayersMap,
      };
    });

    describe('with 3D geometries', () => {
      describe('dragging the vertex', () => {
        let vertex: Feature<Point>;
        let vertexChangedListener: () => void;

        before(async () => {
          vertex = new Feature({ geometry: new Point([0, 0, 0]) });
          vertex[vertexSymbol] = true;
          vertexChangedListener = sinon.spy();

          const interaction = new TranslateVertexInteraction();
          interaction.vertexChanged.addEventListener(vertexChangedListener);
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAGSTART,
            ...baseEvent,
          });
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAG,
            ...baseEvent,
            positionOrPixel: [1, 1],
          });
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAG,
            ...baseEvent,
            positionOrPixel: [2, 1],
          });
          interaction.destroy();
        });

        it('should set the vertex geometry to the position of the event', () => {
          expect(
            vertex.getGeometry()!.getCoordinates(),
          ).to.have.ordered.members([2, 1]);
        });

        it('should call vertexChanged for each drag event', () => {
          expect(vertexChangedListener).to.have.been.calledTwice;
          expect(vertexChangedListener).to.have.been.calledWithExactly(vertex);
        });

        it('should set the vertex style to be the empty style', async () => {
          await timeout(10);
          expect(vertex.getStyle()).to.equal(emptyStyle);
        });
      });

      describe('finish dragging the vertex', () => {
        let vertex: Feature<Point>;
        let vertexChangedListener: () => void;
        let feature: Feature;

        before(async () => {
          vertex = new Feature({ geometry: new Point([0, 0, 0]) });
          vertex[vertexSymbol] = true;
          vertexChangedListener = sinon.spy();
          feature = new Feature();

          const interaction = new TranslateVertexInteraction();
          interaction.vertexChanged.addEventListener(vertexChangedListener);
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAGSTART,
            ...baseEvent,
          });
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAG,
            ...baseEvent,
            positionOrPixel: [1, 1],
          });
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAG,
            ...baseEvent,
            positionOrPixel: [2, 1],
          });
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAGEND,
            ...baseEvent,
            positionOrPixel: [2, 1],
          });
          interaction.destroy();
        });

        it('should set the vertex geometry to the position of the event', () => {
          expect(
            vertex.getGeometry()!.getCoordinates(),
          ).to.have.ordered.members([2, 1]);
        });

        it('should call vertexChanged for each drag event & drag end event', () => {
          expect(vertexChangedListener).to.have.been.calledThrice;
          expect(vertexChangedListener).to.have.been.calledWithExactly(vertex);
        });

        it('should reset the vertex style after a short timeout', async () => {
          await timeout(10);
          expect(vertex.getStyle()).to.be.undefined;
        });
      });
    });

    describe('with 2D geometries', () => {
      describe('dragging the vertex', () => {
        let vertex: Feature<Point>;
        let vertexChangedListener: () => void;

        before(async () => {
          vertex = new Feature({ geometry: new Point([0, 0]) });
          vertex[vertexSymbol] = true;
          vertexChangedListener = sinon.spy();

          const interaction = new TranslateVertexInteraction();
          interaction.vertexChanged.addEventListener(vertexChangedListener);
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAGSTART,
            ...baseEvent,
          });
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAG,
            ...baseEvent,
            positionOrPixel: [1, 1],
          });
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAG,
            ...baseEvent,
            positionOrPixel: [2, 1],
          });
          interaction.destroy();
        });

        it('should set the vertex geometry to the position of the event', () => {
          expect(
            vertex.getGeometry()!.getCoordinates(),
          ).to.have.ordered.members([2, 1]);
        });

        it('should call vertexChanged for each drag event', () => {
          expect(vertexChangedListener).to.have.been.calledTwice;
          expect(vertexChangedListener).to.have.been.calledWithExactly(vertex);
        });

        it('should set the vertex style to be the empty style after a short while', async () => {
          await timeout(10);
          expect(vertex.getStyle()).to.equal(emptyStyle);
        });
      });

      describe('finish dragging the vertex', () => {
        let vertex: Feature<Point>;
        let vertexChangedListener: () => void;

        before(async () => {
          vertex = new Feature({ geometry: new Point([0, 0]) });
          vertex[vertexSymbol] = true;
          vertexChangedListener = sinon.spy();

          const interaction = new TranslateVertexInteraction();
          interaction.vertexChanged.addEventListener(vertexChangedListener);
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAGSTART,
            ...baseEvent,
          });
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAG,
            ...baseEvent,
            positionOrPixel: [1, 1],
          });
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAG,
            ...baseEvent,
            positionOrPixel: [2, 1],
          });
          await interaction.pipe({
            feature: vertex,
            type: EventType.DRAGEND,
            ...baseEvent,
            positionOrPixel: [2, 1],
          });
          interaction.destroy();
        });

        it('should set the vertex geometry to the position of the event', () => {
          expect(
            vertex.getGeometry()!.getCoordinates(),
          ).to.have.ordered.members([2, 1]);
        });

        it('should call vertexChanged for each drag event & drag end event', () => {
          expect(vertexChangedListener).to.have.been.calledThrice;
          expect(vertexChangedListener).to.have.been.calledWithExactly(vertex);
        });

        it('should reset the vertex style', () => {
          expect(vertex.getStyle()).to.be.undefined;
        });
      });
    });
  });
});
