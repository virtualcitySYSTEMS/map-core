import { Polygon } from 'ol/geom.js';
import { expect } from 'chai';
import sinon, { SinonSpy } from 'sinon';
import { Cartesian2 } from '@vcmap-cesium/engine';
import CreateBBoxInteraction from '../../../../../src/util/editor/interactions/createBBoxInteraction.js';
import { GeometryType } from '../../../../../src/util/editor/editorSessionHelpers.js';
import { alreadyTransformedToImage } from '../../../../../src/layer/vectorSymbols.js';
import {
  EventType,
  ModificationKeyType,
  PointerEventType,
  PointerKeyType,
} from '../../../../../src/interaction/interactionType.js';
import OpenlayersMap from '../../../../../src/map/openlayersMap.js';
import ObliqueMap from '../../../../../src/map/obliqueMap.js';
import {
  alreadyTransformedToMercator,
  CesiumMap,
} from '../../../../../index.js';
import { getCesiumMap } from '../../../helpers/cesiumHelpers.js';

describe('CreateBBoxInteraction', () => {
  let openlayersMap: OpenlayersMap;
  let obliqueMap: ObliqueMap;
  let cesiumMap: CesiumMap;
  let eventBase: {
    key: ModificationKeyType;
    pointer: PointerKeyType;
    pointerEvent: PointerEventType;
    windowPosition: Cartesian2;
  };

  before(() => {
    eventBase = {
      key: ModificationKeyType.NONE,
      pointer: PointerKeyType.ALL,
      pointerEvent: PointerEventType.UP,
      windowPosition: new Cartesian2(0, 0),
    };
    openlayersMap = new OpenlayersMap({});
    obliqueMap = new ObliqueMap({});
    cesiumMap = getCesiumMap({});
  });

  after(() => {
    openlayersMap.destroy();
    obliqueMap.destroy();
    cesiumMap.destroy();
  });

  describe('handling the first click event', () => {
    describe('if the current map is an openlayers map', () => {
      let interaction: CreateBBoxInteraction;
      let geometry: Polygon;

      before(async () => {
        interaction = new CreateBBoxInteraction();
        interaction.created.addEventListener((g) => {
          geometry = g;
        });
        await interaction.pipe({
          ...eventBase,
          type: EventType.CLICK,
          position: [1, 2],
          positionOrPixel: [1, 2],
          map: openlayersMap,
        });
      });

      after(() => {
        interaction.destroy();
      });

      it('should call created with a Polygon', () => {
        expect(geometry).to.be.an.instanceOf(Polygon);
      });

      it('should set already transformed to true', () => {
        expect(geometry).to.have.property(alreadyTransformedToMercator, true);
      });

      it('should set the geometry to be a polygon at positionOrPixel', () => {
        expect(geometry.getCoordinates()).to.have.deep.ordered.members([
          [[1, 2]],
        ]);
      });

      it('should set the geometry vcsGeometryType', () => {
        expect(geometry.get('_vcsGeomType')).to.equal(GeometryType.BBox);
      });

      it('should have an XY layout', () => {
        expect(geometry.getLayout()).to.equal('XY');
      });
    });

    describe('if the current map is oblique', () => {
      let interaction: CreateBBoxInteraction;
      let geometry: Polygon;

      before(async () => {
        interaction = new CreateBBoxInteraction();
        interaction.created.addEventListener((g) => {
          geometry = g;
        });
        await interaction.pipe({
          key: ModificationKeyType.NONE,
          pointer: PointerKeyType.ALL,
          pointerEvent: PointerEventType.UP,
          windowPosition: new Cartesian2(0, 0),
          type: EventType.CLICK,
          position: [1, 2],
          positionOrPixel: [1, 2],
          map: obliqueMap,
        });
      });

      after(() => {
        interaction.destroy();
      });

      it('should call created with a Polygon', () => {
        expect(geometry).to.be.an.instanceOf(Polygon);
      });

      it('should set already transformed to true', () => {
        expect(geometry).to.have.property(alreadyTransformedToImage, true);
      });

      it('should set the geometry to be a polygon at positionOrPixel', () => {
        expect(geometry.getCoordinates()).to.have.deep.ordered.members([
          [[1, 2]],
        ]);
      });

      it('should have an XY layout', () => {
        expect(geometry.getLayout()).to.equal('XY');
      });
    });

    describe('if the current map is cesium', () => {
      let interaction: CreateBBoxInteraction;
      let geometry: Polygon;

      before(async () => {
        interaction = new CreateBBoxInteraction();
        interaction.created.addEventListener((g) => {
          geometry = g;
        });
        await interaction.pipe({
          ...eventBase,
          type: EventType.CLICK,
          position: [1, 2, 1],
          positionOrPixel: [1, 2, 3],
          map: cesiumMap,
        });
      });

      after(() => {
        interaction.destroy();
      });

      it('should call created with a Polygon', () => {
        expect(geometry).to.be.an.instanceOf(Polygon);
      });

      it('should set already transformed to true', () => {
        expect(geometry).to.have.property(alreadyTransformedToMercator, true);
      });

      it('should set the geometry to be a polygon at positionOrPixel', () => {
        expect(geometry.getCoordinates()).to.have.deep.ordered.members([
          [[1, 2, 3]],
        ]);
      });

      it('should set the geometry vcsGeometryType', () => {
        expect(geometry.get('_vcsGeomType')).to.equal(GeometryType.BBox);
      });

      it('should have an XY layout', () => {
        expect(geometry.getLayout()).to.equal('XYZ');
      });
    });
  });

  describe('creation in 3D', () => {
    describe('handling of move', () => {
      let interaction: CreateBBoxInteraction;
      let geometry: Polygon;

      before(async () => {
        interaction = new CreateBBoxInteraction();
        interaction.created.addEventListener((g) => {
          geometry = g;
        });
        await interaction.pipe({
          ...eventBase,
          type: EventType.CLICK,
          position: [1, 2, 1],
          positionOrPixel: [1, 2, 3],
          map: cesiumMap,
        });
      });

      after(() => {
        interaction.destroy();
      });

      describe('when moving south east', () => {
        before(async () => {
          await interaction.pipe({
            ...eventBase,
            type: EventType.MOVE,
            position: [2, 1, 1],
            positionOrPixel: [2, 1, 3],
            map: cesiumMap,
          });
        });

        it('should update the geometry to be a bbox', () => {
          expect(geometry).to.be.an.instanceOf(Polygon);
          expect(geometry.getCoordinates()).to.have.deep.ordered.members([
            [
              [1, 2, 3],
              [1, 1, 3],
              [2, 1, 3],
              [2, 2, 3],
            ],
          ]);
        });
      });

      describe('when moving north east', () => {
        before(async () => {
          await interaction.pipe({
            ...eventBase,
            type: EventType.MOVE,
            position: [2, 3, 0],
            positionOrPixel: [2, 3, 3],
            map: cesiumMap,
          });
        });

        it('should update the geometry to be a bbox', () => {
          expect(geometry).to.be.an.instanceOf(Polygon);
          expect(geometry.getCoordinates()).to.have.deep.ordered.members([
            [
              [1, 2, 3],
              [2, 2, 3],
              [2, 3, 3],
              [1, 3, 3],
            ],
          ]);
        });
      });

      describe('when moving north west', () => {
        before(async () => {
          await interaction.pipe({
            ...eventBase,
            type: EventType.MOVE,
            position: [0, 3, 0],
            positionOrPixel: [0, 3, 3],
            map: cesiumMap,
          });
        });

        it('should update the geometry to be a bbox', () => {
          expect(geometry).to.be.an.instanceOf(Polygon);
          expect(geometry.getCoordinates()).to.have.deep.ordered.members([
            [
              [1, 2, 3],
              [1, 3, 3],
              [0, 3, 3],
              [0, 2, 3],
            ],
          ]);
        });
      });

      describe('when moving south west', () => {
        before(async () => {
          await interaction.pipe({
            ...eventBase,
            type: EventType.MOVE,
            position: [0, 1, 0],
            positionOrPixel: [0, 1, 3],
            map: cesiumMap,
          });
        });

        it('should update the geometry to be a bbox', () => {
          expect(geometry).to.be.an.instanceOf(Polygon);
          expect(geometry.getCoordinates()).to.have.deep.ordered.members([
            [
              [1, 2, 3],
              [0, 2, 3],
              [0, 1, 3],
              [1, 1, 3],
            ],
          ]);
        });
      });

      describe('when moving on top of origin', () => {
        before(async () => {
          await interaction.pipe({
            ...eventBase,
            type: EventType.MOVE,
            position: [1, 2, 0],
            positionOrPixel: [1, 2, 3],
            map: cesiumMap,
          });
        });

        it('should update the geometry to be a bbox, preventing collapse', () => {
          expect(geometry).to.be.an.instanceOf(Polygon);
          expect(geometry.getCoordinates()).to.have.deep.ordered.members([
            [
              [1, 2, 3],
              [1.000001, 2, 3],
              [1.000001, 2.000001, 3],
              [1, 2.000001, 3],
            ],
          ]);
        });
      });

      describe('when moving on top of the x axis', () => {
        before(async () => {
          await interaction.pipe({
            ...eventBase,
            type: EventType.MOVE,
            position: [1, 3, 0],
            positionOrPixel: [1, 3, 3],
            map: cesiumMap,
          });
        });

        it('should update the geometry to be a bbox, preventing collapse', () => {
          expect(geometry).to.be.an.instanceOf(Polygon);
          expect(geometry.getCoordinates()).to.have.deep.ordered.members([
            [
              [1, 2, 3],
              [1, 3, 3],
              [1.000001, 3, 3],
              [1.000001, 2, 3],
            ],
          ]);
        });
      });

      describe('when moving on top of the y axis', () => {
        before(async () => {
          await interaction.pipe({
            ...eventBase,
            type: EventType.MOVE,
            position: [2, 2, 0],
            positionOrPixel: [2, 2, 3],
            map: cesiumMap,
          });
        });

        it('should update the geometry to be a bbox, preventing collapse', () => {
          expect(geometry).to.be.an.instanceOf(Polygon);
          expect(geometry.getCoordinates()).to.have.deep.ordered.members([
            [
              [1, 2, 3],
              [1, 2.000001, 3],
              [2, 2.000001, 3],
              [2, 2, 3],
            ],
          ]);
        });
      });
    });

    describe('handling the second click event', () => {
      let interaction: CreateBBoxInteraction;
      let geometry: Polygon;
      let finished: SinonSpy;

      before(async () => {
        interaction = new CreateBBoxInteraction();
        interaction.created.addEventListener((g) => {
          geometry = g;
        });
        finished = sinon.spy();
        interaction.finished.addEventListener(finished);
        await interaction.pipe({
          ...eventBase,
          type: EventType.CLICK,
          position: [1, 2, 0],
          positionOrPixel: [1, 2, 3],
          map: cesiumMap,
        });
        await interaction.pipe({
          ...eventBase,
          type: EventType.CLICK,
          position: [2, 2, 0],
          positionOrPixel: [2, 3, 3],
          map: cesiumMap,
        });
      });

      after(() => {
        interaction.destroy();
      });

      it('should update the geometry to be a bbox', () => {
        expect(geometry).to.be.an.instanceOf(Polygon);
        expect(geometry.getCoordinates()).to.have.deep.ordered.members([
          [
            [1, 2, 3],
            [2, 2, 3],
            [2, 3, 3],
            [1, 3, 3],
          ],
        ]);
      });

      it('should call finished true', () => {
        expect(finished).to.have.been.calledWith(geometry);
      });

      it('should set itself to inactive', () => {
        expect(interaction.active).to.equal(EventType.NONE);
      });
    });
  });

  describe('creation in 2D', () => {
    describe('handling of move', () => {
      let interaction: CreateBBoxInteraction;
      let geometry: Polygon;

      before(async () => {
        interaction = new CreateBBoxInteraction();
        interaction.created.addEventListener((g) => {
          geometry = g;
        });
        await interaction.pipe({
          ...eventBase,
          type: EventType.CLICK,
          position: [1, 2],
          positionOrPixel: [1, 2],
          map: openlayersMap,
        });
      });

      after(() => {
        interaction.destroy();
      });

      describe('when moving south east', () => {
        before(async () => {
          await interaction.pipe({
            ...eventBase,
            type: EventType.MOVE,
            position: [2, 1],
            positionOrPixel: [2, 1],
            map: openlayersMap,
          });
        });

        it('should update the geometry to be a bbox', () => {
          expect(geometry).to.be.an.instanceOf(Polygon);
          expect(geometry.getCoordinates()).to.have.deep.ordered.members([
            [
              [1, 2],
              [1, 1],
              [2, 1],
              [2, 2],
            ],
          ]);
        });
      });

      describe('when moving north east', () => {
        before(async () => {
          await interaction.pipe({
            ...eventBase,
            type: EventType.MOVE,
            position: [2, 3],
            positionOrPixel: [2, 3],
            map: openlayersMap,
          });
        });

        it('should update the geometry to be a bbox', () => {
          expect(geometry).to.be.an.instanceOf(Polygon);
          expect(geometry.getCoordinates()).to.have.deep.ordered.members([
            [
              [1, 2],
              [2, 2],
              [2, 3],
              [1, 3],
            ],
          ]);
        });
      });

      describe('when moving north west', () => {
        before(async () => {
          await interaction.pipe({
            ...eventBase,
            type: EventType.MOVE,
            position: [0, 3],
            positionOrPixel: [0, 3],
            map: openlayersMap,
          });
        });

        it('should update the geometry to be a bbox', () => {
          expect(geometry).to.be.an.instanceOf(Polygon);
          expect(geometry.getCoordinates()).to.have.deep.ordered.members([
            [
              [1, 2],
              [1, 3],
              [0, 3],
              [0, 2],
            ],
          ]);
        });
      });

      describe('when moving south west', () => {
        before(async () => {
          await interaction.pipe({
            ...eventBase,
            type: EventType.MOVE,
            position: [0, 1],
            positionOrPixel: [0, 1],
            map: openlayersMap,
          });
        });

        it('should update the geometry to be a bbox', () => {
          expect(geometry).to.be.an.instanceOf(Polygon);
          expect(geometry.getCoordinates()).to.have.deep.ordered.members([
            [
              [1, 2],
              [0, 2],
              [0, 1],
              [1, 1],
            ],
          ]);
        });
      });

      describe('when moving on top of origin', () => {
        before(async () => {
          await interaction.pipe({
            ...eventBase,
            type: EventType.MOVE,
            position: [1, 2],
            positionOrPixel: [1, 2],
            map: openlayersMap,
          });
        });

        it('should update the geometry to be a bbox, preventing collapse', () => {
          expect(geometry).to.be.an.instanceOf(Polygon);
          expect(geometry.getCoordinates()).to.have.deep.ordered.members([
            [
              [1, 2],
              [1.000001, 2],
              [1.000001, 2.000001],
              [1, 2.000001],
            ],
          ]);
        });
      });

      describe('when moving on top of the x axis', () => {
        before(async () => {
          await interaction.pipe({
            ...eventBase,
            type: EventType.MOVE,
            position: [1, 3],
            positionOrPixel: [1, 3],
            map: openlayersMap,
          });
        });

        it('should update the geometry to be a bbox, preventing collapse', () => {
          expect(geometry).to.be.an.instanceOf(Polygon);
          expect(geometry.getCoordinates()).to.have.deep.ordered.members([
            [
              [1, 2],
              [1, 3],
              [1.000001, 3],
              [1.000001, 2],
            ],
          ]);
        });
      });

      describe('when moving on top of the y axis', () => {
        before(async () => {
          await interaction.pipe({
            ...eventBase,
            type: EventType.MOVE,
            position: [2, 2],
            positionOrPixel: [2, 2],
            map: openlayersMap,
          });
        });

        it('should update the geometry to be a bbox, preventing collapse', () => {
          expect(geometry).to.be.an.instanceOf(Polygon);
          expect(geometry.getCoordinates()).to.have.deep.ordered.members([
            [
              [1, 2],
              [1, 2.000001],
              [2, 2.000001],
              [2, 2],
            ],
          ]);
        });
      });
    });

    describe('handling the second click event', () => {
      let interaction: CreateBBoxInteraction;
      let geometry: Polygon;
      let finished: SinonSpy;

      before(async () => {
        interaction = new CreateBBoxInteraction();
        interaction.created.addEventListener((g) => {
          geometry = g;
        });
        finished = sinon.spy();
        interaction.finished.addEventListener(finished);
        await interaction.pipe({
          ...eventBase,
          type: EventType.CLICK,
          position: [1, 2],
          positionOrPixel: [1, 2],
          map: openlayersMap,
        });
        await interaction.pipe({
          ...eventBase,
          type: EventType.CLICK,
          position: [2, 2],
          positionOrPixel: [2, 3],
          map: openlayersMap,
        });
      });

      after(() => {
        interaction.destroy();
      });

      it('should update the geometry to be a bbox', () => {
        expect(geometry).to.be.an.instanceOf(Polygon);
        expect(geometry.getCoordinates()).to.have.deep.ordered.members([
          [
            [1, 2],
            [2, 2],
            [2, 3],
            [1, 3],
          ],
        ]);
      });

      it('should call finished true', () => {
        expect(finished).to.have.been.calledWith(geometry);
      });

      it('should set itself to inactive', () => {
        expect(interaction.active).to.equal(EventType.NONE);
      });
    });
  });

  describe('finishing the interaction before the first click', () => {
    let interaction: CreateBBoxInteraction;
    let created: SinonSpy;
    let finished: SinonSpy;

    before(() => {
      interaction = new CreateBBoxInteraction();
      finished = sinon.spy();
      created = sinon.spy();
      interaction.created.addEventListener(created);
      interaction.finished.addEventListener(finished);
      interaction.finish();
    });

    after(() => {
      interaction.destroy();
    });

    it('should call finished null', () => {
      expect(finished).to.have.been.calledWith(null);
    });

    it('should not call created', () => {
      expect(created).to.not.have.been.called;
    });

    it('should set itself to inactive', () => {
      expect(interaction.active).to.equal(EventType.NONE);
    });
  });

  describe('finishing the interaction after the first click', () => {
    let interaction: CreateBBoxInteraction;
    let created: SinonSpy;
    let finished: SinonSpy;

    before(async () => {
      interaction = new CreateBBoxInteraction();
      finished = sinon.spy();
      created = sinon.spy();
      interaction.created.addEventListener(created);
      interaction.finished.addEventListener(finished);
      await interaction.pipe({
        ...eventBase,
        type: EventType.CLICK,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
        map: cesiumMap,
      });
      interaction.finish();
    });

    after(() => {
      interaction.destroy();
    });

    it('should call finished with a polygon', () => {
      expect(finished).to.have.been.called;
      expect(finished.getCall(0).args[0]).to.be.an.instanceOf(Polygon);
    });

    it('should call created', () => {
      expect(created).to.have.been.called;
    });

    it('should set itself to inactive', () => {
      expect(interaction.active).to.equal(EventType.NONE);
    });
  });

  describe('finishing the interaction twice', () => {
    let interaction: CreateBBoxInteraction;
    let finished: SinonSpy;

    before(() => {
      interaction = new CreateBBoxInteraction();
      finished = sinon.spy();
      interaction.finished.addEventListener(finished);
      interaction.finish();
      interaction.finish();
    });

    after(() => {
      interaction.destroy();
    });

    it('should call finished only once', () => {
      expect(finished).to.have.been.calledOnce;
    });
  });
});
