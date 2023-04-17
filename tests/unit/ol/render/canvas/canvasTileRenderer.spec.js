import CanvasTileRenderer from '../../../../../src/ol/render/canvas/canvasTileRenderer.js';

describe('CanvasTileRenderer', () => {
  let canvasTileRenderer;

  beforeEach(() => {
    canvasTileRenderer = new CanvasTileRenderer(
      {},
      1,
      [0, 0, 1, 1],
      [1, 0, 0, 1, 0, 0],
      0,
      undefined,
      undefined,
      10,
    );
  });

  describe('imageScale_', () => {
    it('should apply the scaleY Factor to imageScale', () => {
      canvasTileRenderer.imageScale_ = [1, 1];
      expect(canvasTileRenderer.imageScale_).to.have.ordered.members([1, 10]);
    });
  });

  describe('textScale_', () => {
    it('should apply the scaleY Factor to textScale', () => {
      canvasTileRenderer.textScale_ = [1, 1];
      expect(canvasTileRenderer.textScale_).to.have.ordered.members([1, 10]);
    });
  });
});
