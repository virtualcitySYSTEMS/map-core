import { expect } from 'chai';
import sinon, { SinonSpy } from 'sinon';
import { Polygon } from 'ol/geom.js';
import { Cartesian2 } from '@vcmap-cesium/engine';
import CreatePolygonInteraction, {
  validityPlaceholder,
} from '../../../../../src/util/editor/interactions/createPolygonInteraction.js';
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

describe('CreatePolygonInteraction', () => {
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
      let interaction: CreatePolygonInteraction;
      let geometry: Polygon;

      before(async () => {
        interaction = new CreatePolygonInteraction();
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

      it('should set already transformed on the geometry', () => {
        expect(geometry).to.have.property(alreadyTransformedToMercator, true);
      });

      it('should set the geometry to be a polygon with starting coordinates at positionOrPixel', () => {
        expect(geometry.getCoordinates()).to.have.deep.ordered.members([
          [[1, 2]],
        ]);
      });

      it('should have an XY layout', () => {
        expect(geometry.getLayout()).to.equal('XY');
      });

      it('should have the validity placeholder symbol set', () => {
        expect(geometry).to.have.property(validityPlaceholder, true);
      });
    });

    describe('if the current map is an cesium map', () => {
      let interaction: CreatePolygonInteraction;
      let geometry: Polygon;

      before(async () => {
        interaction = new CreatePolygonInteraction();
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

      it('should set already transformed on the geometry', () => {
        expect(geometry).to.have.property(alreadyTransformedToMercator, true);
      });

      it('should set the geometry to be a polygon with starting coordinates at positionOrPixel', () => {
        expect(geometry.getCoordinates()).to.have.deep.ordered.members([
          [[1, 2, 3]],
        ]);
      });

      it('should have an XYZ layout', () => {
        expect(geometry.getLayout()).to.equal('XYZ');
      });

      it('should have the validity placeholder symbol set', () => {
        expect(geometry).to.have.property(validityPlaceholder, true);
      });
    });

    describe('if the current map is oblique', () => {
      let interaction: CreatePolygonInteraction;
      let geometry: Polygon;

      before(async () => {
        interaction = new CreatePolygonInteraction();
        interaction.created.addEventListener((g) => {
          geometry = g;
        });
        await interaction.pipe({
          ...eventBase,
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

      it('should set the alreadyTransformedToImage symbol on the geometry', () => {
        expect(geometry).to.have.property(alreadyTransformedToImage, true);
      });

      it('should set the geometry to be a polygon with starting coordinates at positionOrPixel', () => {
        expect(geometry.getCoordinates()).to.have.deep.ordered.members([
          [[1, 2]],
        ]);
      });

      it('should have an XY layout', () => {
        expect(geometry.getLayout()).to.equal('XY');
      });

      it('should have the validity placeholder symbol set', () => {
        expect(geometry).to.have.property(validityPlaceholder, true);
      });
    });
  });

  describe('creation in 3D', () => {
    describe('handling of move', () => {
      let interaction: CreatePolygonInteraction;
      let geometry: Polygon;

      before(async () => {
        interaction = new CreatePolygonInteraction();
        interaction.created.addEventListener((g) => {
          geometry = g;
        });
        await interaction.pipe({
          ...eventBase,
          type: EventType.CLICK,
          position: [1, 2, 0],
          positionOrPixel: [1, 2, 3],
          map: cesiumMap,
        });
        await interaction.pipe({
          ...eventBase,
          type: EventType.MOVE,
          position: [2, 2, 0],
          positionOrPixel: [2, 2, 3],
          map: cesiumMap,
        });
      });

      after(() => {
        interaction.destroy();
      });

      it('should update the geometries coordinates, including a validity dummy', () => {
        expect(geometry).to.be.an.instanceOf(Polygon);
        expect(geometry.getCoordinates()).to.have.deep.ordered.members([
          [
            [1, 2, 3],
            [2, 2, 3],
            [1, 2, 3],
          ],
        ]);
      });
    });

    describe('handling the second click event', () => {
      let interaction: CreatePolygonInteraction;
      let geometry: Polygon;

      before(async () => {
        interaction = new CreatePolygonInteraction();
        interaction.created.addEventListener((g) => {
          geometry = g;
        });
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
          positionOrPixel: [2, 2, 3],
          map: cesiumMap,
        });
      });

      after(() => {
        interaction.destroy();
      });

      it('should update the geometries coordinates, including a validity dummy', () => {
        expect(geometry).to.be.an.instanceOf(Polygon);
        expect(geometry.getCoordinates()).to.have.deep.ordered.members([
          [
            [1, 2, 3],
            [2, 2, 3],
            [1, 2, 3],
          ],
        ]);
      });

      it('should have the validity placeholder symbol set to false', () => {
        expect(geometry).to.have.property(validityPlaceholder, false);
      });
    });

    describe('handling of move after the second click event', () => {
      let interaction: CreatePolygonInteraction;
      let geometry: Polygon;

      before(async () => {
        interaction = new CreatePolygonInteraction();
        interaction.created.addEventListener((g) => {
          geometry = g;
        });
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
          positionOrPixel: [2, 2, 3],
          map: cesiumMap,
        });
        await interaction.pipe({
          ...eventBase,
          type: EventType.MOVE,
          position: [2, 2, 0],
          positionOrPixel: [2, 1, 3],
          map: cesiumMap,
        });
      });

      after(() => {
        interaction.destroy();
      });

      it('should update the geometries coordinates, no longer changing the validity dummy', () => {
        expect(geometry).to.be.an.instanceOf(Polygon);
        expect(geometry.getCoordinates()).to.have.deep.ordered.members([
          [
            [1, 2, 3],
            [2, 2, 3],
            [2, 1, 3],
          ],
        ]);
      });
    });

    describe('handling a double click after the second click', () => {
      let interaction: CreatePolygonInteraction;
      let geometry: Polygon;
      let finished: SinonSpy;

      before(async () => {
        interaction = new CreatePolygonInteraction();
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
          positionOrPixel: [2, 2, 3],
          map: cesiumMap,
        });
        await interaction.pipe({
          ...eventBase,
          type: EventType.CLICK,
          position: [2, 2, 0],
          positionOrPixel: [2, 1, 3],
          map: cesiumMap,
        });
        await interaction.pipe({
          ...eventBase,
          type: EventType.DBLCLICK,
          position: [2, 2, 0],
          positionOrPixel: [2, 1, 3],
          map: cesiumMap,
        });
      });

      after(() => {
        interaction.destroy();
      });

      it('should update the geometries coordinates', () => {
        expect(geometry).to.be.an.instanceOf(Polygon);
        expect(geometry.getCoordinates()).to.have.deep.ordered.members([
          [
            [1, 2, 3],
            [2, 2, 3],
            [2, 1, 3],
          ],
        ]);
      });

      it('should call finished with Polygon', () => {
        expect(finished).to.have.been.called;
        expect(finished.getCall(0).args[0]).to.be.an.instanceOf(Polygon);
      });

      it('should set itself to inactive', () => {
        expect(interaction.active).to.equal(EventType.NONE);
      });
    });
  });

  describe('creation in 2D', () => {
    describe('handling of move', () => {
      let interaction: CreatePolygonInteraction;
      let geometry: Polygon;

      before(async () => {
        interaction = new CreatePolygonInteraction();
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
        await interaction.pipe({
          ...eventBase,
          type: EventType.MOVE,
          position: [2, 2],
          positionOrPixel: [2, 2],
          map: openlayersMap,
        });
      });

      after(() => {
        interaction.destroy();
      });

      it('should update the geometries coordinates, including a validity dummy', () => {
        expect(geometry).to.be.an.instanceOf(Polygon);
        expect(geometry.getCoordinates()).to.have.deep.ordered.members([
          [
            [1, 2],
            [2, 2],
            [1, 2],
          ],
        ]);
      });
    });

    describe('handling the second click event', () => {
      let interaction: CreatePolygonInteraction;
      let geometry: Polygon;

      before(async () => {
        interaction = new CreatePolygonInteraction();
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
        await interaction.pipe({
          ...eventBase,
          type: EventType.CLICK,
          position: [2, 2],
          positionOrPixel: [2, 2],
          map: openlayersMap,
        });
      });

      after(() => {
        interaction.destroy();
      });

      it('should update the geometries coordinates, including a validity dummy', () => {
        expect(geometry).to.be.an.instanceOf(Polygon);
        expect(geometry.getCoordinates()).to.have.deep.ordered.members([
          [
            [1, 2],
            [2, 2],
            [1, 2],
          ],
        ]);
      });

      it('should have the validity placeholder symbol set to false', () => {
        expect(geometry).to.have.property(validityPlaceholder, false);
      });
    });

    describe('handling of move after the second click event', () => {
      let interaction: CreatePolygonInteraction;
      let geometry: Polygon;

      before(async () => {
        interaction = new CreatePolygonInteraction();
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
        await interaction.pipe({
          ...eventBase,
          type: EventType.CLICK,
          position: [2, 2],
          positionOrPixel: [2, 2],
          map: openlayersMap,
        });
        await interaction.pipe({
          ...eventBase,
          type: EventType.MOVE,
          position: [2, 2],
          positionOrPixel: [2, 1],
          map: openlayersMap,
        });
      });

      after(() => {
        interaction.destroy();
      });

      it('should update the geometries coordinates, no longer changing the validity dummy', () => {
        expect(geometry).to.be.an.instanceOf(Polygon);
        expect(geometry.getCoordinates()).to.have.deep.ordered.members([
          [
            [1, 2],
            [2, 2],
            [2, 1],
          ],
        ]);
      });
    });

    describe('handling a double click after the second click', () => {
      let interaction: CreatePolygonInteraction;
      let geometry: Polygon;
      let finished: SinonSpy;

      before(async () => {
        interaction = new CreatePolygonInteraction();
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
          positionOrPixel: [2, 2],
          map: openlayersMap,
        });
        await interaction.pipe({
          ...eventBase,
          type: EventType.CLICK,
          position: [2, 2],
          positionOrPixel: [2, 1],
          map: openlayersMap,
        });
        await interaction.pipe({
          ...eventBase,
          type: EventType.DBLCLICK,
          position: [2, 2],
          positionOrPixel: [2, 1],
          map: openlayersMap,
        });
      });

      after(() => {
        interaction.destroy();
      });

      it('should update the geometries coordinates', () => {
        expect(geometry).to.be.an.instanceOf(Polygon);
        expect(geometry.getCoordinates()).to.have.deep.ordered.members([
          [
            [1, 2],
            [2, 2],
            [2, 1],
          ],
        ]);
      });

      it('should call finished with Polygon', () => {
        expect(finished).to.have.been.called;
        expect(finished.getCall(0).args[0]).to.be.an.instanceOf(Polygon);
      });

      it('should set itself to inactive', () => {
        expect(interaction.active).to.equal(EventType.NONE);
      });
    });
  });

  describe('finishing the interaction before the second click', () => {
    let interaction: CreatePolygonInteraction;
    let created: SinonSpy;
    let finished: SinonSpy;

    before(async () => {
      interaction = new CreatePolygonInteraction();
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

    it('should call finished with Polygon', () => {
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
    let interaction: CreatePolygonInteraction;
    let finished: SinonSpy;

    before(() => {
      interaction = new CreatePolygonInteraction();
      finished = sinon.spy();
      interaction.finished.addEventListener(finished);
      interaction.finish();
    });

    after(() => {
      interaction.destroy();
    });

    it('should call finished once', () => {
      expect(finished).to.have.been.calledOnce;
    });
  });
});
