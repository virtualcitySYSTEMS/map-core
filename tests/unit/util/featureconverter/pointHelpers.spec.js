import nock from 'nock';
import Feature from 'ol/Feature.js';
import Style from 'ol/style/Style.js';
import RegularShape from 'ol/style/RegularShape.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Icon from 'ol/style/Icon.js';
import {
  Cartesian3,
  Cartographic,
  Math as CesiumMath,
  Matrix4,
  Model,
  Primitive,
  SphereGeometry,
  SphereOutlineGeometry,
} from '@vcmap-cesium/engine';
import VectorProperties, {
  PrimitiveOptionsType,
} from '../../../../src/layer/vectorProperties.js';
import {
  getModelOptions,
  getPrimitiveOptions,
} from '../../../../src/util/featureconverter/pointHelpers.js';
import { getTerrainProvider } from '../../helpers/terrain/terrainData.js';
import { getMockScene } from '../../helpers/cesiumHelpers.js';

describe('point helpers', () => {
  after(() => {
    nock.cleanAll();
  });

  describe('getModelOptions', () => {
    let feature;
    let positions;
    let vectorProperties;
    let model;
    let scene;

    before(() => {
      const scope = nock('http://localhost');
      scope
        .get('/test.glb')
        .reply(200, {}, { 'Content-Type': 'application/json' });
      feature = new Feature({
        olcs_modelUrl: 'http://localhost/test.glb',
        olcs_allowPicking: false,
      });
      const coordinates = [[1, 1, 2]];
      scene = getMockScene();
      positions = coordinates.map((pos) => Cartesian3.fromDegrees(...pos));
      vectorProperties = new VectorProperties({
        modelScaleX: 2,
        modelScaleY: 4,
        modelScaleZ: 8,
      });
      [model] = getModelOptions(
        feature,
        coordinates,
        positions,
        vectorProperties,
        scene,
      ).primitives;
    });

    after(() => {
      scene.destroy();
      nock.cleanAll();
      vectorProperties.destroy();
    });

    it('should create a model with the feature modelUrl', () => {
      expect(model).to.be.an.instanceOf(Model);
    });

    it('should apply allow picking', () => {
      expect(model.allowPicking).to.be.false;
    });

    it('should apply the scale to the models matrix', () => {
      const scale = Matrix4.getScale(model.modelMatrix, new Cartesian3());
      expect(scale.x).to.closeTo(2, CesiumMath.EPSILON8);
      expect(scale.y).to.closeTo(4, CesiumMath.EPSILON8);
      expect(scale.z).to.closeTo(8, CesiumMath.EPSILON8);
    });

    it('should set a 2D point onto the terrain', (done) => {
      const scene2 = getMockScene();
      const scope = nock('http://localhost');
      scope
        .get('/test.glb')
        .reply(200, {}, { 'Content-Type': 'application/json' });
      scene2.globe.terrainProvider = getTerrainProvider(scope);
      const twoD = [[13.374517914005413, 52.501750770534045, 0]];
      const [twoDModel] = getModelOptions(
        feature,
        twoD,
        twoD.map((pos) => Cartesian3.fromDegrees(...pos)),
        vectorProperties,
        scene2,
      ).primitives;
      const { modelMatrix } = twoDModel;
      const cartographicBefore = Cartographic.fromCartesian(
        Matrix4.getTranslation(modelMatrix, new Cartesian3()),
      );
      expect(cartographicBefore.height).to.equal(0);
      setTimeout(() => {
        const cartographicAfter = Cartographic.fromCartesian(
          Matrix4.getTranslation(twoDModel.modelMatrix, new Cartesian3()),
        );

        expect(cartographicAfter.height).to.not.equal(0);
        done();
      }, 200);
    });

    describe('of a scaled autoScale model', () => {
      let autoscaleVectorProperties;
      let autoscaleModel;

      before(() => {
        const coordinates = [[1, 1, 2]];
        positions = coordinates.map((pos) => Cartesian3.fromDegrees(...pos));
        autoscaleVectorProperties = new VectorProperties({
          modelScaleX: 2,
          modelScaleY: 4,
          modelScaleZ: 8,
          modelAutoScale: true,
        });

        [autoscaleModel] = getModelOptions(
          feature,
          coordinates,
          positions,
          autoscaleVectorProperties,
          scene,
        ).primitives;
      });

      after(() => {
        autoscaleVectorProperties.destroy();
      });

      it('should create a model', () => {
        expect(autoscaleModel).to.be.an.instanceOf(Model);
      });

      it('should apply the scale to the models model matrix', () => {
        const scale = Matrix4.getScale(
          autoscaleModel.modelMatrix,
          new Cartesian3(),
        );
        expect(scale.x).to.closeTo(2, CesiumMath.EPSILON8);
        expect(scale.y).to.closeTo(4, CesiumMath.EPSILON8);
        expect(scale.z).to.closeTo(8, CesiumMath.EPSILON8);
      });

      it('should reset the scale, if setting a new modelMatrix', () => {
        const modelMatrix = autoscaleModel.modelMatrix.clone();
        autoscaleModel.modelMatrix = Matrix4.setScale(
          modelMatrix,
          new Cartesian3(2, 2, 2),
          new Matrix4(),
        );
        const scale = Matrix4.getScale(
          autoscaleModel.modelMatrix,
          new Cartesian3(),
        );
        expect(scale.x).to.closeTo(4, CesiumMath.EPSILON8);
        expect(scale.y).to.closeTo(8, CesiumMath.EPSILON8);
        expect(scale.z).to.closeTo(16, CesiumMath.EPSILON8);
        autoscaleModel.modelMatrix = Matrix4.setScale(
          modelMatrix,
          Cartesian3.ONE,
          new Matrix4(),
        );
        Matrix4.getScale(autoscaleModel.modelMatrix, scale);
        expect(scale.x).to.closeTo(2, CesiumMath.EPSILON8);
        expect(scale.y).to.closeTo(4, CesiumMath.EPSILON8);
        expect(scale.z).to.closeTo(8, CesiumMath.EPSILON8);
      });
    });
  });

  describe('getPrimitiveOptions', () => {
    describe('of a normal primitive', () => {
      let feature;
      let positions;
      let vectorProperties;
      let primitive;
      let scene;

      before(() => {
        feature = new Feature({
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
          },
          olcs_allowPicking: false,
        });
        const coordinates = [[1, 1, 2]];
        scene = getMockScene();
        positions = coordinates.map((pos) => Cartesian3.fromDegrees(...pos));
        vectorProperties = new VectorProperties({
          modelScaleX: 2,
          modelScaleY: 4,
          modelScaleZ: 8,
        });
        const style = new Style({
          image: new RegularShape({
            fill: new Fill({ color: '#FF00FF' }),
          }),
        });
        [primitive] = getPrimitiveOptions(
          feature,
          style,
          coordinates,
          positions,
          vectorProperties,
          scene,
        ).primitives;
      });

      after(() => {
        scene.destroy();
        nock.cleanAll();
        vectorProperties.destroy();
      });

      it('should create a primitive', () => {
        expect(primitive).to.be.an.instanceOf(Primitive);
        expect(primitive.geometryInstances[0].geometry).to.be.an.instanceOf(
          SphereGeometry,
        );
      });

      it('should apply allow picking', () => {
        expect(primitive.allowPicking).to.be.false;
      });

      it('should apply the scale to the primitives matrix', () => {
        const scale = Matrix4.getScale(primitive.modelMatrix, new Cartesian3());
        expect(scale.x).to.closeTo(2, CesiumMath.EPSILON8);
        expect(scale.y).to.closeTo(4, CesiumMath.EPSILON8);
        expect(scale.z).to.closeTo(8, CesiumMath.EPSILON8);
      });
    });

    describe('of an elevation less primitive', () => {
      it('should set a 2D point onto the terrain', (done) => {
        const vectorProperties = new VectorProperties({
          modelScaleX: 2,
          modelScaleY: 4,
          modelScaleZ: 8,
        });
        const style = new Style({
          image: new RegularShape({
            fill: new Fill({ color: '#FF00FF' }),
          }),
        });
        const scene2 = getMockScene();
        const scope = nock('http://localhost');
        scene2.globe.terrainProvider = getTerrainProvider(scope);
        const twoD = [[13.374517914005413, 52.501750770534045, 0]];
        const feature = new Feature({
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
          },
          olcs_allowPicking: false,
        });
        const [primitive] = getPrimitiveOptions(
          feature,
          style,
          twoD,
          twoD.map((pos) => Cartesian3.fromDegrees(...pos)),
          vectorProperties,
          scene2,
        ).primitives;
        vectorProperties.destroy();
        const { modelMatrix } = primitive;
        const cartographicBefore = Cartographic.fromCartesian(
          Matrix4.getTranslation(modelMatrix, new Cartesian3()),
        );
        expect(cartographicBefore.height).to.equal(0);
        setTimeout(() => {
          const cartographicAfter = Cartographic.fromCartesian(
            Matrix4.getTranslation(primitive.modelMatrix, new Cartesian3()),
          );

          expect(cartographicAfter.height).to.not.equal(0);
          done();
        }, 200);
      });
    });

    describe('of an outlined primitive', () => {
      let feature;
      let positions;
      let vectorProperties;
      let primitive;
      let outline;
      let scene;

      before(() => {
        feature = new Feature({
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
          },
          olcs_allowPicking: false,
        });
        const coordinates = [[1, 1, 2]];
        scene = getMockScene();
        positions = coordinates.map((pos) => Cartesian3.fromDegrees(...pos));
        vectorProperties = new VectorProperties({
          modelScaleX: 2,
          modelScaleY: 4,
          modelScaleZ: 8,
        });
        const style = new Style({
          image: new RegularShape({
            fill: new Fill({ color: '#FF00FF' }),
            stroke: new Stroke({ color: '#FF00FF', width: 1 }),
          }),
        });
        [primitive, outline] = getPrimitiveOptions(
          feature,
          style,
          coordinates,
          positions,
          vectorProperties,
          scene,
        ).primitives;
      });

      after(() => {
        scene.destroy();
        nock.cleanAll();
        vectorProperties.destroy();
      });

      it('should create a primitive', () => {
        expect(primitive).to.be.an.instanceOf(Primitive);
        expect(primitive.geometryInstances[0].geometry).to.be.an.instanceOf(
          SphereGeometry,
        );
      });

      it('should create an outline primitive', () => {
        expect(outline).to.be.an.instanceOf(Primitive);
        expect(outline.geometryInstances[0].geometry).to.be.an.instanceOf(
          SphereOutlineGeometry,
        );
      });

      it('should apply allow picking', () => {
        expect(primitive.allowPicking).to.be.false;
      });

      it('should apply allow picking on the outline', () => {
        expect(outline.allowPicking).to.be.false;
      });

      it('should apply the scale to the primitive matrix', () => {
        const scale = Matrix4.getScale(primitive.modelMatrix, new Cartesian3());
        expect(scale.x).to.closeTo(2, CesiumMath.EPSILON8);
        expect(scale.y).to.closeTo(4, CesiumMath.EPSILON8);
        expect(scale.z).to.closeTo(8, CesiumMath.EPSILON8);
      });

      it('should apply the scale to the outline matrix', () => {
        const scale = Matrix4.getScale(outline.modelMatrix, new Cartesian3());
        expect(scale.x).to.closeTo(2, CesiumMath.EPSILON8);
        expect(scale.y).to.closeTo(4, CesiumMath.EPSILON8);
        expect(scale.z).to.closeTo(8, CesiumMath.EPSILON8);
      });
    });

    describe('of an only outlined primitive', () => {
      let feature;
      let positions;
      let vectorProperties;
      let outline;
      let scene;

      before(() => {
        feature = new Feature({
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
          },
          olcs_allowPicking: false,
        });
        const coordinates = [[1, 1, 2]];
        scene = getMockScene();
        positions = coordinates.map((pos) => Cartesian3.fromDegrees(...pos));
        vectorProperties = new VectorProperties({
          modelScaleX: 2,
          modelScaleY: 4,
          modelScaleZ: 8,
        });
        const style = new Style({
          image: new RegularShape({
            stroke: new Stroke({ color: '#FF00FF', width: 1 }),
          }),
        });
        [outline] = getPrimitiveOptions(
          feature,
          style,
          coordinates,
          positions,
          vectorProperties,
          scene,
        ).primitives;
      });

      after(() => {
        scene.destroy();
        nock.cleanAll();
        vectorProperties.destroy();
      });

      it('should create an outline primitive', () => {
        expect(outline).to.be.an.instanceOf(Primitive);
        expect(outline.geometryInstances[0].geometry).to.be.an.instanceOf(
          SphereOutlineGeometry,
        );
      });

      it('should apply allow picking', () => {
        expect(outline.allowPicking).to.be.false;
      });

      it('should apply the scale to the outline matrix', () => {
        const scale = Matrix4.getScale(outline.modelMatrix, new Cartesian3());
        expect(scale.x).to.closeTo(2, CesiumMath.EPSILON8);
        expect(scale.y).to.closeTo(4, CesiumMath.EPSILON8);
        expect(scale.z).to.closeTo(8, CesiumMath.EPSILON8);
      });
    });

    describe('of an only outlined primitive with a depthFailColor', () => {
      let feature;
      let positions;
      let vectorProperties;
      let outline;
      let primitive;
      let scene;

      before(() => {
        feature = new Feature({
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
            depthFailColor: '#FF00FF',
          },
          olcs_allowPicking: false,
        });
        const coordinates = [[1, 1, 2]];
        scene = getMockScene();
        positions = coordinates.map((pos) => Cartesian3.fromDegrees(...pos));
        vectorProperties = new VectorProperties({
          modelScaleX: 2,
          modelScaleY: 4,
          modelScaleZ: 8,
        });
        const style = new Style({
          image: new RegularShape({
            stroke: new Stroke({ color: '#FF00FF', width: 1 }),
          }),
        });
        [primitive, outline] = getPrimitiveOptions(
          feature,
          style,
          coordinates,
          positions,
          vectorProperties,
          scene,
        ).primitives;
      });

      after(() => {
        scene.destroy();
        nock.cleanAll();
        vectorProperties.destroy();
      });

      it('should create a primitive', () => {
        expect(primitive).to.be.an.instanceOf(Primitive);
        expect(primitive.geometryInstances[0].geometry).to.be.an.instanceOf(
          SphereGeometry,
        );
      });

      it('should create an outline primitive', () => {
        expect(outline).to.be.an.instanceOf(Primitive);
        expect(outline.geometryInstances[0].geometry).to.be.an.instanceOf(
          SphereOutlineGeometry,
        );
      });

      it('should apply allow picking', () => {
        expect(primitive.allowPicking).to.be.false;
      });

      it('should apply allow picking on the outline', () => {
        expect(outline.allowPicking).to.be.false;
      });

      it('should apply the scale to the primitive matrix', () => {
        const scale = Matrix4.getScale(primitive.modelMatrix, new Cartesian3());
        expect(scale.x).to.closeTo(2, CesiumMath.EPSILON8);
        expect(scale.y).to.closeTo(4, CesiumMath.EPSILON8);
        expect(scale.z).to.closeTo(8, CesiumMath.EPSILON8);
      });

      it('should apply the scale to the outline matrix', () => {
        const scale = Matrix4.getScale(outline.modelMatrix, new Cartesian3());
        expect(scale.x).to.closeTo(2, CesiumMath.EPSILON8);
        expect(scale.y).to.closeTo(4, CesiumMath.EPSILON8);
        expect(scale.z).to.closeTo(8, CesiumMath.EPSILON8);
      });
    });

    describe('of an icon primitive', () => {
      let feature;
      let positions;
      let vectorProperties;
      let primitive;
      let scene;

      before(() => {
        feature = new Feature({
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
          },
          olcs_allowPicking: false,
        });
        const coordinates = [[1, 1, 2]];
        scene = getMockScene();
        positions = coordinates.map((pos) => Cartesian3.fromDegrees(...pos));
        vectorProperties = new VectorProperties({
          modelScaleX: 2,
          modelScaleY: 4,
          modelScaleZ: 8,
        });
        const style = new Style({
          fill: new Fill({ color: '#FF00FF' }),
          image: new Icon({
            src: '/icon.png',
          }),
        });
        [primitive] = getPrimitiveOptions(
          feature,
          style,
          coordinates,
          positions,
          vectorProperties,
          scene,
        ).primitives;
      });

      after(() => {
        scene.destroy();
        nock.cleanAll();
        vectorProperties.destroy();
      });

      it('should create a primitive', () => {
        expect(primitive).to.be.an.instanceOf(Primitive);
        expect(primitive.geometryInstances[0].geometry).to.be.an.instanceOf(
          SphereGeometry,
        );
      });

      it('should apply allow picking', () => {
        expect(primitive.allowPicking).to.be.false;
      });

      it('should apply the scale to the primitives matrix', () => {
        const scale = Matrix4.getScale(primitive.modelMatrix, new Cartesian3());
        expect(scale.x).to.closeTo(2, CesiumMath.EPSILON8);
        expect(scale.y).to.closeTo(4, CesiumMath.EPSILON8);
        expect(scale.z).to.closeTo(8, CesiumMath.EPSILON8);
      });
    });

    describe('of an offset primitive', () => {
      let feature;
      let positions;
      let vectorProperties;
      let primitive;
      let scene;

      before(() => {
        feature = new Feature({
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
            offset: [0, 0, 1],
          },
          olcs_allowPicking: false,
        });
        const coordinates = [[1, 1, 2]];
        scene = getMockScene();
        positions = coordinates.map((pos) => Cartesian3.fromDegrees(...pos));
        vectorProperties = new VectorProperties({
          modelScaleX: 2,
          modelScaleY: 4,
          modelScaleZ: 8,
        });
        const style = new Style({
          image: new RegularShape({
            fill: new Fill({ color: '#FF00FF' }),
          }),
        });
        [primitive] = getPrimitiveOptions(
          feature,
          style,
          coordinates,
          positions,
          vectorProperties,
          scene,
        ).primitives;
      });

      after(() => {
        scene.destroy();
        nock.cleanAll();
        vectorProperties.destroy();
      });

      it('should create a primitive', () => {
        expect(primitive).to.be.an.instanceOf(Primitive);
        expect(primitive.geometryInstances[0].geometry).to.be.an.instanceOf(
          SphereGeometry,
        );
      });

      it('should apply allow picking', () => {
        expect(primitive.allowPicking).to.be.false;
      });

      it('should apply the scale to the primitives matrix', () => {
        const scale = Matrix4.getScale(primitive.modelMatrix, new Cartesian3());
        expect(scale.x).to.closeTo(2, CesiumMath.EPSILON8);
        expect(scale.y).to.closeTo(4, CesiumMath.EPSILON8);
        expect(scale.z).to.closeTo(8, CesiumMath.EPSILON8);
      });

      it('should apply the offset, scaled', () => {
        const translation = Matrix4.getTranslation(
          primitive.modelMatrix,
          new Cartesian3(),
        );
        const carto = Cartographic.fromCartesian(translation);
        expect(carto.height).to.closeTo(10, CesiumMath.EPSILON5);
      });
    });

    describe('of an offset auto scale primitive', () => {
      let feature;
      let positions;
      let vectorProperties;
      let primitive;
      let scene;

      before(() => {
        feature = new Feature({
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
            offset: [0, 0, 1],
          },
          olcs_modelAutoScale: true,
          olcs_allowPicking: false,
        });
        const coordinates = [[1, 1, 2]];
        scene = getMockScene();
        positions = coordinates.map((pos) => Cartesian3.fromDegrees(...pos));
        vectorProperties = new VectorProperties({});
        const style = new Style({
          image: new RegularShape({
            fill: new Fill({ color: '#FF00FF' }),
          }),
        });
        [primitive] = getPrimitiveOptions(
          feature,
          style,
          coordinates,
          positions,
          vectorProperties,
          scene,
        ).primitives;
      });

      after(() => {
        scene.destroy();
        nock.cleanAll();
        vectorProperties.destroy();
      });

      it('should create a primitive', () => {
        expect(primitive).to.be.an.instanceOf(Primitive);
        expect(primitive.geometryInstances[0].geometry).to.be.an.instanceOf(
          SphereGeometry,
        );
      });

      it('should apply allow picking', () => {
        expect(primitive.allowPicking).to.be.false;
      });

      it('should apply the offset, scaled', () => {
        const translation = Matrix4.getTranslation(
          primitive.modelMatrix,
          new Cartesian3(),
        );
        const carto = Cartographic.fromCartesian(translation);
        expect(carto.height).to.closeTo(3, CesiumMath.EPSILON5);
      });

      it('should reset the offset, if setting a new modelMatrix', () => {
        const modelMatrix = primitive.modelMatrix.clone();
        primitive.modelMatrix = Matrix4.setScale(
          modelMatrix,
          new Cartesian3(2, 2, 2),
          new Matrix4(),
        );
        const translation = Matrix4.getTranslation(
          primitive.modelMatrix,
          new Cartesian3(),
        );
        expect(Cartographic.fromCartesian(translation).height).to.closeTo(
          4,
          CesiumMath.EPSILON5,
        );
        primitive.modelMatrix = modelMatrix;
        Matrix4.getTranslation(primitive.modelMatrix, translation);
        expect(Cartographic.fromCartesian(translation).height).to.closeTo(
          3,
          CesiumMath.EPSILON5,
        );
      });
    });

    describe('of a scaled auto scale primitive', () => {
      let feature;
      let positions;
      let vectorProperties;
      let primitive;
      let scene;

      before(() => {
        feature = new Feature({
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
          },
          olcs_modelAutoScale: true,
          olcs_allowPicking: false,
        });
        const coordinates = [[1, 1, 2]];
        scene = getMockScene();
        positions = coordinates.map((pos) => Cartesian3.fromDegrees(...pos));
        vectorProperties = new VectorProperties({
          modelScaleX: 2,
          modelScaleY: 4,
          modelScaleZ: 8,
        });
        const style = new Style({
          image: new RegularShape({
            fill: new Fill({ color: '#FF00FF' }),
          }),
        });
        [primitive] = getPrimitiveOptions(
          feature,
          style,
          coordinates,
          positions,
          vectorProperties,
          scene,
        ).primitives;
      });

      after(() => {
        scene.destroy();
        nock.cleanAll();
        vectorProperties.destroy();
      });

      it('should create a primitive', () => {
        expect(primitive).to.be.an.instanceOf(Primitive);
        expect(primitive.geometryInstances[0].geometry).to.be.an.instanceOf(
          SphereGeometry,
        );
      });

      it('should apply allow picking', () => {
        expect(primitive.allowPicking).to.be.false;
      });

      it('should apply the scale to the primitives matrix', () => {
        const scale = Matrix4.getScale(primitive.modelMatrix, new Cartesian3());
        expect(scale.x).to.closeTo(2, CesiumMath.EPSILON8);
        expect(scale.y).to.closeTo(4, CesiumMath.EPSILON8);
        expect(scale.z).to.closeTo(8, CesiumMath.EPSILON8);
      });

      it('should reset the scale, if setting a new modelMatrix', () => {
        const modelMatrix = primitive.modelMatrix.clone();
        primitive.modelMatrix = Matrix4.setScale(
          modelMatrix,
          new Cartesian3(2, 2, 2),
          new Matrix4(),
        );
        const scale = Matrix4.getScale(primitive.modelMatrix, new Cartesian3());
        expect(scale.x).to.closeTo(4, CesiumMath.EPSILON8);
        expect(scale.y).to.closeTo(8, CesiumMath.EPSILON8);
        expect(scale.z).to.closeTo(16, CesiumMath.EPSILON8);
        primitive.modelMatrix = Matrix4.setScale(
          modelMatrix,
          Cartesian3.ONE,
          new Matrix4(),
        );
        Matrix4.getScale(primitive.modelMatrix, scale);
        expect(scale.x).to.closeTo(2, CesiumMath.EPSILON8);
        expect(scale.y).to.closeTo(4, CesiumMath.EPSILON8);
        expect(scale.z).to.closeTo(8, CesiumMath.EPSILON8);
      });
    });

    describe('of an offset & scaled auto scale primitive', () => {
      let feature;
      let positions;
      let vectorProperties;
      let primitive;
      let scene;

      before(() => {
        feature = new Feature({
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
            offset: [0, 0, 1],
          },
          olcs_modelAutoScale: true,
          olcs_allowPicking: false,
        });
        const coordinates = [[1, 1, 2]];
        scene = getMockScene();
        positions = coordinates.map((pos) => Cartesian3.fromDegrees(...pos));
        vectorProperties = new VectorProperties({
          modelScaleX: 2,
          modelScaleY: 4,
          modelScaleZ: 8,
        });
        const style = new Style({
          image: new RegularShape({
            fill: new Fill({ color: '#FF00FF' }),
          }),
        });
        [primitive] = getPrimitiveOptions(
          feature,
          style,
          coordinates,
          positions,
          vectorProperties,
          scene,
        ).primitives;
      });

      after(() => {
        scene.destroy();
        nock.cleanAll();
        vectorProperties.destroy();
      });

      it('should create a primitive', () => {
        expect(primitive).to.be.an.instanceOf(Primitive);
        expect(primitive.geometryInstances[0].geometry).to.be.an.instanceOf(
          SphereGeometry,
        );
      });

      it('should apply allow picking', () => {
        expect(primitive.allowPicking).to.be.false;
      });

      it('should apply the scale to the primitives matrix', () => {
        const scale = Matrix4.getScale(primitive.modelMatrix, new Cartesian3());
        expect(scale.x).to.closeTo(2, CesiumMath.EPSILON8);
        expect(scale.y).to.closeTo(4, CesiumMath.EPSILON8);
        expect(scale.z).to.closeTo(8, CesiumMath.EPSILON8);
      });

      it('should reset the scale, if setting a new modelMatrix', () => {
        const modelMatrix = primitive.modelMatrix.clone();
        primitive.modelMatrix = Matrix4.setScale(
          modelMatrix,
          new Cartesian3(2, 2, 2),
          new Matrix4(),
        );
        const scale = Matrix4.getScale(primitive.modelMatrix, new Cartesian3());
        expect(scale.x).to.closeTo(4, CesiumMath.EPSILON8);
        expect(scale.y).to.closeTo(8, CesiumMath.EPSILON8);
        expect(scale.z).to.closeTo(16, CesiumMath.EPSILON8);
        primitive.modelMatrix = Matrix4.setScale(
          modelMatrix,
          Cartesian3.ONE,
          new Matrix4(),
        );
        Matrix4.getScale(primitive.modelMatrix, scale);
        expect(scale.x).to.closeTo(2, CesiumMath.EPSILON8);
        expect(scale.y).to.closeTo(4, CesiumMath.EPSILON8);
        expect(scale.z).to.closeTo(8, CesiumMath.EPSILON8);
      });

      it('should reset the offset, if setting a new modelMatrix', () => {
        const modelMatrix = primitive.modelMatrix.clone();
        primitive.modelMatrix = Matrix4.setScale(
          modelMatrix,
          new Cartesian3(2, 2, 2),
          new Matrix4(),
        );
        const translation = Matrix4.getTranslation(
          primitive.modelMatrix,
          new Cartesian3(),
        );
        expect(Cartographic.fromCartesian(translation).height).to.closeTo(
          18,
          CesiumMath.EPSILON5,
        );
        primitive.modelMatrix = Matrix4.setScale(
          modelMatrix,
          Cartesian3.ONE,
          new Matrix4(),
        );
        Matrix4.getTranslation(primitive.modelMatrix, translation);
        expect(Cartographic.fromCartesian(translation).height).to.closeTo(
          10,
          CesiumMath.EPSILON5,
        );
      });
    });

    describe('returning null', () => {
      it('should return null, if no primitive can be created', () => {
        const feature = new Feature({
          olcs_allowPicking: false,
        });
        const coordinates = [[1, 1, 2]];
        const scene = getMockScene();
        const positions = coordinates.map((pos) =>
          Cartesian3.fromDegrees(...pos),
        );
        const vectorProperties = new VectorProperties({
          modelScaleX: 2,
          modelScaleY: 4,
          modelScaleZ: 8,
        });
        const style = new Style({
          fill: new Fill({ color: '#FF00FF' }),
          image: new Icon({
            src: '/icon.png',
          }),
        });
        const primitive = getPrimitiveOptions(
          feature,
          style,
          coordinates,
          positions,
          vectorProperties,
          scene,
        );
        vectorProperties.destroy();
        expect(primitive).to.be.null;
      });

      it('should return null, if there is no image style', () => {
        const feature = new Feature({
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
          },
          olcs_allowPicking: false,
        });
        const coordinates = [[1, 1, 2]];
        const scene = getMockScene();
        const positions = coordinates.map((pos) =>
          Cartesian3.fromDegrees(...pos),
        );
        const vectorProperties = new VectorProperties({
          modelScaleX: 2,
          modelScaleY: 4,
          modelScaleZ: 8,
        });
        const style = new Style({
          fill: new Fill({ color: '#FF00FF' }),
        });
        const primitive = getPrimitiveOptions(
          feature,
          style,
          coordinates,
          positions,
          vectorProperties,
          scene,
        );
        vectorProperties.destroy();
        expect(primitive).to.be.null;
      });
    });
  });
});
