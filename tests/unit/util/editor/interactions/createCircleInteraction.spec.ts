import { Circle } from 'ol/geom.js';
import { Cartesian2 } from '@vcmap-cesium/engine';
import { expect } from 'chai';
import sinon, { SinonSpy } from 'sinon';
import CreateCircleInteraction from '../../../../../src/util/editor/interactions/createCircleInteraction.js';
import {
  alreadyTransformedToImage,
  actuallyIsCircle,
} from '../../../../../src/layer/vectorSymbols.js';
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

describe('CreateCircleInteraction', () => {
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
      let interaction: CreateCircleInteraction;
      let geometry: Circle;

      before(async () => {
        interaction = new CreateCircleInteraction();
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

      it('should call created with a circle', () => {
        expect(geometry).to.be.an.instanceOf(Circle);
      });

      it('should set already transformed on the circle', () => {
        expect(geometry).to.have.property(alreadyTransformedToMercator, true);
      });

      it('should set the geometry to be a circle with center at positionOrPixel', () => {
        expect(geometry.getCenter()).to.have.ordered.members([1, 2]);
      });

      it('should have an XY layout', () => {
        expect(geometry.getLayout()).to.equal('XY');
      });
    });

    describe('if the current map is an cesium map', () => {
      let interaction: CreateCircleInteraction;
      let geometry: Circle;

      before(async () => {
        interaction = new CreateCircleInteraction();
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
      });

      after(() => {
        interaction.destroy();
      });

      it('should call created with a circle', () => {
        expect(geometry).to.be.an.instanceOf(Circle);
      });

      it('should set already transformed on the circle', () => {
        expect(geometry).to.have.property(alreadyTransformedToMercator, true);
      });

      it('should set the geometry to be a circle with center at positionOrPixel', () => {
        expect(geometry.getCenter()).to.have.ordered.members([1, 2, 3]);
      });

      it('should have an XY layout', () => {
        expect(geometry.getLayout()).to.equal('XYZ');
      });
    });

    describe('if the current map is oblique', () => {
      let interaction: CreateCircleInteraction;
      let geometry: Circle;

      before(async () => {
        interaction = new CreateCircleInteraction();
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

      it('should call created with a circle', () => {
        expect(geometry).to.be.an.instanceOf(Circle);
      });

      it('should set already transformed on the circle', () => {
        expect(geometry).to.have.property(alreadyTransformedToImage, true);
      });

      it('should set actually is a circle', () => {
        expect(geometry).to.have.property(actuallyIsCircle, true);
      });

      it('should set the geometry to be a circle with center at positionOrPixel', () => {
        expect(geometry.getCenter()).to.have.ordered.members([1, 2]);
      });

      it('should have an XY layout', () => {
        expect(geometry.getLayout()).to.equal('XY');
      });
    });
  });

  describe('creation of 3D', () => {
    describe('handling of move', () => {
      let interaction: CreateCircleInteraction;
      let geometry: Circle;

      before(async () => {
        interaction = new CreateCircleInteraction();
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

      it('should update the geometries radius', () => {
        expect(geometry).to.be.an.instanceOf(Circle);
        expect(geometry.getCenter()).to.have.ordered.members([1, 2, 3]);
        expect(geometry.getRadius()).to.equal(1);
      });
    });

    describe('handling the second click event', () => {
      let interaction: CreateCircleInteraction;
      let geometry: Circle;
      let finished: SinonSpy;

      before(async () => {
        interaction = new CreateCircleInteraction();
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
      });

      after(() => {
        interaction.destroy();
      });

      it('should update the geometries radius', () => {
        expect(geometry).to.be.an.instanceOf(Circle);
        expect(geometry.getCenter()).to.have.ordered.members([1, 2, 3]);
        expect(geometry.getRadius()).to.equal(1);
      });

      it('should call finished circle', () => {
        expect(finished).to.have.been.calledWith(geometry);
      });

      it('should set itself to inactive', () => {
        expect(interaction.active).to.equal(EventType.NONE);
      });
    });
  });

  describe('creation of 2D', () => {
    describe('handling of move', () => {
      let interaction: CreateCircleInteraction;
      let geometry: Circle;

      before(async () => {
        interaction = new CreateCircleInteraction();
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

      it('should update the geometries radius', () => {
        expect(geometry).to.be.an.instanceOf(Circle);
        expect(geometry.getCenter()).to.have.ordered.members([1, 2]);
        expect(geometry.getRadius()).to.equal(1);
      });
    });

    describe('handling the second click event', () => {
      let interaction: CreateCircleInteraction;
      let geometry: Circle;
      let finished: SinonSpy;

      before(async () => {
        interaction = new CreateCircleInteraction();
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
      });

      after(() => {
        interaction.destroy();
      });

      it('should update the geometries radius', () => {
        expect(geometry).to.be.an.instanceOf(Circle);
        expect(geometry.getCenter()).to.have.ordered.members([1, 2]);
        expect(geometry.getRadius()).to.equal(1);
      });

      it('should call finished circle', () => {
        expect(finished).to.have.been.calledWith(geometry);
      });

      it('should set itself to inactive', () => {
        expect(interaction.active).to.equal(EventType.NONE);
      });
    });
  });

  describe('finishing the interaction before the first click', () => {
    let interaction: CreateCircleInteraction;
    let created: SinonSpy;
    let finished: SinonSpy;

    before(() => {
      interaction = new CreateCircleInteraction();
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
    let interaction: CreateCircleInteraction;
    let finished: SinonSpy;

    before(() => {
      interaction = new CreateCircleInteraction();
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

  describe('finishing the interaction after the first click', () => {
    let interaction: CreateCircleInteraction;
    let created: SinonSpy;
    let finished: SinonSpy;

    before(async () => {
      interaction = new CreateCircleInteraction();
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

    it('should call finished circle', () => {
      expect(finished).to.have.been.called;
      expect(finished.getCall(0).args[0]).to.be.an.instanceOf(Circle);
    });

    it('should call created', () => {
      expect(created).to.have.been.called;
    });

    it('should set itself to inactive', () => {
      expect(interaction.active).to.equal(EventType.NONE);
    });
  });
});
