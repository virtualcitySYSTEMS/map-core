import { Point } from 'ol/geom.js';
import CreatePointInteraction from '../../../../../src/util/editor/interactions/createPointInteraction.js';
import { alreadyTransformedToImage } from '../../../../../src/layer/vectorSymbols.js';
import OpenlayersMap from '../../../../../src/map/openlayersMap.js';
import ObliqueMap from '../../../../../src/map/obliqueMap.js';
import { EventType } from '../../../../../index.js';

describe('CreatPointInteraction', () => {
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

  describe('handling click events', () => {
    describe('if the current map is not oblique', () => {
      let interaction;
      let geometry;
      let finished;

      before(async () => {
        interaction = new CreatePointInteraction();
        finished = sinon.spy();
        interaction.created.addEventListener((g) => {
          geometry = g;
        });
        interaction.finished.addEventListener(finished);
        await interaction.pipe({
          position: [1, 2, 0],
          positionOrPixel: [1, 2, 3],
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
        expect(geometry).to.have.property(alreadyTransformedToImage, false);
      });

      it('should set the geometry to be a point at positionOrPixel', () => {
        expect(geometry.getCoordinates()).to.have.ordered.members([1, 2, 3]);
      });

      it('should set itself to inactive', () => {
        expect(interaction.active).to.equal(EventType.NONE);
      });
    });

    describe('if the current map is oblique', () => {
      let interaction;
      let geometry;
      let finished;

      before(async () => {
        interaction = new CreatePointInteraction();
        finished = sinon.spy();
        interaction.created.addEventListener((g) => {
          geometry = g;
        });
        interaction.finished.addEventListener(finished);
        await interaction.pipe({
          position: [1, 1, 0],
          positionOrPixel: [1, 1, 1],
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
        expect(geometry.getCoordinates()).to.have.ordered.members([1, 1, 1]);
      });

      it('should set already transformed on the point', () => {
        expect(geometry).to.have.property(alreadyTransformedToImage, true);
      });

      it('should set itself to inactive', () => {
        expect(interaction.active).to.equal(EventType.NONE);
      });
    });
  });

  describe('finishing the interaction before the first click', () => {
    let interaction;
    let created;
    let finished;

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
    let interaction;
    let finished;

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
