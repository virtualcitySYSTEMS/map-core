import { expect } from 'chai';
import Point from 'ol/geom/Point.js';
import LineString from 'ol/geom/LineString.js';
import Polygon from 'ol/geom/Polygon.js';
import Circle from 'ol/geom/Circle.js';
import MultiPolygon from 'ol/geom/MultiPolygon.js';
import GeometryCollection from 'ol/geom/GeometryCollection.js';
import { Coordinate } from 'ol/coordinate.js';
import { HeightReference } from '@vcmap-cesium/engine';
import Extent3D from '../../../../src/util/featureconverter/extent3D.js';
import { VectorHeightInfo } from '../../../../src/util/featureconverter/vectorHeightInfo.js';

describe('Extent3D', () => {
  describe('createEmpty', () => {
    it('should create an empty extent', () => {
      const extent = new Extent3D();
      expect(extent.toArray()).to.have.members([
        Infinity,
        Infinity,
        Infinity,
        -Infinity,
        -Infinity,
        -Infinity,
      ]);
    });

    it('should be an empty extent', () => {
      const extent = new Extent3D();
      expect(extent.isEmpty()).to.be.true;
    });
  });

  describe('extendXYZ', () => {
    it('should extend the max values of the extent', () => {
      const extent = Extent3D.fromArray([1, 2, 3, 4, 5, 6]);
      extent.extendXYZ(10, 10, 10);
      expect(extent.toArray()).to.have.members([1, 2, 3, 10, 10, 10]);
    });
    it('should extent the min values of the extent', () => {
      const extent = Extent3D.fromArray([1, 2, 3, 4, 5, 6]);
      extent.extendXYZ(0, 0, 0);
      expect(extent.toArray()).to.have.members([0, 0, 0, 4, 5, 6]);
    });
  });

  describe('extendXY', () => {
    it('should extend the max values of the extent', () => {
      const extent = Extent3D.fromArray([1, 2, 3, 4, 5, 6]);
      extent.extendXY(10, 10);
      expect(extent.toArray()).to.have.members([1, 2, 3, 10, 10, 6]);
    });

    it('should extent the min values of the extent', () => {
      const extent = Extent3D.fromArray([1, 2, 3, 4, 5, 6]);
      extent.extendXY(0, 0);
      expect(extent.toArray()).to.have.members([0, 0, 3, 4, 5, 6]);
    });
  });

  describe('extendZ', () => {
    it('should extend the max values of the extent', () => {
      const extent = Extent3D.fromArray([1, 2, 3, 4, 5, 6]);
      extent.extendZ(10);
      expect(extent.toArray()).to.have.members([1, 2, 3, 4, 5, 10]);
    });

    it('should extent the min values of the extent', () => {
      const extent = Extent3D.fromArray([1, 2, 3, 4, 5, 6]);
      extent.extendZ(0);
      expect(extent.toArray()).to.have.members([1, 2, 0, 4, 5, 6]);
    });
  });

  describe('extendFlatCoordinates', () => {
    it('should extend 3d Values', () => {
      const extent = Extent3D.fromArray([1, 2, 3, 4, 5, 6]);
      const flatCoordinates = [10, 11, 12, -10, -11, -12];
      extent.extendFlatCoordinates(flatCoordinates, 3);
      expect(extent.toArray()).to.have.members([-10, -11, -12, 10, 11, 12]);
    });

    it('should extend 2d Values', () => {
      const extent = Extent3D.fromArray([1, 2, 3, 4, 5, 6]);
      const flatCoordinates = [10, 11, -10, -11];
      extent.extendFlatCoordinates(flatCoordinates, 2);
      expect(extent.toArray()).to.have.members([-10, -11, 3, 10, 11, 6]);
    });
  });

  describe('extendWithGeometry', () => {
    let point1: Coordinate;
    let point2: Coordinate;

    before(() => {
      point1 = [10, 11, 12];
      point2 = [-10, -11, -12];
    });

    it('should extent max values from point geometries', () => {
      const geom = new Point(point1);
      const extent = Extent3D.fromArray([1, 2, 3, 4, 5, 6]);
      extent.extendWithGeometry(geom);
      expect(extent.toArray()).to.have.members([1, 2, 3, 10, 11, 12]);
    });

    it('should extent min values from point geometries', () => {
      const geom = new Point(point2);
      const extent = Extent3D.fromArray([1, 2, 3, 4, 5, 6]);
      extent.extendWithGeometry(geom);
      expect(extent.toArray()).to.have.members([-10, -11, -12, 4, 5, 6]);
    });

    it('should extent min/max values from point geometries', () => {
      const geom = new LineString([point1, point2]);
      const extent = Extent3D.fromArray([1, 2, 3, 4, 5, 6]);
      extent.extendWithGeometry(geom);
      expect(extent.toArray()).to.have.members([-10, -11, -12, 10, 11, 12]);
    });

    it('should extent min/max values from polygon geometries', () => {
      const geom = new Polygon([[point1, point2, point1]]);
      const extent = Extent3D.fromArray([1, 2, 3, 4, 5, 6]);
      extent.extendWithGeometry(geom);
      expect(extent.toArray()).to.have.members([-10, -11, -12, 10, 11, 12]);
    });

    it('should extent min/max values from circle geometries', () => {
      const geom = new Circle(point1, 1);
      const extent = Extent3D.fromArray([1, 2, 3, 4, 5, 6]);
      extent.extendWithGeometry(geom);
      expect(extent.toArray()).to.have.members([1, 2, 3, 11, 12, 12]);
    });

    it('should extent min/max values from multi geometries', () => {
      const geom = new MultiPolygon([
        [[point1, point2, point1]],
        [[point1, point2, point1]],
      ]);
      const extent = Extent3D.fromArray([1, 2, 3, 4, 5, 6]);
      extent.extendWithGeometry(geom);
      expect(extent.toArray()).to.have.members([-10, -11, -12, 10, 11, 12]);
    });

    it('should extent min/max values from geometry Collections', () => {
      const geometries = [new Point(point1), new Point(point2)];
      const geom = new GeometryCollection(geometries);
      const extent = Extent3D.fromArray([1, 2, 3, 4, 5, 6]);
      extent.extendWithGeometry(geom);
      expect(extent.toArray()).to.have.members([-10, -11, -12, 10, 11, 12]);
    });
  });

  describe('extendHeightInfo', () => {
    let heightInfo: VectorHeightInfo<HeightReference.NONE>;

    before(() => {
      heightInfo = {
        perPositionHeight: false,
        skirt: 0,
        heightReference: HeightReference.NONE,
        layout: 'XYZ',
        extruded: true,
        groundLevelOrMinHeight: 10,
        storeyHeightsAboveGround: [2, 3, 5],
        storeyHeightsBelowGround: [2, 3, 5],
      };
    });
    it('should extent z value with calculated storeyHeight ', () => {
      const extent = Extent3D.fromArray([1, 2, 3, 4, 5, 6]);
      extent.extendWithHeightInfo(heightInfo);
      expect(extent.toArray()).to.have.members([1, 2, 0, 4, 5, 20]);
    });
  });

  describe('getting the size of an extent', () => {
    it('should return the size of a normal extent', () => {
      const extent = Extent3D.fromArray([0, 0, 0, 2, 1, 2]);
      expect(extent.getSize()).to.have.ordered.members([2, 1, 2]);
    });

    it('should return the size of an empty extent', () => {
      const extent = new Extent3D();
      expect(extent.getSize()).to.have.ordered.members([0, 0, 0]);
    });
  });

  describe('getting the center of an extent', () => {
    it('should return the size of a normal extent', () => {
      const extent = Extent3D.fromArray([0, 0, 0, 2, 1, 2]);
      expect(extent.getCenter()).to.have.ordered.members([1, 0.5, 1]);
    });

    it('should return the size of an empty extent', () => {
      const extent = new Extent3D();
      expect(extent.getCenter()).to.have.ordered.members([0, 0, 0]);
    });
  });
});
