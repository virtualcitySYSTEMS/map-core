import GeometryCollection from 'ol/geom/GeometryCollection.js';
import Point from 'ol/geom/Point.js';
import GeometryLayout from 'ol/geom/GeometryLayout.js';
import LineString from 'ol/geom/LineString.js';
import Polygon from 'ol/geom/Polygon.js';
import Circle from 'ol/geom/Circle.js';

describe('ol.geom.GeometryCollection', () => {
  let point;
  let lineString;
  let polygon;
  let circle;
  let geometryCollection;

  beforeEach(() => {
    point = new Point([0, 0, 0], GeometryLayout.XYZ);
    lineString = new LineString([[1, 1, 1], [2, 2, 2]], GeometryLayout.XYZ);
    polygon = new Polygon([
      [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]],
      [[2, 2, 0], [2, 8, 0], [8, 8, 0], [8, 2, 0]],
    ], GeometryLayout.XYZ);
    circle = new Circle([0, 0, 0], 20, GeometryLayout.XYZ);
    geometryCollection = new GeometryCollection([point, lineString, polygon, circle]);
  });

  describe('#getCoordinates', () => {
    it('should get the coordinates of every geometry', () => {
      const coords = geometryCollection.getCoordinates();
      expect(coords).to.have.length(4);
      expect(coords).to.have.deep.members([
        point.getCoordinates(),
        lineString.getCoordinates(),
        polygon.getCoordinates(),
        circle.getCoordinates(),
      ]);
    });
  });

  describe('#setCoordinates', () => {
    it('should set the coordinates of each geometry', () => {
      const coords = [
        [2, 2, 2],
        [[4, 4, 4], [1, 1, 1]],
        [[[0, 0, 0], [1, 0, 0], [0, 1, 0]]],
        [[2, 2, 2], [5, 2, 2]],
      ];
      geometryCollection.setCoordinates(coords);
      [point, lineString, polygon, circle] = geometryCollection.getGeometries();
      expect(point.getCoordinates()).to.have.members(coords[0]);
      expect(lineString.getCoordinates()).to.have.deep.members(coords[1]);
      expect(polygon.getCoordinates()).to.have.deep.members(coords[2]);
      expect(circle.getCenter()).to.have.members(coords[3][0]);
      expect(circle.getRadius()).to.equal(3);
    });
  });
});
