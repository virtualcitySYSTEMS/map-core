import Polygon from 'ol/geom/Polygon.js';
import Point from 'ol/geom/Point.js';
import Cartesian3 from '@vcmap/cesium/Source/Core/Cartesian3.js';
import PolygonGeometry from '@vcmap/cesium/Source/Core/PolygonGeometry.js';
import PolygonOutlineGeometry from '@vcmap/cesium/Source/Core/PolygonOutlineGeometry.js';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import GroundPolylineGeometry from '@vcmap/cesium/Source/Core/GroundPolylineGeometry.js';
import PolylineGeometry from '@vcmap/cesium/Source/Core/PolylineGeometry.js';
import Cartographic from '@vcmap/cesium/Source/Core/Cartographic.js';
import Math as CesiumMath from '@vcmap/cesium/Source/Core/Math.js';
import PolygonHierarchy from '@vcmap/cesium/Source/Core/PolygonHierarchy.js';
import Feature from 'ol/Feature.js';
import Fill from 'ol/style/Fill.js';
import PrimitiveCollection from '@vcmap/cesium/Source/Scene/PrimitiveCollection.js';
import Primitive from '@vcmap/cesium/Source/Scene/Primitive.js';
import GroundPolylinePrimitive from '@vcmap/cesium/Source/Scene/GroundPolylinePrimitive.js';
import GroundPrimitive from '@vcmap/cesium/Source/Scene/GroundPrimitive.js';
import polygonToCesium, {
  createGroundLineGeometries, createLineGeometries,
  createOutlineGeometries,
  createSolidGeometries, getCoordinates, getGeometryOptions, getLineGeometryOptions,
  validatePolygon,
} from '../../../../../src/vcs/vcm/util/featureconverter/polygonToCesium.js';
import Projection from '../../../../../src/vcs/vcm/util/projection.js';
import VectorProperties from '../../../../../src/vcs/vcm/layer/vectorProperties.js';
import VectorContext from '../../../../../src/vcs/vcm/layer/cesium/vectorContext.js';
import { getMockScene } from '../../../helpers/cesiumHelpers.js';

