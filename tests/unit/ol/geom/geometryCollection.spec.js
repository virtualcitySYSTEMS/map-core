import GeometryCollection from 'ol/geom/GeometryCollection.js';
import Point from 'ol/geom/Point.js';
import LineString from 'ol/geom/LineString.js';
import Polygon from 'ol/geom/Polygon.js';
import Circle from 'ol/geom/Circle.js';
import { from3Dto2DLayout } from '../../../../src/util/geometryHelpers.js';

describe('ol.geom.GeometryCollection', () => {
  let point;
  let lineString;
  /** @type {import("ol/geom").Polygon} */
  let polygon;
  let circle;
  let geometryCollection;

  beforeEach(() => {
    point = new Point([0, 0, 0], 'XYZ');
    lineString = new LineString(
      [
        [1, 1, 1],
        [2, 2, 2],
      ],
      'XYZ',
    );
    polygon = new Polygon(
      [
        [
          [0, 0, 0],
          [10, 0, 0],
          [10, 10, 0],
          [0, 10, 0],
        ],
        [
          [2, 2, 0],
          [2, 8, 0],
          [8, 8, 0],
          [8, 2, 0],
        ],
      ],
      'XYZ',
    );
    circle = new Circle([0, 0, 0], 20, 'XYZ');
    geometryCollection = new GeometryCollection([
      point,
      lineString,
      polygon,
      circle,
    ]);
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
        [
          [4, 4, 4],
          [1, 1, 1],
        ],
        [
          [
            [0, 0, 0],
            [1, 0, 0],
            [0, 1, 0],
          ],
        ],
        [
          [2, 2, 2],
          [5, 2, 2],
        ],
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

  describe('getLayout', () => {
    it('should return the layout', () => {
      const layout = geometryCollection.getLayout();
      expect(layout).to.equal('XYZ');
    });

    it('should return the smallest common layout', () => {
      from3Dto2DLayout(polygon);
      const layout = geometryCollection.getLayout();
      expect(layout).to.equal('XY');
    });

    it('should return XY, if mixing XYZ with XYM', () => {
      polygon.layout = 'XYM';
      const layout = geometryCollection.getLayout();
      expect(layout).to.equal('XY');
    });

    it('should return XYM, if ALL geometries have an XYM layout', () => {
      polygon.layout = 'XYM';
      point.layout = 'XYM';
      circle.layout = 'XYM';
      lineString.layout = 'XYM';
      const layout = geometryCollection.getLayout();
      expect(layout).to.equal('XYM');
    });
  });

  describe('getStride', () => {
    it('should return the layout', () => {
      const stride = geometryCollection.getStride();
      expect(stride).to.equal(3);
    });

    it('should return the smallest common stride', () => {
      from3Dto2DLayout(polygon);
      const stride = geometryCollection.getStride();
      expect(stride).to.equal(2);
    });
  });

  describe('getFlatCoordinates', () => {
    it('should return flat coordinates', () => {
      expect(geometryCollection.getFlatCoordinates()).to.have.ordered.members([
        ...point.getFlatCoordinates(),
        ...lineString.getFlatCoordinates(),
        ...polygon.getFlatCoordinates(),
        ...circle.getFlatCoordinates(),
      ]);
    });

    it('should slice flat coordinates, if the stride is not the same amongst geometries', () => {
      const xyzFlatCoordinates = geometryCollection.getFlatCoordinates();
      const xyFlatCoordinates = [];
      for (let i = 0; i < xyzFlatCoordinates.length; i += 3) {
        xyFlatCoordinates.push(
          xyzFlatCoordinates[i],
          xyzFlatCoordinates[i + 1],
        );
      }

      from3Dto2DLayout(polygon);
      expect(geometryCollection.getFlatCoordinates()).to.have.ordered.members(
        xyFlatCoordinates,
      );
    });
  });
});
