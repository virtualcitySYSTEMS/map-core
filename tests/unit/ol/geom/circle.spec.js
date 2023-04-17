import Circle from 'ol/geom/Circle.js';

describe('ol.geom.Circle', () => {
  let circle;

  beforeEach(() => {
    circle = new Circle([1, 1, 1], 1, 'XYZ');
  });

  describe('#getCoordinates', () => {
    it('should get two coordinates, the center and the radius', () => {
      const coords = circle.getCoordinates();
      expect(coords).to.have.length(2);
      expect(coords).to.have.deep.members([
        [1, 1, 1],
        [2, 1, 1],
      ]);
    });
  });

  describe('#setCoordinates', () => {
    it('should set the coordinates based on the new coordinates', () => {
      circle.setCoordinates([
        [2, 2, 2],
        [4, 2, 2],
      ]);
      const center = circle.getCenter();
      const radius = circle.getRadius();

      expect(center).to.have.members([2, 2, 2]);
      expect(radius).to.equal(2);
    });

    it('should respect the layout', () => {
      circle.setCoordinates(
        [
          [2, 2],
          [4, 2],
        ],
        'XY',
      );

      const center = circle.getCenter();
      const radius = circle.getRadius();

      expect(center).to.have.members([2, 2]);
      expect(radius).to.equal(2);
    });
  });
});
