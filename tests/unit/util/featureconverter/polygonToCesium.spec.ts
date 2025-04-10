import Polygon from 'ol/geom/Polygon.js';
import Point from 'ol/geom/Point.js';
import {
  Cartesian3,
  PolygonGeometry,
  PolygonOutlineGeometry,
  GroundPolylineGeometry,
  PolylineGeometry,
  Cartographic,
  Math as CesiumMath,
  PolygonHierarchy,
  HeightReference,
} from '@vcmap-cesium/engine';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import type { Coordinate } from 'ol/coordinate.js';
import { expect } from 'chai';
import {
  getPolygonGeometryFactory,
  validatePolygon,
} from '../../../../src/util/featureconverter/polygonToCesium.js';
import Projection from '../../../../src/util/projection.js';
import type {
  CesiumGeometryOption,
  PolygonGeometryOptions,
  VectorGeometryFactory,
} from '../../../../src/util/featureconverter/vectorGeometryFactory.js';

describe('polygonToCesium', () => {
  let options: PolygonGeometryOptions;
  let geometryFactory: VectorGeometryFactory<'polygon'>;

  before(() => {
    options = {
      polygonHierarchy: {
        positions: [
          new Cartesian3(1, 1, 1),
          new Cartesian3(1, 2, 1),
          new Cartesian3(2, 2, 1),
          new Cartesian3(1, 1, 1),
        ],
        holes: [
          {
            positions: [
              new Cartesian3(1.4, 1.4, 1),
              new Cartesian3(1.6, 1.6, 1),
              new Cartesian3(1.4, 1.6, 1),
              new Cartesian3(1.4, 1.4, 1),
            ],
            holes: [],
          },
        ],
      },
    };
    geometryFactory = getPolygonGeometryFactory();
  });

  describe('createSolidGeometries', () => {
    it('should create an array with one PolygonGeometry', () => {
      const solidGeometries = geometryFactory.createSolidGeometries(
        options,
        { heightReference: HeightReference.CLAMP_TO_GROUND, layout: 'XYZ' },
        10,
        false,
      );
      expect(solidGeometries).to.be.an('array');
      expect(solidGeometries).to.have.lengthOf(1);
      expect(solidGeometries[0].geometry).to.be.instanceof(PolygonGeometry);
    });
  });

  describe('createOutlineGeometries', () => {
    it('should create an array with one PolygonOutlineGeometry', () => {
      const outlineGeometries = geometryFactory.createOutlineGeometries(
        options,
        { heightReference: HeightReference.CLAMP_TO_GROUND, layout: 'XYZ' },
        10,
        false,
      );
      expect(outlineGeometries).to.be.an('array');
      expect(outlineGeometries).to.have.lengthOf(1);
      expect(outlineGeometries[0].geometry).to.be.instanceof(
        PolygonOutlineGeometry,
      );
    });
  });

  describe('getLineGeometryOptions', () => {
    let style: Style;
    let polylineGeometrys: CesiumGeometryOption<'line'>[];

    before(() => {
      style = new Style({
        stroke: new Stroke({
          width: 3,
        }),
      });

      polylineGeometrys = geometryFactory.createLineGeometries(
        options,
        { heightReference: HeightReference.CLAMP_TO_GROUND, layout: 'XYZ' },
        style,
      );
    });

    it('should create an array with one PolylineGeometry', () => {
      expect(polylineGeometrys).to.be.an('array');
      expect(polylineGeometrys).to.have.lengthOf(2);
      expect(polylineGeometrys[0].geometry).to.be.instanceOf(PolylineGeometry);
      expect(polylineGeometrys[1].geometry).to.be.instanceOf(PolylineGeometry);
    });

    it('should extract stroke width from the style for each entry', () => {
      expect(polylineGeometrys).to.be.an('array').and.have.length(2);
      polylineGeometrys.forEach(({ geometry: lineGeometryOption }) => {
        expect(lineGeometryOption).to.have.property('_positions');
        expect(lineGeometryOption)
          .to.have.property('_width')
          .and.to.be.equal(style.getStroke()?.getWidth());
      });
    });

    it('should extract polygon outline and hole outline', () => {
      expect(
        (
          polylineGeometrys[0].geometry as unknown as {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            _positions: Cartesian3[];
          }
        )._positions,
      ).to.be.equal(options.polygonHierarchy.positions);
      expect(
        (
          polylineGeometrys[1].geometry as unknown as {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            _positions: Cartesian3[];
          }
        )._positions,
      ).to.be.equal(options.polygonHierarchy.holes[0].positions);
    });
  });

  describe('createGroundLineGeometries', () => {
    let style: Style;

    before(() => {
      style = new Style({
        stroke: new Stroke({
          width: 2.5,
        }),
      });
    });

    it('should create an array with two GroundPolylineGeometry (outer/inner ring)', () => {
      const polylineGeometrys = geometryFactory.createGroundLineGeometries(
        options,
        { heightReference: HeightReference.CLAMP_TO_GROUND, layout: 'XYZ' },
        style,
      );
      expect(polylineGeometrys).to.be.an('array');
      expect(polylineGeometrys).to.be.lengthOf(2);
      expect(polylineGeometrys[0].geometry).to.be.instanceOf(
        GroundPolylineGeometry,
      );
      expect(polylineGeometrys[1].geometry).to.be.instanceOf(
        GroundPolylineGeometry,
      );
    });
  });

  describe('getGeometryOptions', () => {
    let coordinates: Coordinate[][];
    let polygon: Polygon;
    let geometryOptions: PolygonGeometryOptions;

    before(() => {
      coordinates = [
        [
          [50, 50, 3],
          [50, 55, 3],
          [55, 50, 3],
        ],
        [
          [51, 50, 3],
          [52, 51, 3],
          [51, 52, 3],
        ],
      ];
      polygon = new Polygon(coordinates);
      geometryOptions = geometryFactory.getGeometryOptions(polygon, {
        heightReference: HeightReference.CLAMP_TO_GROUND,
        layout: 'XYZ',
      });
    });

    it('should return a PolygonHierarchy', () => {
      expect(geometryOptions)
        .to.be.an('object')
        .and.have.property('polygonHierarchy');
      expect(geometryOptions.polygonHierarchy).to.be.instanceOf(
        PolygonHierarchy,
      );
    });

    it('should convert the outer ring', () => {
      const cartographics = geometryOptions.polygonHierarchy.positions.map(
        (pos) => {
          return Cartographic.fromCartesian(pos);
        },
      );
      const mercatorCoords = cartographics.map((carto) => {
        return Projection.wgs84ToMercator([
          CesiumMath.toDegrees(carto.longitude),
          CesiumMath.toDegrees(carto.latitude),
          carto.height,
        ]);
      });
      mercatorCoords.forEach((coord, index) => {
        if (index <= 2) {
          expect(coord[0]).to.be.closeTo(coordinates[0][index][0], 0.00001);
          expect(coord[1]).to.be.closeTo(coordinates[0][index][1], 0.00001);
          expect(coord[2]).to.be.closeTo(coordinates[0][index][2], 0.00001);
        }
      });
    });

    it('should convert the inner rings', () => {
      const cartographics =
        geometryOptions.polygonHierarchy.holes[0].positions.map((pos) => {
          return Cartographic.fromCartesian(pos);
        });
      const mercatorCoords = cartographics.map((carto) => {
        return Projection.wgs84ToMercator([
          CesiumMath.toDegrees(carto.longitude),
          CesiumMath.toDegrees(carto.latitude),
          carto.height,
        ]);
      });
      mercatorCoords.forEach((coord, index) => {
        if (index <= 2) {
          // converter ring is closed.
          expect(coord[0]).to.be.closeTo(coordinates[1][index][0], 0.00001);
          expect(coord[1]).to.be.closeTo(coordinates[1][index][1], 0.00001);
          expect(coord[2]).to.be.closeTo(coordinates[1][index][2], 0.00001);
        }
      });
    });
  });

  describe('validatePolygon', () => {
    it('should invalidate a polygon without a linearring', () => {
      const polygon = new Polygon([]);
      expect(validatePolygon(polygon)).to.be.false;
    });

    it('should invalidate a polygon without coordinates in a linearring', () => {
      const polygon = new Polygon([[]]);
      expect(validatePolygon(polygon)).to.be.false;
    });

    it('should invalidate a polygon with only two coordinates', () => {
      const polygon = new Polygon([
        [
          [1, 2],
          [1, 3],
        ],
      ]);
      expect(validatePolygon(polygon)).to.be.false;
    });

    it('should invalidate a polygon with three coordinates but 2 linearrings', () => {
      const polygon = new Polygon([
        [
          [1, 2],
          [1, 3],
          [2, 4],
        ],
        [],
      ]);
      expect(validatePolygon(polygon)).to.be.false;
    });

    it('should invalidate a polygon with non number values', () => {
      const polygon = new Polygon([
        [
          [1, 2],
          [1, '3' as unknown as number],
          [2, 4],
        ],
      ]);
      expect(validatePolygon(polygon)).to.be.false;
    });

    it('should validate a polygon with three coordinates and one linearring', () => {
      const polygon = new Polygon([
        [
          [1, 2],
          [1, 3],
          [2, 4],
        ],
      ]);
      expect(validatePolygon(polygon)).to.be.true;
    });

    it('should validate a polygon with two linearrings with each at least 3 coordinates', () => {
      const polygon = new Polygon([
        [
          [1, 1, 1],
          [1, 2, 1],
          [2, 2, 1],
        ],
        [
          [1.4, 1.4, 1],
          [1.6, 1.6, 1],
          [1.4, 1.6, 1],
        ],
      ]);
      expect(validatePolygon(polygon)).to.be.true;
    });

    it('should not validate linearRings without at least 3 coordinates', () => {
      const polygon = new Polygon([
        [
          [1, 1, 1],
          [1, 2, 1],
          [2, 2, 1],
        ],
        [
          [1.4, 1.4, 1],
          [1.6, 1.6, 1],
        ],
      ]);
      expect(validatePolygon(polygon)).to.be.false;
    });

    it('should not invalidate non Polygon Geometries', () => {
      const polygon = new Point([0, 0]);
      expect(validatePolygon(polygon as unknown as Polygon)).to.be.false;
    });

    it('should not validate a polygon with undefined values due to mixed 3D/2D Content', () => {
      const polygon = new Polygon([
        [
          [1, 2, 3],
          [1, 3],
          [2, 4],
        ],
      ]);
      expect(validatePolygon(polygon)).to.be.false;
    });
  });
});
