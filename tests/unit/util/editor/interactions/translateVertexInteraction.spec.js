import { Feature } from 'ol';
import { Point } from 'ol/geom.js';
import { EventType, TranslateVertexInteraction, vertexSymbol } from '../../../../../index.js';

describe('TranslateVertexInteraction', () => {
  describe('starting vertex translation', () => {
    let vertex;
    let event;

    before(async () => {
      vertex = new Feature({ geometry: new Point([0, 0, 0]) });
      vertex[vertexSymbol] = true;
      const interaction = new TranslateVertexInteraction();
      event = {
        feature: vertex,
        type: EventType.DRAGSTART,
      };

      await interaction.pipe(event);
      interaction.destroy();
    });

    it('should stop event propagation', () => {
      expect(event.stopPropagation).to.be.true;
    });

    it('should set the vertex allowPicking to be false', () => {
      expect(vertex.get('olcs_allowPicking')).to.be.false;
    });
  });

  describe('dragging the vertex', () => {
    let vertex;
    let vertexChangedListener;

    before(async () => {
      vertex = new Feature({ geometry: new Point([0, 0, 0]) });
      vertex[vertexSymbol] = true;
      vertexChangedListener = sinon.spy();
      const interaction = new TranslateVertexInteraction();
      interaction.vertexChanged.addEventListener(vertexChangedListener);
      await interaction.pipe({
        feature: vertex,
        type: EventType.DRAGSTART,
      });
      await interaction.pipe({
        positionOrPixel: [1, 1, 0],
        feature: vertex,
        type: EventType.DRAG,
      });
      await interaction.pipe({
        positionOrPixel: [2, 1, 0],
        feature: vertex,
        type: EventType.DRAG,
      });
      interaction.destroy();
    });

    it('should set the vertex geometry to the position of the event', () => {
      expect(vertex.getGeometry().getCoordinates()).to.have.ordered.members([2, 1, 0]);
    });

    it('should call vertexChanged for each drag event', () => {
      expect(vertexChangedListener).to.have.been.calledTwice;
      expect(vertexChangedListener).to.have.been.calledWithExactly(vertex);
    });
  });

  describe('finish dragging the vertex', () => {
    let vertex;
    let vertexChangedListener;

    before(async () => {
      vertex = new Feature({ geometry: new Point([0, 0, 0]) });
      vertex[vertexSymbol] = true;
      vertexChangedListener = sinon.spy();
      const interaction = new TranslateVertexInteraction();
      interaction.vertexChanged.addEventListener(vertexChangedListener);
      await interaction.pipe({
        feature: vertex,
        type: EventType.DRAGSTART,
      });
      await interaction.pipe({
        positionOrPixel: [1, 1, 0],
        feature: vertex,
        type: EventType.DRAG,
      });
      await interaction.pipe({
        positionOrPixel: [2, 1, 0],
        feature: vertex,
        type: EventType.DRAG,
      });
      await interaction.pipe({
        positionOrPixel: [2, 1, 0],
        feature: vertex,
        type: EventType.DRAGEND,
      });
      interaction.destroy();
    });

    it('should set the vertex geometry to the position of the event', () => {
      expect(vertex.getGeometry().getCoordinates()).to.have.ordered.members([2, 1, 0]);
    });

    it('should call vertexChanged for each drag event & drag end event', () => {
      expect(vertexChangedListener).to.have.been.calledThrice;
      expect(vertexChangedListener).to.have.been.calledWithExactly(vertex);
    });

    it('should reset the vertex style', () => {
      expect(vertex.get('olcs_allowPicking')).to.be.undefined;
    });
  });
});
