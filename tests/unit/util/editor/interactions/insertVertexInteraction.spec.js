import { Feature } from 'ol';
import { LineString, LinearRing } from 'ol/geom.js';
import InsertVertexInteraction from '../../../../../src/util/editor/interactions/insertVertexInteraction.js';
import { OpenlayersMap } from '../../../../../index.js';

describe('InsertVertexInteraction', () => {
  let map;

  before(() => {
    map = new OpenlayersMap({});
  });

  after(() => {
    map.destroy();
  });

  describe('if the geometry is a line string', () => {
    let feature;
    let interaction;

    before(() => {
      feature = new Feature();
      const geometry = new LineString([[0, 0, 0], [1, 1, 0], [2, 2, 0]]);
      interaction = new InsertVertexInteraction(feature, geometry);
    });

    after(() => {
      interaction.destroy();
    });

    describe('clicking on the feature', () => {
      let vertexInsertedListener;

      before(async () => {
        vertexInsertedListener = sinon.spy();
        interaction.vertexInserted.addEventListener(vertexInsertedListener);
        await interaction.pipe({ feature, positionOrPixel: [0.5, 0.5, 0], map });
      });

      after(() => {
        interaction.vertexInserted.removeEventListener(vertexInsertedListener);
      });

      it('should call vertex added', async () => {
        expect(vertexInsertedListener).to.have.been.calledOnce;
      });

      it('should create a vertex at the clicked location', () => {
        const [event] = vertexInsertedListener.getCall(0).args;
        expect(event).to.have.property('vertex').and.to.be.an.instanceOf(Feature);
        expect(event.vertex.getGeometry().getCoordinates()).to.have.ordered.members([0.5, 0.5, 0]);
      });

      it('should return the index at which to insert the new index', () => {
        const [event] = vertexInsertedListener.getCall(0).args;
        expect(event).to.have.property('index', 1);
      });
    });

    describe('clicking close to the feature', () => {
      let vertexInsertedListener;

      before(async () => {
        vertexInsertedListener = sinon.spy();
        interaction.vertexInserted.addEventListener(vertexInsertedListener);
        await interaction.pipe({ feature, positionOrPixel: [1.5, 1, 0], map });
      });

      after(() => {
        interaction.vertexInserted.removeEventListener(vertexInsertedListener);
      });

      it('should call vertex added', async () => {
        expect(vertexInsertedListener).to.have.been.calledOnce;
      });

      it('should create a vertex at the clicked location', () => {
        const [event] = vertexInsertedListener.getCall(0).args;
        expect(event).to.have.property('vertex').and.to.be.an.instanceOf(Feature);
        expect(event.vertex.getGeometry().getCoordinates()).to.have.ordered.members([1.25, 1.25, 0]);
      });

      it('should return the index at which to insert the new index', () => {
        const [event] = vertexInsertedListener.getCall(0).args;
        expect(event).to.have.property('index', 2);
      });
    });

    describe('clicking far from the feature', () => {
      let vertexInsertedListener;

      before(async () => {
        vertexInsertedListener = sinon.spy();
        interaction.vertexInserted.addEventListener(vertexInsertedListener);
        await interaction.pipe({ feature, positionOrPixel: [10.5, 5, 0], map });
      });

      after(() => {
        interaction.vertexInserted.removeEventListener(vertexInsertedListener);
      });

      it('should call vertex added', async () => {
        expect(vertexInsertedListener).to.not.have.been.called;
      });
    });
  });

  describe('if the geometry is a linear ring', () => {
    let feature;
    let interaction;

    before(() => {
      feature = new Feature();
      const geometry = new LinearRing([[0, 0, 0], [0, 1, 0], [1, 1, 0]]);
      interaction = new InsertVertexInteraction(feature, geometry);
    });

    after(() => {
      interaction.destroy();
    });

    describe('clicking on the feature', () => {
      let vertexInsertedListener;

      before(async () => {
        vertexInsertedListener = sinon.spy();
        interaction.vertexInserted.addEventListener(vertexInsertedListener);
        await interaction.pipe({ feature, positionOrPixel: [0, 0.5, 0], map });
      });

      after(() => {
        interaction.vertexInserted.removeEventListener(vertexInsertedListener);
      });

      it('should call vertex added', async () => {
        expect(vertexInsertedListener).to.have.been.calledOnce;
      });

      it('should create a vertex at the clicked location', () => {
        const [event] = vertexInsertedListener.getCall(0).args;
        expect(event).to.have.property('vertex').and.to.be.an.instanceOf(Feature);
        expect(event.vertex.getGeometry().getCoordinates()).to.have.ordered.members([0, 0.5, 0]);
      });

      it('should return the index at which to insert the new index', () => {
        const [event] = vertexInsertedListener.getCall(0).args;
        expect(event).to.have.property('index', 1);
      });
    });

    describe('clicking close to the feature', () => {
      let vertexInsertedListener;

      before(async () => {
        vertexInsertedListener = sinon.spy();
        interaction.vertexInserted.addEventListener(vertexInsertedListener);
        await interaction.pipe({ feature, positionOrPixel: [1.5, 1, 0], map });
      });

      after(() => {
        interaction.vertexInserted.removeEventListener(vertexInsertedListener);
      });

      it('should call vertex added', async () => {
        expect(vertexInsertedListener).to.have.been.calledOnce;
      });

      it('should create a vertex at the clicked location', () => {
        const [event] = vertexInsertedListener.getCall(0).args;
        expect(event).to.have.property('vertex').and.to.be.an.instanceOf(Feature);
        expect(event.vertex.getGeometry().getCoordinates()).to.have.ordered.members([1, 1, 0]);
      });

      it('should return the index at which to insert the new index', () => {
        const [event] = vertexInsertedListener.getCall(0).args;
        expect(event).to.have.property('index', 2);
      });
    });

    describe('clicking far from the feature', () => {
      let vertexInsertedListener;

      before(async () => {
        vertexInsertedListener = sinon.spy();
        interaction.vertexInserted.addEventListener(vertexInsertedListener);
        await interaction.pipe({ feature, positionOrPixel: [10.5, 5, 0], map });
      });

      after(() => {
        interaction.vertexInserted.removeEventListener(vertexInsertedListener);
      });

      it('should call vertex added', async () => {
        expect(vertexInsertedListener).to.not.have.been.called;
      });
    });

    describe('clicking the closing edge of the feature', () => {
      let vertexInsertedListener;

      before(async () => {
        vertexInsertedListener = sinon.spy();
        interaction.vertexInserted.addEventListener(vertexInsertedListener);
        await interaction.pipe({ feature, positionOrPixel: [0.5, 0.5, 0], map });
      });

      after(() => {
        interaction.vertexInserted.removeEventListener(vertexInsertedListener);
      });

      it('should call vertex added', async () => {
        expect(vertexInsertedListener).to.have.been.calledOnce;
      });

      it('should create a vertex at the clicked location', () => {
        const [event] = vertexInsertedListener.getCall(0).args;
        expect(event).to.have.property('vertex').and.to.be.an.instanceOf(Feature);
        expect(event.vertex.getGeometry().getCoordinates()).to.have.ordered.members([0.5, 0.5, 0]);
      });

      it('should return the index at which to insert the new index', () => {
        const [event] = vertexInsertedListener.getCall(0).args;
        expect(event).to.have.property('index', 3);
      });
    });
  });
});
