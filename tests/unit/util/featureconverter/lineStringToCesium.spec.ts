import LineString from 'ol/geom/LineString.js';
import Polygon from 'ol/geom/Polygon.js';
import {
  Cartesian3,
  Cartographic,
  Math as CesiumMath,
  PolylineGeometry,
  GroundPolylineGeometry,
  WallGeometry,
  WallOutlineGeometry,
  HeightReference,
} from '@vcmap-cesium/engine';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import { expect } from 'chai';

import {
  getLineStringGeometryFactory,
  validateLineString,
} from '../../../../src/util/featureconverter/lineStringToCesium.js';
import Projection from '../../../../src/util/projection.js';
import {
  PolylineGeometryOptions,
  VectorGeometryFactory,
  VectorHeightInfo,
} from '../../../../index.js';

function getAbsoluteHeightInfo(): VectorHeightInfo<HeightReference.NONE> {
  return {
    groundLevelOrMinHeight: 0,
    extruded: false,
    skirt: 0,
    storeyHeightsAboveGround: [12],
    perPositionHeight: true,
    storeyHeightsBelowGround: [],
    heightReference: HeightReference.NONE,
    layout: 'XYZ',
  };
}

describe('lineStringToCesium', () => {
  let options: PolylineGeometryOptions;
  let geometryFactory: VectorGeometryFactory<'lineString'>;

  before(() => {
    options = {
      positions: [new Cartesian3(1, 1, 1), new Cartesian3(2, 2, 2)],
    };
    geometryFactory = getLineStringGeometryFactory();
  });

  describe('createSolidGeometries', () => {
    it('should create an array with one WallGeometry', () => {
      const solidGeometries = geometryFactory.createSolidGeometries(
        options,
        getAbsoluteHeightInfo(),
        10,
        true,
      );
      expect(solidGeometries).to.be.an('array');
      expect(solidGeometries).to.have.lengthOf(1);
      expect(solidGeometries[0].geometry).to.be.instanceof(WallGeometry);
    });

    it('should use extrudedHeight as minimumHeight', () => {
      const solidGeometries = geometryFactory.createSolidGeometries(
        options,
        getAbsoluteHeightInfo(),
        10,
        false,
        10,
      );
      expect(solidGeometries[0].geometry)
        .to.have.property('_minimumHeights')
        .and.to.have.ordered.members([10, 10]);
    });

    it('should use height as maximumHeight', () => {
      const solidGeometries = geometryFactory.createSolidGeometries(
        options,
        getAbsoluteHeightInfo(),
        20,
        false,
      );
      expect(solidGeometries[0].geometry)
        .to.have.property('_maximumHeights')
        .and.to.have.ordered.members([20, 20]);
    });

    it('should ignore height if perPositionHeight is set', () => {
      const solidGeometries = geometryFactory.createSolidGeometries(
        options,
        getAbsoluteHeightInfo(),
        10,
        true,
      );
      expect(solidGeometries[0].geometry).to.have.property('_maximumHeights')
        .and.to.be.undefined;
    });
  });

  describe('createOutlineGeometries', () => {
    it('should create an array with one WallOutlineGeometry', () => {
      const outlineGeometries = geometryFactory.createOutlineGeometries(
        options,
        getAbsoluteHeightInfo(),
        20,
        false,
      );
      expect(outlineGeometries).to.be.an('array');
      expect(outlineGeometries).to.have.lengthOf(1);
      expect(outlineGeometries[0].geometry).to.be.instanceof(
        WallOutlineGeometry,
      );
    });

    it('should use extrudedHeight as minimumHeight', () => {
      const outlineGeometries = geometryFactory.createOutlineGeometries(
        options,
        getAbsoluteHeightInfo(),
        20,
        false,
        10,
      );
      expect(outlineGeometries[0].geometry)
        .to.have.property('_minimumHeights')
        .and.to.have.ordered.members([10, 10]);
    });

    it('should use height as maximumHeight', () => {
      const outlineGeometries = geometryFactory.createOutlineGeometries(
        options,
        getAbsoluteHeightInfo(),
        20,
        false,
        10,
      );
      // creates a minimumHeight for each position, so two
      expect(outlineGeometries[0].geometry)
        .to.have.property('_maximumHeights')
        .and.to.have.ordered.members([20, 20]);
    });

    it('should ignore height if perPositionHeight is set', () => {
      const outlineGeometries = geometryFactory.createOutlineGeometries(
        options,
        getAbsoluteHeightInfo(),
        20,
        true,
        10,
      );
      expect(outlineGeometries[0].geometry).to.have.property('_maximumHeights')
        .and.to.be.undefined;
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

    it('should create an array with one GroundPolylineGeometry', () => {
      const polylineGeometrys = geometryFactory.createGroundLineGeometries(
        options,
        getAbsoluteHeightInfo(),
        style,
      );
      expect(polylineGeometrys).to.be.an('array');
      expect(polylineGeometrys).to.be.lengthOf(1);
      expect(polylineGeometrys[0].geometry).to.be.instanceof(
        GroundPolylineGeometry,
      );
    });

    it('should extract stroke width from the style ', () => {
      const polylineGeometrys = geometryFactory.createGroundLineGeometries(
        options,
        getAbsoluteHeightInfo(),
        style,
      );
      expect(polylineGeometrys[0].geometry.width).to.be.equal(
        style.getStroke()?.getWidth(),
      );
    });
  });

  describe('createLineGeometries', () => {
    let style: Style;
    before(() => {
      style = new Style({
        stroke: new Stroke({
          width: 2.5,
        }),
      });
    });

    it('should create an array with one PolylineGeometry', () => {
      const polylineGeometries = geometryFactory.createLineGeometries(
        options,
        getAbsoluteHeightInfo(),
        style,
      );
      expect(polylineGeometries).to.be.an('array');
      expect(polylineGeometries).to.have.lengthOf(1);
      expect(polylineGeometries[0].geometry).to.be.instanceof(PolylineGeometry);
    });

    it('should extract stroke width from the style ', () => {
      const polylineGeometries = geometryFactory.createLineGeometries(
        options,
        getAbsoluteHeightInfo(),
        style,
      );
      expect(polylineGeometries[0].geometry)
        .to.have.property('_width')
        .and.to.be.equal(style.getStroke()?.getWidth());
    });
  });

  describe('getGeometryOptions', () => {
    it('should extract the coordinates', () => {
      const lineString = new LineString([
        [50, 50, 3],
        [51, 51, 3],
        [52, 52, 4],
      ]);
      const geometryOptions = geometryFactory.getGeometryOptions(
        lineString,
        getAbsoluteHeightInfo(),
      );
      const cartographic = Cartographic.fromCartesian(
        geometryOptions.positions[0],
      );
      const mercatorCoord = Projection.wgs84ToMercator([
        CesiumMath.toDegrees(cartographic.longitude),
        CesiumMath.toDegrees(cartographic.latitude),
        cartographic.height,
      ]);
      expect(mercatorCoord[0]).to.be.closeTo(50, 0.00001);
      expect(mercatorCoord[1]).to.be.closeTo(50, 0.00001);
      expect(mercatorCoord[2]).to.be.closeTo(3, 0.00001);
    });

    it('should extract the same number of coordinates and convert to Cartesian3', () => {
      const lineString = new LineString([
        [1, 2, 3],
        [1, 3, 3],
        [1, 3, 4],
      ]);
      const geometryOptions = geometryFactory.getGeometryOptions(
        lineString,
        getAbsoluteHeightInfo(),
      );
      expect(geometryOptions.positions).to.be.an('array');
      expect(geometryOptions.positions).to.have.lengthOf(3);
      expect(geometryOptions.positions[0]).to.be.an.instanceof(Cartesian3);
    });
  });

  describe('validateLineString', () => {
    it('should invalidate a lineString without a coordinate', () => {
      const lineString = new LineString([]);
      expect(validateLineString(lineString)).to.be.false;
    });

    it('should invalidate a lineString with less then 2 coordinates', () => {
      const lineString = new LineString([[1, 2]]);
      expect(validateLineString(lineString)).to.be.false;
    });

    it('should invalidate a lineString with non-numeric values', () => {
      const lineString = new LineString([
        [1, 'notanumber' as unknown as number],
        [1, 3],
      ]);
      expect(validateLineString(lineString)).to.be.false;
    });

    it('should validate a lineString with 2D coordinates', () => {
      const lineString = new LineString([
        [1, 2],
        [1, 3],
      ]);
      expect(validateLineString(lineString)).to.be.true;
    });

    it('should validate a lineString with 3D coordinates', () => {
      const lineString = new LineString([
        [1, 2, 3],
        [1, 3, 3],
      ]);
      expect(validateLineString(lineString)).to.be.true;
    });

    it('should validate a lineString with more then 2 coordinates', () => {
      const lineString = new LineString([
        [1, 2, 3],
        [1, 3, 3],
        [1, 3, 4],
      ]);
      expect(validateLineString(lineString)).to.be.true;
    });

    it('should invalidate a non lineString geometry', () => {
      const lineString = new Polygon([
        [
          [1, 2, 3],
          [1, 3, 3],
          [1, 3, 4],
        ],
      ]);
      expect(validateLineString(lineString as unknown as LineString)).to.be
        .false;
    });

    it('should invalidate a lineString geometry with undefined values due to mixed 3D/2D Content', () => {
      const lineString = new LineString([
        [1, 2, 3],
        [1, 3],
        [1, 3],
      ]);
      expect(validateLineString(lineString)).to.be.false;
    });
  });
});