describe('vcs.vcm.util.featureConverter.polygonToCesium', () => {
  let options;

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
          },
        ],
      },
    };
  });

  describe('createSolidGeometries', () => {
    it('should create an array with one PolygonGeometry', () => {
      const solidGeometries = createSolidGeometries(options, 20, false, 10);
      expect(solidGeometries).to.be.an('array');
      expect(solidGeometries).to.have.lengthOf(1);
      expect(solidGeometries[0]).to.be.instanceof(PolygonGeometry);
    });

    it('should order height and extrudedHeight values', () => {
      const solidGeometries = createSolidGeometries(options, 20, false, 10);
      expect(solidGeometries[0]._height).to.be.equal(20);
      expect(solidGeometries[0]._extrudedHeight).to.be.equal(10);
    });
  });

  describe('createOutlineGeometries', () => {
    let outlineGeometries;

    before(() => {
      outlineGeometries = createOutlineGeometries(options, 20, false, 10);
    });

    it('should create an array with one PolygonOutlineGeometry', () => {
      expect(outlineGeometries).to.be.an('array');
      expect(outlineGeometries).to.have.lengthOf(1);
      expect(outlineGeometries[0]).to.be.instanceof(PolygonOutlineGeometry);
    });

    it('should order height and extrudedHeight values', () => {
      expect(outlineGeometries[0]._height).to.be.equal(20);
      expect(outlineGeometries[0]._extrudedHeight).to.be.equal(10);
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

    it('should extract stroke width from the style for each entry', () => {
      expect(lineGeometryOptions).to.be.an('array').and.have.length(2);
      lineGeometryOptions.forEach((lineGeometryOption) => {
        expect(lineGeometryOption).to.have.property('positions');
        expect(lineGeometryOption).to.have.property('width').and.to.be.equal(style.getStroke().getWidth());
      });
    });

    it('should extract polygon outline and hole outline', () => {
      expect(lineGeometryOptions[0].positions).to.be.equal(options.polygonHierarchy.positions);
      expect(lineGeometryOptions[1].positions).to.be.equal(options.polygonHierarchy.holes[0].positions);
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

    it('should create an array with two GroundPolylineGeometry (outer/inner ring)', () => {
      const polylineGeometrys = createGroundLineGeometries(options, style);
      expect(polylineGeometrys).to.be.an('array');
      expect(polylineGeometrys).to.be.lengthOf(2);
      expect(polylineGeometrys[0]).to.be.instanceOf(GroundPolylineGeometry);
      expect(polylineGeometrys[1]).to.be.instanceOf(GroundPolylineGeometry);
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
      expect(polylineGeometrys).to.have.lengthOf(2);
      expect(polylineGeometrys[0]).to.be.instanceOf(PolylineGeometry);
      expect(polylineGeometrys[1]).to.be.instanceOf(PolylineGeometry);
    });
  });

  describe('getGeometryOptions', () => {
    let coordinates;
    let polygon;
    let geometryOptions;

    before(() => {
      coordinates = [
        [[50, 50, 3], [50, 55, 3], [55, 50, 3]],
        [[51, 50, 3], [52, 51, 3], [51, 52, 3]],
      ];
      polygon = new Polygon(coordinates);
      geometryOptions = getGeometryOptions(polygon, 0);
    });

    it('should return a PolygonHierarchy', () => {
      expect(geometryOptions).to.be.an('object').and.have.property('polygonHierarchy');
      expect(geometryOptions.polygonHierarchy).to.be.instanceOf(PolygonHierarchy);
    });

    it('should convert the outer ring', () => {
      const cartographics = geometryOptions.polygonHierarchy.positions.map((pos) => {
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
          expect(coord[0]).to.be.closeTo(coordinates[0][index][0], 0.00001);
          expect(coord[1]).to.be.closeTo(coordinates[0][index][1], 0.00001);
          expect(coord[2]).to.be.closeTo(coordinates[0][index][2], 0.00001);
        }
      });
    });

    it('should convert the inner rings', () => {
      const cartographics = geometryOptions.polygonHierarchy.holes[0].positions.map((pos) => {
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
        if (index <= 2) { // converter ring is closed.
          expect(coord[0]).to.be.closeTo(coordinates[1][index][0], 0.00001);
          expect(coord[1]).to.be.closeTo(coordinates[1][index][1], 0.00001);
          expect(coord[2]).to.be.closeTo(coordinates[1][index][2], 0.00001);
        }
      });
    });
  });

  describe('getCoordinates', () => {
    it('should return a array with the coordinates of all geometries', () => {
      const coords = [[[50, 50, 3], [50, 55, 3], [55, 50, 3]], [[51, 50, 3], [51, 52, 3], [52, 51, 3]]];
      const polygon = new Polygon(coords);
      const coordinates = getCoordinates([polygon]);
      expect(coordinates).to.have.lengthOf(6);
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
      const polygon = new Polygon([[[1, 2], [1, 3]]]);
      expect(validatePolygon(polygon)).to.be.false;
    });

    it('should invalidate a polygon with three coordinates but 2 linearrings', () => {
      const polygon = new Polygon([[[1, 2], [1, 3], [2, 4]], []]);
      expect(validatePolygon(polygon)).to.be.false;
    });

    it('should invalidate a polygon with non number values', () => {
      const polygon = new Polygon([[[1, 2], [1, '3'], [2, 4]]]);
      expect(validatePolygon(polygon)).to.be.false;
    });

    it('should validate a polygon with three coordinates and one linearring', () => {
      const polygon = new Polygon([[[1, 2], [1, 3], [2, 4]]]);
      expect(validatePolygon(polygon)).to.be.true;
    });

    it('should validate a polygon with two linearrings with each at least 3 coordinates', () => {
      const polygon = new Polygon([
        [[1, 1, 1], [1, 2, 1], [2, 2, 1]],
        [[1.4, 1.4, 1], [1.6, 1.6, 1], [1.4, 1.6, 1]],
      ]);
      expect(validatePolygon(polygon)).to.be.true;
    });

    it('should not validate linearRings without at least 3 coordinates', () => {
      const polygon = new Polygon([
        [[1, 1, 1], [1, 2, 1], [2, 2, 1]],
        [[1.4, 1.4, 1], [1.6, 1.6, 1]],
      ]);
      expect(validatePolygon(polygon)).to.be.false;
    });

    it('should not invalidate non Polygon Geometries', () => {
      const polygon = new Point([0, 0]);
      expect(validatePolygon(polygon)).to.be.false;
    });

    it('should not validate a polygon with undefined values due to mixed 3D/2D Content', () => {
      const polygon = new Polygon([[[1, 2, 3], [1, 3], [2, 4]]]);
      expect(validatePolygon(polygon)).to.be.false;
    });
  });

  describe('polygonToCesium', () => {
    let feature;
    let emptyStyle;
    let style;
    let geometries;
    let vectorProperties;
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
      geometries = [new Polygon([
        [[1, 1, 1], [1, 2, 1], [2, 2, 1], [1, 1, 1]],
        [[1.4, 1.4, 1], [1.6, 1.6, 1], [1.4, 1.6, 1], [1.4, 1.4, 1]],
      ])];
      vectorProperties = new VectorProperties({
        altitudeMode: 'absolute',
        eyeOffset: [1, 1, 1],
      });
      scene = getMockScene();
      primitiveCollection = new PrimitiveCollection();
      context = new VectorContext(scene, primitiveCollection);
    });

    afterEach(() => {
      context.clear();
    });

    after(() => {
      primitiveCollection.destroy();
      vectorProperties.destroy();
    });

    it('should return without a fill or stroke style', () => {
      polygonToCesium(feature, emptyStyle, geometries, vectorProperties, scene, context);
      expect(context.featureToPrimitiveMap.size).to.be.equal(0);
      expect(context.featureToBillboardMap.size).to.be.equal(0);
      expect(context.featureToLabelMap.size).to.be.equal(0);
    });

    it('should create Primitives for AltitudeMode absolute', () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'absolute',
      });
      polygonToCesium(feature, style, geometries, altitudeModeVectorProperties, scene, context);
      expect(context.primitives.length).to.be.equal(2);
      expect(context.primitives.get(0)).to.be.instanceOf(Primitive); // fill primitive
      expect(context.primitives.get(1)).to.be.instanceOf(Primitive); // line primitive
    });

    it('should create a Ground Primitives for AltitudeMode clampToGround', () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'clampToGround',
      });
      polygonToCesium(feature, style, geometries, altitudeModeVectorProperties, scene, context);
      expect(context.primitives.length).to.be.equal(2);
      expect(context.primitives.get(0)).to.be.instanceOf(GroundPolylinePrimitive);
      expect(context.primitives.get(1)).to.be.instanceOf(GroundPrimitive);
    });

    it('should create only GroundPolylinePrimitive for non Fill Styles', () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'clampToGround',
      });
      const strokeStyle = new Style({ stroke: new Stroke({}) });
      polygonToCesium(feature, strokeStyle, geometries, altitudeModeVectorProperties, scene, context);
      expect(context.primitives.length).to.be.equal(1);
      expect(context.primitives.get(0)).to.be.instanceOf(GroundPolylinePrimitive);
    });

    it('should create only GroundPrimitive for non Stroke Styles', () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'clampToGround',
      });
      const fillStyle = new Style({ fill: new Fill({}) });
      polygonToCesium(feature, fillStyle, geometries, altitudeModeVectorProperties, scene, context);
      expect(context.primitives.length).to.be.equal(1);
      expect(context.primitives.get(0)).to.be.instanceOf(GroundPrimitive);
    });
  });
});
