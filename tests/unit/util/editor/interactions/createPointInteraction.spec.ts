import type { SinonSpy } from 'sinon';
import sinon from 'sinon';
import { expect } from 'chai';
import { Point } from 'ol/geom.js';
import { Cartesian2 } from '@vcmap-cesium/engine';
import CreatePointInteraction from '../../../../../src/util/editor/interactions/createPointInteraction.js';
import { alreadyTransformedToImage } from '../../../../../src/layer/vectorSymbols.js';
import OpenlayersMap from '../../../../../src/map/openlayersMap.js';
import ObliqueMap from '../../../../../src/map/obliqueMap.js';
import type { CesiumMap } from '../../../../../index.js';
import {
  alreadyTransformedToMercator,
  EventType,
  ModificationKeyType,
  PointerEventType,
  PointerKeyType,
} from '../../../../../index.js';
import { getCesiumMap } from '../../../helpers/cesiumHelpers.js';

describe('CreatPointInteraction', () => {
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

  describe('handling click events', () => {
    describe('if the current map is an openlayers map', () => {
      let interaction: CreatePointInteraction;
      let geometry: Point;
      let finished: SinonSpy;

      before(async () => {
        interaction = new CreatePointInteraction();
        finished = sinon.spy();
        interaction.created.addEventListener((g) => {
          geometry = g;
        });
        interaction.finished.addEventListener(finished);
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

      it('should call finished a point', () => {
        expect(finished).to.have.been.called;
        expect(finished.getCall(0).args[0]).to.be.an.instanceOf(Point);
      });

      it('should call created with a point', () => {
        expect(geometry).to.be.an.instanceOf(Point);
      });

      it('should set already transformed on the point to false', () => {
        expect(geometry).to.have.property(alreadyTransformedToMercator, true);
      });

      it('should set the geometry to be a point at positionOrPixel', () => {
        expect(geometry.getCoordinates()).to.have.ordered.members([1, 2]);
      });

      it('should set itself to inactive', () => {
        expect(interaction.active).to.equal(EventType.NONE);
      });

      it('should have an XY layout', () => {
        expect(geometry.getLayout()).to.equal('XY');
      });
    });

    describe('if the current map is an cesium map', () => {
      let interaction: CreatePointInteraction;
      let geometry: Point;
      let finished: SinonSpy;

      before(async () => {
        interaction = new CreatePointInteraction();
        finished = sinon.spy();
        interaction.created.addEventListener((g) => {
          geometry = g;
        });
        interaction.finished.addEventListener(finished);
        await interaction.pipe({
          ...eventBase,
          type: EventType.CLICK,
          position: [1, 2, 0],
          positionOrPixel: [1, 2, 3],
          map: cesiumMap,
        });
      });

      after(() => {
        interaction.destroy();
      });

      it('should call finished a point', () => {
        expect(finished).to.have.been.called;
        expect(finished.getCall(0).args[0]).to.be.an.instanceOf(Point);
      });

      it('should call created with a point', () => {
        expect(geometry).to.be.an.instanceOf(Point);
      });

      it('should set already transformed on the point to false', () => {
        expect(geometry).to.have.property(alreadyTransformedToMercator, true);
      });

      it('should set the geometry to be a point at positionOrPixel', () => {
        expect(geometry.getCoordinates()).to.have.ordered.members([1, 2, 3]);
      });

      it('should set itself to inactive', () => {
        expect(interaction.active).to.equal(EventType.NONE);
      });

      it('should have an XYZ layout', () => {
        expect(geometry.getLayout()).to.equal('XYZ');
      });
    });

    describe('if the current map is oblique', () => {
      let interaction: CreatePointInteraction;
      let geometry: Point;
      let finished: SinonSpy;

      before(async () => {
        interaction = new CreatePointInteraction();
        finished = sinon.spy();
        interaction.created.addEventListener((g) => {
          geometry = g;
        });
        interaction.finished.addEventListener(finished);
        await interaction.pipe({
          ...eventBase,
          type: EventType.CLICK,
          position: [1, 1],
          positionOrPixel: [1, 1],
          map: obliqueMap,
        });
      });

      after(() => {
        interaction.destroy();
      });

      it('should call finished Point', () => {
        expect(finished).to.have.been.called;
        expect(finished.getCall(0).args[0]).to.be.an.instanceOf(Point);
      });

      it('should call created with a point', () => {
        expect(geometry).to.be.an.instanceOf(Point);
      });

      it('should set the geometry to be a point at positionOrPixel', () => {
        expect(geometry.getCoordinates()).to.have.ordered.members([1, 1]);
      });

      it('should set already transformed on the point', () => {
        expect(geometry).to.have.property(alreadyTransformedToImage, true);
      });

      it('should set itself to inactive', () => {
        expect(interaction.active).to.equal(EventType.NONE);
      });

      it('should have an XY layout', () => {
        expect(geometry.getLayout()).to.equal('XY');
      });
    });
  });

  describe('finishing the interaction before the first click', () => {
    let interaction: CreatePointInteraction;
    let created: SinonSpy;
    let finished: SinonSpy;

    before(() => {
      interaction = new CreatePointInteraction();
      finished = sinon.spy();
      created = sinon.spy();
      interaction.created.addEventListener(created);
      interaction.finished.addEventListener(finished);
      interaction.finish();
    });

    after(() => {
      interaction.destroy();
    });

    it('should call finished false', () => {
      expect(finished).to.have.been.calledWith(null);
    });

    it('should not call created', () => {
      expect(created).to.not.have.been.called;
    });

    it('should set itself to inactive', () => {
      expect(interaction.active).to.equal(EventType.NONE);
    });
  });

  describe('finishing the interaction twice', () => {
    let interaction: CreatePointInteraction;
    let finished: SinonSpy;

    before(() => {
      interaction = new CreatePointInteraction();
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
