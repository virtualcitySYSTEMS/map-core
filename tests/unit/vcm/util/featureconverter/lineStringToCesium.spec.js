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
  PrimitiveCollection,
  Primitive,
  GroundPolylinePrimitive,
} from '@vcmap/cesium';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import Feature from 'ol/Feature.js';
import Fill from 'ol/style/Fill.js';
import lineStringToCesium, {
  createGroundLineGeometries,
  createLineGeometries, createOutlineGeometries, createSolidGeometries,
  getCoordinates,
  getGeometryOptions,
  validateLineString,
} from '../../../../../src/vcs/vcm/util/featureconverter/lineStringToCesium.js';
import Projection from '../../../../../src/vcs/vcm/util/projection.js';
import VectorProperties from '../../../../../src/vcs/vcm/layer/vectorProperties.js';
import { emptyStyle } from '../../../../../src/vcs/vcm/util/style/styleHelpers.js';
import VectorContext from '../../../../../src/vcs/vcm/layer/cesium/vectorContext.js';
import { getMockScene } from '../../../helpers/cesiumHelpers.js';

describe('vcs.vcm.util.featureConverter.lineStringToCesium', () => {
  let options = null;

  before(() => {
    options = {
      positions: [
        new Cartesian3(1, 1, 1),
        new Cartesian3(2, 2, 2),
      ],
    };
  });

  describe('createSolidGeometries', () => {
    it('should create an array with one WallGeometry', () => {
      const solidGeometries = createSolidGeometries(options, 20, false, 10);
      expect(solidGeometries).to.be.an('array');
      expect(solidGeometries).to.have.lengthOf(1);
      expect(solidGeometries[0]).to.be.instanceof(WallGeometry);
    });

    it('should use extrudedHeight as minimumHeight', () => {
      const solidGeometries = createSolidGeometries(options, 20, false, 10);
      expect(solidGeometries[0]._minimumHeights).to.have.ordered.members([10, 10]);
    });

    it('should use height as maximumHeight', () => {
      const solidGeometries = createSolidGeometries(options, 20, false, 10);
      expect(solidGeometries[0]._maximumHeights).to.have.ordered.members([20, 20]);
    });

    it('should ignore height if perPositionHeight is set', () => {
      const solidGeometries = createSolidGeometries(options, 20, true, 10);
      expect(solidGeometries[0]._maximumHeights).to.be.undefined;
    });
  });

  describe('createOutlineGeometries', () => {
    it('should create an array with one WallOutlineGeometry', () => {
      const outlineGeometries = createOutlineGeometries(options, 20, false, 10);
      expect(outlineGeometries).to.be.an('array');
      expect(outlineGeometries).to.have.lengthOf(1);
      expect(outlineGeometries[0]).to.be.instanceof(WallOutlineGeometry);
    });

    it('should use extrudedHeight as minimumHeight', () => {
      const outlineGeometries = createOutlineGeometries(options, 20, false, 10);
      // creates a minimumHeight for each position, so two
      expect(outlineGeometries[0]._minimumHeights).to.have.ordered.members([10, 10]);
    });

    it('should use height as maximumHeight', () => {
      const outlineGeometries = createOutlineGeometries(options, 20, false, 10);
      // creates a minimumHeight for each position, so two
      expect(outlineGeometries[0]._maximumHeights).to.have.ordered.members([20, 20]);
    });

    it('should ignore height if perPositionHeight is set', () => {
      const outlineGeometries = createOutlineGeometries(options, 20, true, 10);
      expect(outlineGeometries[0]._maximumHeights).to.be.undefined;
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
      expect(polylineGeometrys[0]).to.be.instanceof(GroundPolylineGeometry);
    });

    it('should extract stroke width from the style ', () => {
      const polylineGeometrys = createGroundLineGeometries(options, style);
      expect(polylineGeometrys[0].width).to.be.equal(style.getStroke().getWidth());
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
      expect(polylineGeometrys[0]).to.be.instanceof(PolylineGeometry);
    });

    it('should extract stroke width from the style ', () => {
      const polylineGeometrys = createLineGeometries(options, style);
      expect(polylineGeometrys[0]._width).to.be.equal(style.getStroke().getWidth());
    });
  });

  describe('getGeometryOptions', () => {
    it('should extract the coordinates', () => {
      const lineString = new LineString([[50, 50, 3], [51, 51, 3], [52, 52, 4]]);
      const geometryOptions = getGeometryOptions(lineString, 0);
      const cartographic = Cartographic.fromCartesian(geometryOptions.positions[0]);
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
      const lineString = new LineString([[1, 2, 3], [1, 3, 3], [1, 3, 4]]);
      const geometryOptions = getGeometryOptions(lineString, 0);
      expect(geometryOptions.positions).to.be.an('array');
      expect(geometryOptions.positions).to.have.lengthOf(3);
      expect(geometryOptions.positions[0]).to.be.an.instanceof(Cartesian3);
    });

    it('should apply the positionHeightAdjustment to the z Coordinate', () => {
      const lineString = new LineString([[1, 2, 3], [1, 3, 3], [1, 3, 4]]);
      const geometryOptions = getGeometryOptions(lineString, 3);
      const cartographic = Cartographic.fromCartesian(geometryOptions.positions[0]);
      expect(cartographic.height).to.be.closeTo(6, 0.00001);
    });
  });

  describe('getCoordinates', () => {
    it('should return a array with the coordinates of all geometries', () => {
      const lineString = new LineString([[50, 50, 3], [51, 51, 3], [52, 52, 4]]);
      const lineString2 = new LineString([[54, 54, 3], [55, 55, 3], [56, 56, 4]]);
      const coordinates = getCoordinates([lineString, lineString2]);
      expect(coordinates).to.have.lengthOf(6);
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
      const lineString = new LineString([[1, 'notanumber'], [1, 3]]);
      expect(validateLineString(lineString)).to.be.false;
    });

    it('should validate a lineString with 2D coordinates', () => {
      const lineString = new LineString([[1, 2], [1, 3]]);
      expect(validateLineString(lineString)).to.be.true;
    });

    it('should validate a lineString with 3D coordinates', () => {
      const lineString = new LineString([[1, 2, 3], [1, 3, 3]]);
      expect(validateLineString(lineString)).to.be.true;
    });

    it('should validate a lineString with more then 2 coordinates', () => {
      const lineString = new LineString([[1, 2, 3], [1, 3, 3], [1, 3, 4]]);
      expect(validateLineString(lineString)).to.be.true;
    });

    it('should invalidate a non lineString geometry', () => {
      const lineString = new Polygon([[[1, 2, 3], [1, 3, 3], [1, 3, 4]]]);
      expect(validateLineString(lineString)).to.be.false;
    });

    it('should invalidate a lineString geometry with undefined values due to mixed 3D/2D Content', () => {
      const lineString = new LineString([[[1, 2, 3], [1, 3], [1, 3]]]);
      expect(validateLineString(lineString)).to.be.false;
    });
  });

  describe('lineStringToCesium', () => {
    let feature;
    let style;
    let geometries;
    let vectorProperties;
    let scene;
    let primitiveCollection;
    let context;

    before(() => {
      feature = new Feature({ id: 'myId' });
      style = new Style({
        fill: new Fill({
          color: [1, 1, 1],
        }),
        stroke: new Stroke({
          color: [1, 1, 1],
        }),
      });
      geometries = [new LineString([[1, 1, 0], [1, 2, 0]])];
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

    it('should not create Primitives without a fill or stroke style', () => {
      lineStringToCesium(feature, emptyStyle, geometries, vectorProperties, scene, context);
      expect(context.featureToPrimitiveMap.size).to.be.equal(0);
      expect(context.featureToBillboardMap.size).to.be.equal(0);
      expect(context.featureToLabelMap.size).to.be.equal(0);
    });

    it('should create a Primitive for AltitudeMode absolute', () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'absolute',
      });
      lineStringToCesium(feature, style, geometries, altitudeModeVectorProperties, scene, context);
      expect(context.primitives.length).to.be.equal(1);
      expect(context.primitives.get(0)).to.be.instanceOf(Primitive);
      altitudeModeVectorProperties.destroy();
    });

    it('should create a GroundPolylinePrimitive for AltitudeMode clampToGround', () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'clampToGround',
      });
      lineStringToCesium(feature, style, geometries, altitudeModeVectorProperties, scene, context);
      expect(context.primitives.length).to.be.equal(1);
      expect(context.primitives.get(0)).to.be.instanceOf(GroundPolylinePrimitive);
      altitudeModeVectorProperties.destroy();
    });

    it('should create a Fill and Outline Primitives for extruded geometry', () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'absolute',
        extrudedHeight: 10,
      });
      lineStringToCesium(feature, style, geometries, altitudeModeVectorProperties, scene, context);
      expect(context.primitives.length).to.be.equal(2);
      expect(context.primitives.get(0)).to.be.instanceOf(Primitive);
      expect(context.primitives.get(1)).to.be.instanceOf(Primitive);
      altitudeModeVectorProperties.destroy();
    });

    it('should create only a Fill Primitive if stroke style is not set ', () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'absolute',
        extrudedHeight: 10,
      });
      const fillStyle = new Style({ fill: new Fill({}) });
      lineStringToCesium(feature, fillStyle, geometries, altitudeModeVectorProperties, scene, context);
      expect(context.primitives.length).to.be.equal(1);
      expect(context.primitives.get(0)).to.be.instanceOf(Primitive);
      altitudeModeVectorProperties.destroy();
    });

    it('should create only a Stroke Primitive if fill style is not set ', () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'absolute',
        extrudedHeight: 10,
      });
      const strokeStyle = new Style({ stroke: new Stroke({}) });
      lineStringToCesium(feature, strokeStyle, geometries, altitudeModeVectorProperties, scene, context);
      expect(context.primitives.length).to.be.equal(1);
      expect(context.primitives.get(0)).to.be.instanceOf(Primitive);
      altitudeModeVectorProperties.destroy();
    });
  });
});
