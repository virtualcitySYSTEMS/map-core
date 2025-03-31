import { expect } from 'chai';
import Circle from 'ol/geom/Circle.js';
import Point from 'ol/geom/Point.js';
import {
  Cartesian3,
  CircleGeometry,
  CircleOutlineGeometry,
  GroundPolylineGeometry,
  PolylineGeometry,
  Cartographic,
  Math as CesiumMath,
  HeightReference,
} from '@vcmap-cesium/engine';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import {
  validateCircle,
  getCircleGeometryFactory,
} from '../../../../src/util/featureconverter/circleToCesium.js';
import Projection from '../../../../src/util/projection.js';
import type {
  CesiumGeometryOption,
  CircleGeometryOptions,
  VectorGeometryFactory,
} from '../../../../src/util/featureconverter/vectorGeometryFactory.js';

describe('circleToCesium', () => {
  let options: CircleGeometryOptions;
  let geometryFactory: VectorGeometryFactory<'circle'>;

  before(() => {
    options = {
      radius: 10,
      center: new Cartesian3(1, 1, 1),
    };
    geometryFactory = getCircleGeometryFactory();
  });

  describe('createSolidGeometries', () => {
    it('should create an array with one CircleGeometry', () => {
      const solidGeometries = geometryFactory.createSolidGeometries(
        options,
        { heightReference: HeightReference.CLAMP_TO_GROUND, layout: 'XYZ' },
        20,
        false,
      );
      expect(solidGeometries).to.be.an('array');
      expect(solidGeometries).to.have.lengthOf(1);
      expect(solidGeometries[0].geometry).to.be.instanceOf(CircleGeometry);
    });
  });

  describe('createOutlineGeometries', () => {
    it('should create an array with one CircleOutlineGeometry', () => {
      const outlineGeometries = geometryFactory.createOutlineGeometries(
        options,
        { heightReference: HeightReference.CLAMP_TO_GROUND, layout: 'XYZ' },
        20,
        false,
        10,
      );
      expect(outlineGeometries).to.be.an('array');
      expect(outlineGeometries).to.have.lengthOf(1);
      expect(outlineGeometries[0].geometry).to.be.instanceof(
        CircleOutlineGeometry,
      );
    });
  });

  describe('getLineGeometryOptions', () => {
    let style: Style;
    let polylineGeometries: CesiumGeometryOption<'line'>[];

    before(() => {
      style = new Style({
        stroke: new Stroke({
          width: 3,
        }),
      });
      polylineGeometries = geometryFactory.createLineGeometries(
        options,
        { heightReference: HeightReference.CLAMP_TO_GROUND, layout: 'XYZ' },
        style,
      );
    });

    it('should create an array with one PolylineGeometry', () => {
      expect(polylineGeometries).to.be.an('array');
      expect(polylineGeometries).to.have.lengthOf(1);
      expect(polylineGeometries[0].geometry).to.be.instanceOf(PolylineGeometry);
    });

    it('should create circular line with 40 vertices', () => {
      expect(polylineGeometries).to.be.an('array');
      expect(polylineGeometries[0].geometry)
        .to.have.property('_positions')
        .and.to.have.lengthOf(41);
    });

    it('should extract stroke width from the style ', () => {
      expect(polylineGeometries[0].geometry)
        .to.have.property('_width')
        .and.to.be.equal(style.getStroke()?.getWidth());
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
        { heightReference: HeightReference.CLAMP_TO_GROUND, layout: 'XYZ' },
        style,
      );
      expect(polylineGeometrys).to.be.an('array');
      expect(polylineGeometrys).to.be.lengthOf(1);
      expect(polylineGeometrys[0].geometry).to.be.instanceOf(
        GroundPolylineGeometry,
      );
    });
  });

  describe('getGeometryOptions', () => {
    it('should extract the center', () => {
      const circle = new Circle([50, 50, 3]);
      const geometryOptions = geometryFactory.getGeometryOptions(circle, {
        heightReference: HeightReference.CLAMP_TO_GROUND,
        layout: 'XYZ',
      });
      const cartographic = Cartographic.fromCartesian(geometryOptions.center);
      const mercatorCoord = Projection.wgs84ToMercator([
        CesiumMath.toDegrees(cartographic.longitude),
        CesiumMath.toDegrees(cartographic.latitude),
        cartographic.height,
      ]);
      expect(mercatorCoord[0]).to.be.closeTo(50, 0.00001);
      expect(mercatorCoord[1]).to.be.closeTo(50, 0.00001);
      expect(mercatorCoord[2]).to.be.closeTo(3, 0.00001);
    });

    it('should calculate the radius based on the converter based on Cartesian3 distance', () => {
      const circle = new Circle([50, 50, 3], 10);
      const geometryOptions = geometryFactory.getGeometryOptions(circle, {
        heightReference: HeightReference.CLAMP_TO_GROUND,
        layout: 'XYZ',
      });
      expect(geometryOptions.radius).to.be.closeTo(10, 0.00001);
    });
  });

  describe('validateCircle', () => {
    it('should invalidate a circle without a coordinate', () => {
      const circle = new Circle([], 12);
      expect(validateCircle(circle)).to.be.false;
    });

    it('should invalidate a circle without a radius', () => {
      const circle = new Circle([1, 2, 3]);
      expect(validateCircle(circle)).to.be.false;
    });

    it('should validate a circle with a 3D center and a radius', () => {
      const circle = new Circle([1, 2, 3], 23);
      expect(validateCircle(circle)).to.be.true;
    });

    it('should validate a circle with a 2D center and a radius', () => {
      const circle = new Circle([1, 2], 23);
      expect(validateCircle(circle)).to.be.true;
    });

    it('should invalidate a circle with a non-numeric value', () => {
      const circle = new Circle([1, 2, 3], 'test' as unknown as number);
      expect(validateCircle(circle)).to.be.false;
    });

    it('should invalidate a non circle geometry', () => {
      const circle = new Point([1, 2]);
      expect(validateCircle(circle as unknown as Circle)).to.be.false;
    });
  });
});
