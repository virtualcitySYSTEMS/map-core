import Circle from 'ol/geom/Circle.js';
import Point from 'ol/geom/Point.js';
import {
  Cartesian3,
  CircleGeometry,
  CircleOutlineGeometry,
  GroundPolylineGeometry,
  PolylineGeometry,
  Cartographic,
  PrimitiveCollection,
  Primitive,
  GroundPolylinePrimitive,
  GroundPrimitive,
  Math as CesiumMath,
} from '@vcmap-cesium/engine';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import Feature from 'ol/Feature.js';
import Fill from 'ol/style/Fill.js';
import circleToCesium, {
  validateCircle,
  createSolidGeometries,
  createOutlineGeometries,
  getLineGeometryOptions,
  createGroundLineGeometries,
  createLineGeometries,
  getGeometryOptions,
  getCoordinates,
} from '../../../../src/util/featureconverter/circleToCesium.js';
import Projection from '../../../../src/util/projection.js';
import VectorProperties from '../../../../src/layer/vectorProperties.js';
import VectorContext from '../../../../src/layer/cesium/vectorContext.js';
import { getCesiumMap } from '../../helpers/cesiumHelpers.js';

describe('util.featureConverter.circleToCesium', () => {
  let options;

  before(() => {
    options = {
      radius: 10,
      center: new Cartesian3(1, 1, 1),
    };
  });

  describe('createSolidGeometries', () => {
    it('should create an array with one CircleGeometry', () => {
      const solidGeometries = createSolidGeometries(options, 20, false, 10);
      expect(solidGeometries).to.be.an('array');
      expect(solidGeometries).to.have.lengthOf(1);
      expect(solidGeometries[0]).to.be.instanceOf(CircleGeometry);
    });

    it('should order height and extrudedHeight values', () => {
      const solidGeometries = createSolidGeometries(options, 20, false, 10);
      expect(solidGeometries[0]._ellipseGeometry._height).to.be.equal(20);
      expect(solidGeometries[0]._ellipseGeometry._extrudedHeight).to.be.equal(
        10,
      );
    });
  });

  describe('createOutlineGeometries', () => {
    let outlineGeometries;

    before(() => {
      outlineGeometries = createOutlineGeometries(options, 20, false, 10);
    });

    it('should create an array with one CircleOutlineGeometry', () => {
      expect(outlineGeometries).to.be.an('array');
      expect(outlineGeometries).to.have.lengthOf(1);
      expect(outlineGeometries[0]).to.be.instanceof(CircleOutlineGeometry);
    });

    it('should order height and extrudedHeight values', () => {
      expect(outlineGeometries[0]._ellipseGeometry._height).to.be.equal(20);
      expect(outlineGeometries[0]._ellipseGeometry._extrudedHeight).to.be.equal(
        10,
      );
    });
  });

  describe('getLineGeometryOptions', () => {
    let style;
    let lineGeometryOptions;

    before(() => {
      style = new Style({
        stroke: new Stroke({
          width: 3,
        }),
      });
      lineGeometryOptions = getLineGeometryOptions(options, style);
    });

    it('should create circular line with 40 vertices', () => {
      expect(lineGeometryOptions).to.be.an('object');
      expect(lineGeometryOptions).to.have.property('positions');
      expect(lineGeometryOptions.positions).to.have.length(41);
    });

    it('should extract stroke width from the style ', () => {
      expect(lineGeometryOptions).to.have.property('width');
      expect(lineGeometryOptions.width).to.be.equal(
        style.getStroke().getWidth(),
      );
    });
  });

  describe('createGroundLineGeometries', () => {
    let style = null;
    before(() => {
      style = new Style({
        stroke: new Stroke({
          width: 2.5,
        }),
      });
    });

    it('should create an array with one GroundPolylineGeometry', () => {
      const polylineGeometrys = createGroundLineGeometries(options, style);
      expect(polylineGeometrys).to.be.an('array');
      expect(polylineGeometrys).to.be.lengthOf(1);
      expect(polylineGeometrys[0]).to.be.instanceOf(GroundPolylineGeometry);
    });
  });

  describe('createLineGeometries', () => {
    let style = null;
    before(() => {
      style = new Style({
        stroke: new Stroke({
          width: 2.5,
        }),
      });
    });

    it('should create an array with one PolylineGeometry', () => {
      const polylineGeometrys = createLineGeometries(options, style);
      expect(polylineGeometrys).to.be.an('array');
      expect(polylineGeometrys).to.have.lengthOf(1);
      expect(polylineGeometrys[0]).to.be.instanceOf(PolylineGeometry);
    });
  });

  describe('getGeometryOptions', () => {
    it('should extract the center', () => {
      const circle = new Circle([50, 50, 3]);
      const geometryOptions = getGeometryOptions(circle, 0);
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
      const geometryOptions = getGeometryOptions(circle, 0);
      expect(geometryOptions.radius).to.be.closeTo(10, 0.00001);
    });

    it('should apply the positionHeightAdjustment to the z Coordinate', () => {
      const circle = new Circle([50, 50, 3], 10);
      const geometryOptions = getGeometryOptions(circle, 3);
      const cartographic = Cartographic.fromCartesian(geometryOptions.center);
      expect(cartographic.height).to.be.closeTo(6, 0.00001);
    });
  });

  describe('getCoordinates', () => {
    it('should return a array with the coordinates of all geometries', () => {
      const circle1 = new Circle([50, 50, 3]);
      const circle2 = new Circle([50, 55, 3]);
      const coordinates = getCoordinates([circle1, circle2]);
      expect(coordinates).to.have.lengthOf(2);
      expect(coordinates[0]).to.have.ordered.members(circle1.getCenter());
      expect(coordinates[1]).to.have.ordered.members(circle2.getCenter());
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
      const circle = new Circle([1, 2, 3], 'test');
      expect(validateCircle(circle)).to.be.false;
    });

    it('should invalidate a non circle geometry', () => {
      const circle = new Point([1, 2]);
      expect(validateCircle(circle)).to.be.false;
    });
  });

  describe('circleToCesium', () => {
    let feature;
    let emptyStyle;
    let style;
    let geometries;
    let vectorProperties;
    let map;
    let scene;
    let context;
    let primitiveCollection;

    before(() => {
      feature = new Feature({ id: 'myId' });
      emptyStyle = new Style({});
      style = new Style({
        fill: new Fill({
          color: [1, 1, 1],
        }),
        stroke: new Stroke({
          color: [1, 1, 1],
        }),
      });
      geometries = [new Circle([1, 1, 0], 10)];
      vectorProperties = new VectorProperties({
        altitudeMode: 'absolute',
        eyeOffset: [1, 1, 1],
      });
      map = getCesiumMap();
      scene = map.getScene();
      primitiveCollection = new PrimitiveCollection();
      context = new VectorContext(map, primitiveCollection);
    });

    afterEach(() => {
      context.clear();
    });

    after(() => {
      context.destroy();
      primitiveCollection.destroy();
      vectorProperties.destroy();
      map.destroy();
    });

    it('should not create Primitives without a fill or stroke style', () => {
      circleToCesium(
        feature,
        emptyStyle,
        geometries,
        vectorProperties,
        scene,
        context,
      );
      expect(context.featureToPrimitiveMap.size).to.be.equal(0);
      expect(context.featureToBillboardMap.size).to.be.equal(0);
      expect(context.featureToLabelMap.size).to.be.equal(0);
    });

    it('should create a outline and fill primitive for AltitudeMode absolute', () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'absolute',
      });
      circleToCesium(
        feature,
        style,
        geometries,
        altitudeModeVectorProperties,
        scene,
        context,
      );
      expect(context.primitives.length).to.be.equal(2);
      expect(context.primitives.get(0)).to.be.instanceOf(Primitive);
      expect(context.primitives.get(1)).to.be.instanceOf(Primitive);
      altitudeModeVectorProperties.destroy();
    });

    it('should create a GroundPolylinePrimitive and a groundPrimitive for AltitudeMode clampToGround', () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'clampToGround',
      });
      circleToCesium(
        feature,
        style,
        geometries,
        altitudeModeVectorProperties,
        scene,
        context,
      );
      expect(context.primitives.length).to.be.equal(2);
      expect(context.primitives.get(0)).to.be.instanceOf(
        GroundPolylinePrimitive,
      );
      expect(context.primitives.get(1)).to.be.instanceOf(GroundPrimitive);
      altitudeModeVectorProperties.destroy();
    });

    it('should create only a Fill Primitives if stroke is not set', () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'clampToGround',
      });
      const fillStyle = new Style({ fill: new Fill({}) });
      circleToCesium(
        feature,
        fillStyle,
        geometries,
        altitudeModeVectorProperties,
        scene,
        context,
      );
      expect(context.primitives.length).to.be.equal(1);
      expect(context.primitives.get(0)).to.be.instanceOf(GroundPrimitive);
      altitudeModeVectorProperties.destroy();
    });

    it('should create only an Outline Primitives if fill is not set', () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'clampToGround',
      });
      const strokeStyle = new Style({ stroke: new Stroke({}) });
      circleToCesium(
        feature,
        strokeStyle,
        geometries,
        altitudeModeVectorProperties,
        scene,
        context,
      );
      expect(context.primitives.length).to.be.equal(1);
      expect(context.primitives.get(0)).to.be.instanceOf(
        GroundPolylinePrimitive,
      );
      altitudeModeVectorProperties.destroy();
    });
  });
});
