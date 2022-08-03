import { Circle } from 'ol/geom.js';
import CreateCircleInteraction from '../../../../../src/util/editor/interactions/createCircleInteraction.js';
import { alreadyTransformedToImage, actuallyIsCircle } from '../../../../../src/layer/vectorSymbols.js';
import { EventType } from '../../../../../src/interaction/interactionType.js';
import OpenlayersMap from '../../../../../src/map/openlayersMap.js';
import ObliqueMap from '../../../../../src/map/obliqueMap.js';

describe('CreateCircleInteraction', () => {
  let openlayersMap;
  let obliqueMap;

  before(() => {
    openlayersMap = new OpenlayersMap({});
    obliqueMap = new ObliqueMap({});
  });

  after(() => {
    openlayersMap.destroy();
    obliqueMap.destroy();
  });

  describe('handling the first click event', () => {
    describe('if the current map is not oblique', () => {
      let interaction;
      let geometry;

      before(async () => {
        interaction = new CreateCircleInteraction();
        interaction.created.addEventListener((g) => {
          geometry = g;
        });
        await interaction.pipe({
          type: EventType.CLICK,
          position: [1, 2, 0],
          positionOrPixel: [1, 2, 3],
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
        expect(geometry).to.have.property(alreadyTransformedToImage, false);
      });

      it('should set the geometry to be a circle with center at positionOrPixel', () => {
        expect(geometry.getCenter()).to.have.ordered.members([1, 2, 3]);
      });
    });

    describe('if the current map is oblique', () => {
      let interaction;
      let geometry;

      before(async () => {
        interaction = new CreateCircleInteraction();
        interaction.created.addEventListener((g) => {
          geometry = g;
        });
        await interaction.pipe({
          type: EventType.CLICK,
          position: [1, 2, 0],
          positionOrPixel: [1, 2, 3],
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
        expect(geometry.getCenter()).to.have.ordered.members([1, 2, 3]);
      });
    });
  });

  describe('handling of move', () => {
    let interaction;
    let geometry;

    before(async () => {
      interaction = new CreateCircleInteraction();
      interaction.created.addEventListener((g) => {
        geometry = g;
      });
      await interaction.pipe({
        type: EventType.CLICK,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
        map: openlayersMap,
      });
      await interaction.pipe({
        type: EventType.MOVE,
        position: [2, 2, 0],
        positionOrPixel: [2, 2, 3],
        map: openlayersMap,
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
    let interaction;
    let geometry;
    let finished;

    before(async () => {
      interaction = new CreateCircleInteraction();
      interaction.created.addEventListener((g) => {
        geometry = g;
      });
      finished = sinon.spy();
      interaction.finished.addEventListener(finished);
      await interaction.pipe({
        type: EventType.CLICK,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
        map: openlayersMap,
      });
      await interaction.pipe({
        type: EventType.CLICK,
        position: [2, 2, 0],
        positionOrPixel: [2, 2, 3],
        map: openlayersMap,
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

  describe('finishing the interaction before the first click', () => {
    let interaction;
    let created;
    let finished;

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
    let interaction;
    let finished;

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
    let interaction;
    let created;
    let finished;

    before(async () => {
      interaction = new CreateCircleInteraction();
      finished = sinon.spy();
      created = sinon.spy();
      interaction.created.addEventListener(created);
      interaction.finished.addEventListener(finished);
      await interaction.pipe({
        type: EventType.CLICK,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
        map: openlayersMap,
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
