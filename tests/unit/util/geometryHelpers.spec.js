import Circle from 'ol/geom/Circle.js';
import Polygon from 'ol/geom/Polygon.js';
import Point from 'ol/geom/Point.js';
import MultiPoint from 'ol/geom/MultiPoint.js';
import MultiPolygon from 'ol/geom/MultiPolygon.js';
import LineString from 'ol/geom/LineString.js';
import MultiLineString from 'ol/geom/MultiLineString.js';
import GeometryCollection from 'ol/geom/GeometryCollection.js';
import {
  convertGeometryToPolygon,
  getFlatCoordinatesFromGeometry,
  getFlatCoordinatesFromSimpleGeometry,
  circleFromCenterRadius,
} from '../../../src/util/geometryHelpers.js';

describe('util.geometryHelpers', () => {
  describe('convertGeometryToPolygon', () => {
    it('should convert a Circle to a Polygon', () => {
      const circle = new Circle([1, 1, 1], 1, 'XYZ');
      const polygon = convertGeometryToPolygon(circle);
      expect(polygon).to.be.an.instanceof(Polygon);
    });

    it('should remove the _vcmGeomType property from polygons', () => {
      const polygon = new Polygon([]);
      polygon.set('_vcsGeomType', 'test');
      const point = new Point([1, 1, 1]);
      point.set('_vcsGeomType', 'test');

      const convertedPolygon = convertGeometryToPolygon(polygon);
      expect(convertedPolygon.get('_vcsGeomType')).to.not.exist;

      const convertedPoint = convertGeometryToPolygon(point);
      expect(convertedPoint.get('_vcsGeomType')).to.equal('test');
    });
  });

  describe('getFlatCoordinatesFromSimpleGeometry', () => {
    let geometry;
    let flatCoordinates;

    it('should return an empty array if no coordinates are there', () => {
      geometry = new Point([]);
      flatCoordinates = getFlatCoordinatesFromSimpleGeometry(geometry);
      expect(flatCoordinates).to.be.empty;
    });

    it('should return the coordinates of a 3D point', () => {
      geometry = new Point([1, 2, 3]);
      flatCoordinates = getFlatCoordinatesFromSimpleGeometry(geometry);
      expect(flatCoordinates).to.have.deep.members([[1, 2, 3]]);
    });

    it('should return the coordinates of a 2D point', () => {
      geometry = new Point([1, 2]);
      flatCoordinates = getFlatCoordinatesFromSimpleGeometry(geometry);
      expect(flatCoordinates).to.have.deep.members([[1, 2]]);
    });

    it('should return the coordinates of a MultiPoint', () => {
      geometry = new MultiPoint([
        [1, 2],
        [2, 2],
      ]);
      flatCoordinates = getFlatCoordinatesFromSimpleGeometry(geometry);
      expect(flatCoordinates).to.have.deep.members([
        [1, 2],
        [2, 2],
      ]);
    });

    it('should return the coordinates of a 3D polygon', () => {
      geometry = new Polygon([
        [
          [50, 50, 3],
          [50, 55, 3],
          [55, 50, 3],
        ],
      ]);
      flatCoordinates = getFlatCoordinatesFromSimpleGeometry(geometry);
      expect(flatCoordinates).to.have.deep.members([
        [50, 50, 3],
        [50, 55, 3],
        [55, 50, 3],
      ]);
    });

    it('should return the coordinates of a 2D polygon', () => {
      geometry = new Polygon([
        [
          [50, 50],
          [50, 55],
          [55, 50],
        ],
      ]);
      flatCoordinates = getFlatCoordinatesFromSimpleGeometry(geometry);
      expect(flatCoordinates).to.have.deep.members([
        [50, 50],
        [50, 55],
        [55, 50],
      ]);
    });

    it('should return the coordinates of a MultiPolygon', () => {
      geometry = new MultiPolygon([
        [
          [
            [50, 50],
            [50, 55],
            [55, 50],
          ],
        ],
        [
          [
            [50, 50],
            [50, 55],
            [55, 50],
          ],
        ],
      ]);
      flatCoordinates = getFlatCoordinatesFromSimpleGeometry(geometry);
      expect(flatCoordinates).to.have.deep.members([
        [50, 50],
        [50, 55],
        [55, 50],
        [50, 50],
        [50, 55],
        [55, 50],
      ]);
    });

    it('should return the coordinates of a 3D linestring', () => {
      geometry = new LineString([
        [1, 2, 3],
        [1, 2, 3],
      ]);
      flatCoordinates = getFlatCoordinatesFromSimpleGeometry(geometry);
      expect(flatCoordinates).to.have.deep.members([
        [1, 2, 3],
        [1, 2, 3],
      ]);
    });

    it('should return the coordinates of a 2D linestring', () => {
      geometry = new LineString([
        [1, 2],
        [1, 3],
      ]);
      flatCoordinates = getFlatCoordinatesFromSimpleGeometry(geometry);
      expect(flatCoordinates).to.have.deep.members([
        [1, 2],
        [1, 3],
      ]);
    });

    it('should return the coordinates of a MultilineString', () => {
      geometry = new MultiLineString([
        [
          [1, 2],
          [1, 3],
        ],
        [
          [1, 4],
          [1, 5],
        ],
      ]);
      flatCoordinates = getFlatCoordinatesFromSimpleGeometry(geometry);
      expect(flatCoordinates).to.have.deep.members([
        [1, 2],
        [1, 3],
        [1, 4],
        [1, 5],
      ]);
    });
  });

  describe('getFlatCoordinatesFromGeometry', () => {
    let geometries;
    let flatCoordinates;
    before(() => {
      geometries = {
        Point: new Point([1, 1, 1]),
        LineString: new LineString([
          [1, 1, 1],
          [2, 2, 2],
        ]),
        MultiPoint: new MultiPoint([
          [1, 1, 1],
          [2, 2, 2],
        ]),
        Polygon: new Polygon([
          [
            [0, 0, 0],
            [10, 0, 0],
            [10, 10, 0],
            [0, 10, 0],
          ],
          [
            [2, 2, 0],
            [0, 8, 0],
            [8, 8, 0],
            [8, 0, 0],
          ],
        ]),
        MultiLineString: new MultiLineString([
          [
            [1, 1, 1],
            [2, 2, 2],
          ],
          [
            [1, 1, 1],
            [3, 3, 3],
          ],
        ]),
        Circle: new Circle([0, 0, 0], 1, 'XYZ'),
        MultiPolygon: new MultiPolygon([
          [
            [
              [0, 0, 0],
              [1, 0, 0],
              [0, 1, 0],
            ],
          ],
          [
            [
              [2, 2, 0],
              [2, 5, 0],
              [-2, 5, 0],
            ],
            [
              [1, 3, 0],
              [0, 4, 0],
              [1, 4, 0],
            ],
          ],
        ]),
      };
      geometries.GeometryCollection = new GeometryCollection([
        geometries.Point.clone(),
        geometries.LineString.clone(),
        geometries.Polygon.clone(),
        geometries.MultiLineString.clone(),
        geometries.Circle.clone(),
      ]);
      flatCoordinates = {
        Point: [[1, 1, 1]],
        LineString: [
          [1, 1, 1],
          [2, 2, 2],
        ],
        MultiPoint: [
          [1, 1, 1],
          [2, 2, 2],
        ],
        Polygon: [
          [0, 0, 0],
          [10, 0, 0],
          [10, 10, 0],
          [0, 10, 0],
          [2, 2, 0],
          [0, 8, 0],
          [8, 8, 0],
          [8, 0, 0],
        ],
        MultiLineString: [
          [1, 1, 1],
          [2, 2, 2],
          [1, 1, 1],
          [3, 3, 3],
        ],
        Circle: [
          [0, 0, 0],
          [1, 0, 0],
        ],
        MultiPolygon: [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
          [2, 2, 0],
          [2, 5, 0],
          [-2, 5, 0],
          [1, 3, 0],
          [0, 4, 0],
          [1, 4, 0],
        ],
      };
      flatCoordinates.GeometryCollection = [].concat(
        flatCoordinates.Point,
        flatCoordinates.LineString,
        flatCoordinates.Polygon,
        flatCoordinates.MultiLineString,
        flatCoordinates.Circle,
      );
    });

    it('should get the flat coordinates of a geometry', () => {
      Object.keys(geometries).forEach((key) => {
        const coords = getFlatCoordinatesFromGeometry(geometries[key]);
        expect(coords).to.have.deep.members(flatCoordinates[key]);
      });
    });

    it('should get the flat coordinates with a reference to the original', () => {
      Object.keys(geometries).forEach((key) => {
        const coords =
          key === 'Circle'
            ? [
                geometries[key].getFirstCoordinate(),
                geometries[key].getLastCoordinate(),
              ]
            : geometries[key].getCoordinates();
        const flats = getFlatCoordinatesFromGeometry(geometries[key], coords);
        expect(flats).to.have.deep.members(flatCoordinates[key]);
      });
    });
  });

  describe('circleFromCenterRadius', () => {
    it('should create an XYZ circle', () => {
      const circle = circleFromCenterRadius([0, 0, 0], 10);
      expect(circle.getCenter()).to.have.members([0, 0, 0]);
    });

    it('should create an XY circle', () => {
      const circle = circleFromCenterRadius([0, 0], 10);
      expect(circle.getCenter()).to.have.members([0, 0]);
    });
  });
});
