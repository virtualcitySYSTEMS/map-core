import LineString from 'ol/geom/LineString.js';
import { getCenter, getSize } from 'ol/extent.js';
import Polygon from 'ol/geom/Polygon.js';
import Feature from 'ol/Feature.js';
import {
  Cartesian3,
  ClippingPlaneCollection,
  ClippingPlane,
  Matrix4,
  Color,
  ConstantProperty,
  Entity,
  Globe,
  Cesium3DTileset,
  Plane,
  Matrix3,
  JulianDate,
} from '@vcmap-cesium/engine';
import { Point } from 'ol/geom.js';
import {
  clearClippingPlanes,
  copyClippingPlanesToCollection,
  createClippingPlaneCollection,
  setClippingPlanes,
  createClippingFeature, getClippingOptions,
} from '../../../../src/util/clipping/clippingPlaneHelper.js';
import Projection from '../../../../src/util/projection.js';
import getDummyCesium3DTileset from '../../layer/cesium/getDummyCesium3DTileset.js';
import VcsApp from '../../../../src/vcsApp.js';
import { setCesiumMap } from '../../helpers/cesiumHelpers.js';

describe('util.clipping.ClippingPlaneHelpers', () => {
  function expectedPlane(plane, distance, x, y, z) {
    expect(plane).to.have.property('distance', distance);
    expect(plane.normal).to.have.property('x', x);
    expect(plane.normal).to.have.property('y', y);
    expect(plane.normal).to.have.property('z', z);
  }

  let sandbox;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createClippingPlaneCollection', () => {
    /**
     * Transformations are stubbed for easier reading and generating of test cases
     */
    let feature;

    beforeEach(() => {
      feature = new Feature();
      sandbox.stub(Projection, 'mercatorToWgs84').callsFake(coords => coords);
      sandbox.stub(Cartesian3, 'fromDegrees').callsFake((x, y, z) => new Cartesian3(x, y, z));
    });

    describe('Point', () => {
      let options;
      let geometry;

      before(() => {
        options = { createBottomPlane: true, createTopPlane: true };
      });

      beforeEach(() => {
        geometry = new Point([1, 1, 1]);
        feature.setGeometry(geometry);
      });

      it('should create a horizontal plane', () => {
        const clippingPlanes = createClippingPlaneCollection(feature, options);
        expect(clippingPlanes).to.have.length(1);
        expectedPlane(clippingPlanes.get(0), 1, 0, 0, -1);
      });

      it('should create a bottom and top plane, if extruded', () => {
        feature.set('olcs_extrudedHeight', 1);
        const clippingPlanes = createClippingPlaneCollection(feature, options);
        expect(clippingPlanes).to.have.length(2);
        expectedPlane(clippingPlanes.get(0), 1, 0, 0, -1);
        expectedPlane(clippingPlanes.get(1), -2, 0, 0, 1);
      });
    });

    describe('LineString', () => {
      let geometry;

      beforeEach(() => {
        geometry = new LineString([[1, 1, 0], [2, 1, 0]]);
        feature.setGeometry(geometry);
      });

      it('should create a vertical plane per segment', () => {
        geometry.setCoordinates([[1, 1, 0], [2, 1, 0], [2, 2, 0]]);
        const planes = createClippingPlaneCollection(feature, { createVerticalPlanes: true });
        expect(planes).to.have.length(2);
        expectedPlane(planes.get(0), 0, 0, 0, 1);
        expectedPlane(planes.get(1), 0, 0, 0, -1);
      });

      it('should create two ending planes, if there is only one segment', () => {
        const planes = createClippingPlaneCollection(feature, { createVerticalPlanes: true, createEndingPlanes: true });
        expect(planes).to.have.length(3);
        expectedPlane(planes.get(0), 0, -0.7071067811865475, 0.7071067811865475, 0);
        expectedPlane(planes.get(1), 0, 0.4472135954999579, -0.8944271909999159, 0);
        expectedPlane(planes.get(2), 0, 0, 0, 1);
      });

      it('should create bottom plane, if absolute', () => {
        geometry.setCoordinates([[1, 1, 1], [2, 1, 1]]);
        feature.set('olcs_altitudeMode', 'absolute');
        const planes = createClippingPlaneCollection(feature, { createTopPlane: true, createBottomPlane: true });
        expect(planes).to.have.length(1);
        expectedPlane(planes.get(0), 1, 0, 0, -1);
      });

      it('should create top and bottom planes, if absolute & extruded', () => {
        geometry.setCoordinates([[1, 1, 1], [2, 1, 1]]);
        feature.set('olcs_extrudedHeight', 1);
        feature.set('olcs_altitudeMode', 'absolute');
        const planes = createClippingPlaneCollection(feature, { createTopPlane: true, createBottomPlane: true });
        expect(planes).to.have.length(2);
        expectedPlane(planes.get(0), 1, 0, 0, -1);
        expectedPlane(planes.get(1), -2, 0, 0, 1);
      });
    });

    describe('Polygon', () => {
      let geometry;

      beforeEach(() => {
        geometry = new Polygon([[[1, 1, 0], [2, 1, 0], [2, 2, 0], [1, 2, 0]]]);
        feature.setGeometry(geometry);
      });

      it('should create a vertical plane per segment', () => {
        const planes = createClippingPlaneCollection(feature, { createVerticalPlanes: true });
        expect(planes).to.have.length(4);
        expectedPlane(planes.get(0), 0, 0, 0, 1);
        expectedPlane(planes.get(1), 0, 0, 0, -1);
        expectedPlane(planes.get(2), 0, 0, 0, -1);
        expectedPlane(planes.get(3), 0, 0, 0, 1);
      });

      it('should create bottom plane, if absolute', () => {
        feature.set('olcs_altitudeMode', 'absolute');
        const planes = createClippingPlaneCollection(feature, { createTopPlane: true, createBottomPlane: true });
        expect(planes).to.have.length(1);
        expectedPlane(planes.get(0), -0, 0, 0, -1);
      });

      it('should create top and bottom planes, if absolute & extruded', () => {
        feature.set('olcs_extrudedHeight', 1);
        feature.set('olcs_altitudeMode', 'absolute');
        const planes = createClippingPlaneCollection(feature, { createTopPlane: true, createBottomPlane: true });
        expect(planes).to.have.length(2);
        expectedPlane(planes.get(0), -0, 0, 0, -1);
        expectedPlane(planes.get(1), -1, 0, 0, 1);
      });
    });

    it('should reverse the plane', () => {
      feature.setGeometry(new Point([1, 1, 1]));
      const clippingPlanes = createClippingPlaneCollection(feature, {
        createBottomPlane: true,
        reverse: true,
      });
      expect(clippingPlanes).to.have.length(1);
      expectedPlane(clippingPlanes.get(0), -1, 0, 0, 1);
    });
  });

  describe('copyClippingPlanesToCollection', () => {
    let result;
    let source;

    beforeEach(() => {
      result = new ClippingPlaneCollection();
      source = new ClippingPlaneCollection({
        planes: [new ClippingPlane(new Cartesian3(1, 1, 1), 1)],
      });
    });

    it('should remove all from result, before adding new planes', () => {
      const plane = new ClippingPlane(new Cartesian3(1, 1, 1), 2);
      result.add(plane);
      copyClippingPlanesToCollection(source, result);
      expect(result.contains(plane)).to.be.false;
    });

    it('should create a clone of the given planes', () => {
      copyClippingPlanesToCollection(source, result);
      expect(result).to.have.length(1);
      expectedPlane(result.get(0), 1, 1, 1, 1);
      expect(result.get(0)).to.not.equal(source.get(0));
    });

    it('should clone the sources model matrix', () => {
      source.modelMatrix = new Matrix4(1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 1, 1, 1, 1);
      copyClippingPlanesToCollection(source, result);
      expect(source.modelMatrix.equals(result.modelMatrix)).to.be.true;
      expect(result.modelMatrix).to.not.equal(source.modelMatrix);
    });

    it('should assign the same unionClippingPlanes flag', () => {
      source.unionClippingRegions = true;
      copyClippingPlanesToCollection(source, result);
      expect(result.unionClippingRegions).to.be.true;
    });
    it('should assign the same edgeWidth property', () => {
      source.edgeWidth = 2.0;
      copyClippingPlanesToCollection(source, result);
      expect(result.edgeWidth).to.equal(2.0);
    });
    it('should clone the edgeColor Property', () => {
      source.edgeColor = Color.RED;
      copyClippingPlanesToCollection(source, result);
      expect(result.edgeColor.equals(source.edgeColor)).to.be.true;
      expect(result.edgeColor).to.not.equal(source.edgeColor);
    });
  });

  describe('clearClippingPlanes', () => {
    it('should clear a models clipping plane property', () => {
      const entity = new Entity({ model: {} });
      const collection = new ClippingPlaneCollection({
        planes: [new ClippingPlane(new Cartesian3(1, 1, 1), 1)],
      });
      entity.model.clippingPlanes = new ConstantProperty(collection);
      clearClippingPlanes(entity);
      expect(collection).to.have.length(0);
    });

    it('should assign an empty clipping plane to a model', () => {
      const entity = new Entity({ model: {} });
      clearClippingPlanes(entity);
      expect(entity.model).to.have.property('clippingPlanes');
      expect(entity.model.clippingPlanes.getValue()).to.be.an.instanceOf(ClippingPlaneCollection);
    });

    it('should clear the clipping planes of a Cesium3DTileset', () => {
      const tileset = getDummyCesium3DTileset();
      const collection = new ClippingPlaneCollection({
        planes: [new ClippingPlane(new Cartesian3(1, 1, 1), 1)],
      });
      tileset.clippingPlanes = collection;
      clearClippingPlanes(tileset);
      expect(collection).to.have.length(0);
      tileset.destroy();
    });

    it('should add an empty clippingPlanesCollection to any target', () => {
      const globe = new Globe();
      clearClippingPlanes(globe);
      expect(globe).to.have.property('clippingPlanes').that.is.an.instanceOf(ClippingPlaneCollection);
      globe.destroy();
    });
  });

  describe('setClippingPlanes', () => {
    let collection;

    beforeEach(() => {
      collection = new ClippingPlaneCollection({
        planes: [new ClippingPlane(new Cartesian3(1, 1, 1), 1)],
      });
    });

    describe('Cesium3DTileset', () => {
      let tileset;

      beforeEach(() => {
        tileset = getDummyCesium3DTileset();
        // eslint-disable-next-line no-proto
        tileset.__proto__ = Cesium3DTileset.prototype;
      });

      afterEach(() => {
        tileset.destroy();
      });

      it('should set the clipping planes on the tileset', () => {
        setClippingPlanes(tileset, collection);
        expect(tileset.clippingPlanes).to.have.length(1);
      });

      it('should clone the clipping collection', () => {
        setClippingPlanes(tileset, collection);
        expect(tileset.clippingPlanes.length).to.be.equal(collection.length);
        expect(tileset.clippingPlanes).to.not.equal(collection);
      });

      it('should clear any previous planes', () => {
        const plane = new ClippingPlane(new Cartesian3(1, 1, 1), -1);
        tileset.clippingPlanes.add(plane);
        setClippingPlanes(tileset, collection);
        expect(tileset.clippingPlanes).to.have.length(1);
        expect(tileset.clippingPlanes.contains(plane)).to.be.false;
      });

      it('should transform the plane with the rotation of the the inverted transformation of the tileset', () => {
        const transform = sandbox.spy(Plane, 'transform');
        const rotation = Matrix4.getMatrix3(
          Matrix4.inverse(tileset.clippingPlanesOriginMatrix, new Matrix4()),
          new Matrix3(),
        );
        const transformationMatrix = Matrix4.fromRotationTranslation(rotation, new Cartesian3());
        setClippingPlanes(tileset, collection);
        expect(transform).to.have.been.called;
        const { args } = transform.getCall(0);
        expect(Matrix4.equals(args[1], transformationMatrix)).to.be.true;
      });

      it('should set the distance of the transformed plane to the distance of the original plane to the originPoint', () => {
        setClippingPlanes(tileset, collection);
        const originPoint = tileset.boundingSphere.center;
        const distance = Plane.getPointDistance(collection.get(0), originPoint);
        expect(tileset.clippingPlanes.get(0).distance).to.equal(distance);
      });

      it('should not apply the transformation of local', () => {
        const inverse = sandbox.spy(Matrix4, 'inverse');
        setClippingPlanes(tileset, collection, true);
        expect(inverse).to.not.have.been.called;
      });

      it('should multiply any previous model matrix on the collection', () => {
        const multiply = sandbox.spy(Matrix4, 'multiply');
        collection.modelMatrix = Matrix4.multiplyByScalar(Matrix4.IDENTITY, 2, new Matrix4());
        setClippingPlanes(tileset, collection);
        expect(multiply).to.have.been.called;
      });

      it('should not multiply any previous model, if its an IDENTITY', () => {
        const multiply = sandbox.spy(Matrix4, 'multiply');
        collection.modelMatrix = Matrix4.IDENTITY;
        setClippingPlanes(tileset, collection);
        expect(multiply).to.not.have.been.called;
      });

      it('should not multiply the previous model matrix, if local', () => {
        const multiply = sandbox.spy(Matrix4, 'multiply');
        collection.modelMatrix = Matrix4.fromScale(new Cartesian3(2, 1, 1));
        setClippingPlanes(tileset, collection, true);
        expect(multiply).to.not.have.been.called;
      });
    });

    describe('Entity', () => {
      let entity;

      beforeEach(() => {
        entity = new Entity({
          model: {},
          position: new Cartesian3(1, 1, 1),
        });
      });

      it('should set the clipping planes on the entity', () => {
        setClippingPlanes(entity, collection);
        const clippingPlanes = entity.model.clippingPlanes.getValue();
        expect(clippingPlanes).to.have.length(1);
        expectedPlane(clippingPlanes.get(0), 1, 1, 1, 1);
      });

      it('should clone the clipping collection', () => {
        setClippingPlanes(entity, collection);
        const clippingPlanes = entity.model.clippingPlanes.getValue();

        expect(clippingPlanes.contains(collection.get(0))).to.be.true;
        expect(clippingPlanes).to.not.equal(collection);
      });

      it('should clear any previous planes', () => {
        const plane = new ClippingPlane(new Cartesian3(1, 1, 1), -1);
        entity.model.clippingPlanes =
          new ConstantProperty(new ClippingPlaneCollection({ planes: [plane] }));
        setClippingPlanes(entity, collection);
        const clippingPlanes = entity.model.clippingPlanes.getValue();
        expect(clippingPlanes).to.have.length(1);
        expect(clippingPlanes.contains(plane)).to.be.false;
      });

      it('should apply the inverse transformation of the model', () => {
        const inverse = sandbox.spy(Matrix4, 'inverseTransformation');
        setClippingPlanes(entity, collection);
        expect(inverse).to.have.been.called;
        const { args, returnValue } = inverse.getCall(0);
        expect(args[0].equals(entity.computeModelMatrix(JulianDate.now()))).to.be.true;
        const clippingPlanes = entity.model.clippingPlanes.getValue();
        expect(clippingPlanes.modelMatrix).to.equal(returnValue);
      });

      it('should not apply the transformation of local', () => {
        const inverse = sandbox.spy(Matrix4, 'inverseTransformation');
        setClippingPlanes(entity, collection, true);
        expect(inverse).to.not.have.been.called;
      });

      it('should multiply any previous model matrix on the collection', () => {
        const multiply = sandbox.spy(Matrix4, 'multiply');
        collection.modelMatrix = Matrix4.fromScale(new Cartesian3(2, 1, 1));
        setClippingPlanes(entity, collection);
        const clippingPlanes = entity.model.clippingPlanes.getValue();
        expect(multiply).to.have.been
          .calledWith(clippingPlanes.modelMatrix, collection.modelMatrix, clippingPlanes.modelMatrix);
      });

      it('should not multiply any previous model matrix, if its an IDENTITY', () => {
        const multiply = sandbox.spy(Matrix4, 'multiply');
        collection.modelMatrix = Matrix4.IDENTITY;
        setClippingPlanes(entity, collection);
        expect(multiply).to.not.have.been.called;
      });

      it('should not multiply the previous model matrix, if local', () => {
        const multiply = sandbox.spy(Matrix4, 'multiply');
        collection.modelMatrix = Matrix4.fromScale(new Cartesian3(2, 1, 1));
        setClippingPlanes(entity, collection, true);
        expect(multiply).to.not.have.been.called;
      });
    });
  });

  describe('createClippingFeature', () => {
    let app;
    let cesiumMap;
    before(async () => {
      app = new VcsApp();
      cesiumMap = await setCesiumMap(app);
    });

    after(() => {
      app.destroy();
    });

    describe('polygon', () => {
      it('should create a feature with a polygon geometry', () => {
        const feature = createClippingFeature([0, 0], cesiumMap.getScene().camera);
        expect(feature.getGeometry()).to.be.an.instanceOf(Polygon);
      });

      it('should create a polygon around the given coordinate', () => {
        sandbox.stub(Polygon.prototype, 'transform');
        const geometry = createClippingFeature([0, 0], cesiumMap.getScene().camera).getGeometry();
        expect(getCenter(geometry.getExtent()).map(c => Math.round(c))).to.have.members([0, 0]);
      });

      it('should create a polygon with a size defined by the offset', () => {
        const geometry = createClippingFeature([0, 0], cesiumMap.getScene().camera, false, 1).getGeometry();
        const roundedSize = getSize(geometry.getExtent()).map(c => Math.round(c));
        expect(roundedSize).to.have.members([1, 1]);
      });
    });

    describe('line', () => {
      it('should create a feature with a line', () => {
        const feature = createClippingFeature([0, 0], cesiumMap.getScene().camera, true);
        expect(feature.getGeometry()).to.be.an.instanceOf(LineString);
      });

      it('should create a line extending by the offset, away from the coordinate', () => {
        const geometry = createClippingFeature([0, 0], cesiumMap.getScene().camera, true, 1).getGeometry();
        const roundedSize = getSize(geometry.getExtent()).map(c => Math.round(c));
        expect(roundedSize).to.have.members([2, 0]);
      });

      it('should extrude the feature by twice the offset', () => {
        const feature = createClippingFeature([0, 0], cesiumMap.getScene().camera, true, 1);
        expect(feature.get('olcs_extrudedHeight')).to.equal(2);
      });
    });
  });

  describe('getClippingOptions', () => {
    let feature;
    describe('polygon', () => {
      beforeEach(() => {
        feature = new Feature({ geometry: new Polygon([[]]) });
      });

      it('should always create bottomPlane', () => {
        let options = getClippingOptions(feature);
        expect(options).to.have.property('createBottomPlane', true);
        options = getClippingOptions(feature, true);
        expect(options).to.have.property('createBottomPlane', true);
      });

      it('should create vertical planes if not infinite', () => {
        let options = getClippingOptions(feature);
        expect(options).to.have.property('createVerticalPlanes', true);
        options = getClippingOptions(feature, true);
        expect(options).to.have.property('createVerticalPlanes', false);
      });
    });

    describe('line', () => {
      beforeEach(() => {
        feature = new Feature({ geometry: new LineString([]) });
      });

      it('should always create vertical planes', () => {
        let options = getClippingOptions(feature);
        expect(options).to.have.property('createVerticalPlanes', true);
        options = getClippingOptions(feature, true);
        expect(options).to.have.property('createVerticalPlanes', true);
      });

      it('should create bottom, top and ending planes of not infinite', () => {
        let options = getClippingOptions(feature);
        expect(options).to.have.property('createBottomPlane', true);
        expect(options).to.have.property('createTopPlane', true);
        expect(options).to.have.property('createEndingPlanes', true);
        options = getClippingOptions(feature, true);
        expect(options).to.have.property('createBottomPlane', false);
        expect(options).to.have.property('createTopPlane', false);
        expect(options).to.have.property('createEndingPlanes', false);
      });
    });
  });
});
