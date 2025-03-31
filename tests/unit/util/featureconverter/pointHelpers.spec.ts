import nock from 'nock';
import Feature from 'ol/Feature.js';
import Style from 'ol/style/Style.js';
import RegularShape from 'ol/style/RegularShape.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Icon from 'ol/style/Icon.js';
import { Point } from 'ol/geom.js';
import {
  type GeometryInstance,
  Cartesian3,
  Cartographic,
  Color,
  Math as CesiumMath,
  Matrix4,
  Model,
  Primitive,
  type Scene,
  SphereGeometry,
  SphereOutlineGeometry,
} from '@vcmap-cesium/engine';
import { expect } from 'chai';
import VectorProperties, {
  PrimitiveOptionsType,
} from '../../../../src/layer/vectorProperties.js';
import {
  getModelOptions,
  getPrimitiveOptions,
} from '../../../../src/util/featureconverter/pointHelpers.js';
import { getMockScene } from '../../helpers/cesiumHelpers.js';
import { getHeightInfo, ModelFill } from '../../../../index.js';
import type { ConvertedItem } from '../../../../src/util/featureconverter/convert.js';

describe('point helpers', () => {
  after(() => {
    nock.cleanAll();
  });

  describe('getModelOptions', () => {
    let feature: Feature;
    let position: Cartesian3;
    let vectorProperties: VectorProperties;
    let model: ConvertedItem<'primitive'>;
    let scene: Scene;

    before(async () => {
      const scope = nock('http://localhost');
      scope
        .get('/test.glb')
        // eslint-disable-next-line @typescript-eslint/naming-convention
        .reply(200, {}, { 'Content-Type': 'application/json' });
      feature = new Feature({
        olcs_modelUrl: 'http://localhost/test.glb',
        olcs_allowPicking: false,
      });
      const coordinate = [1, 1, 2];
      scene = getMockScene();
      position = Cartesian3.fromDegrees(
        coordinate[0],
        coordinate[1],
        coordinate[2],
      );
      vectorProperties = new VectorProperties({
        modelScaleX: 2,
        modelScaleY: 4,
        modelScaleZ: 8,
      });

      model = (await getModelOptions(
        feature,
        position,
        coordinate,
        vectorProperties,
        scene,
        getHeightInfo(feature, new Point(coordinate), vectorProperties),
      ))!;
    });

    after(() => {
      scene.destroy();
      nock.cleanAll();
      vectorProperties.destroy();
    });

    it('should create a model with the feature modelUrl', () => {
      expect(model.item).to.be.an.instanceOf(Model);
    });

    it('should apply allow picking', () => {
      expect(model.item.allowPicking).to.be.false;
    });

    it('should apply the scale to the models matrix', () => {
      const scale = Matrix4.getScale(
        (model.item as Model).modelMatrix,
        new Cartesian3(),
      );
      expect(scale.x).to.closeTo(2, CesiumMath.EPSILON8);
      expect(scale.y).to.closeTo(4, CesiumMath.EPSILON8);
      expect(scale.z).to.closeTo(8, CesiumMath.EPSILON8);
    });

    it('should set a 2D point onto the terrain', async () => {
      const scene2 = getMockScene();
      const scope = nock('http://localhost');
      scope
        .get('/test.glb')
        // eslint-disable-next-line @typescript-eslint/naming-convention
        .reply(200, {}, { 'Content-Type': 'application/json' });
      scene2.getHeight = (): number => {
        return 33;
      };
      const twoD = [13.374517914005413, 52.501750770534045];
      const twoDModel = (await getModelOptions(
        feature,
        Cartesian3.fromDegrees(twoD[0], twoD[1]),
        [...twoD, 0],
        vectorProperties,
        scene2,
        getHeightInfo(feature, new Point(twoD), vectorProperties),
      ))!.item as Model;
      const { modelMatrix } = twoDModel;
      const cartographic = Cartographic.fromCartesian(
        Matrix4.getTranslation(modelMatrix, new Cartesian3()),
      );
      expect(cartographic.height).to.not.equal(0);
    });

    describe('of a scaled autoScale model', () => {
      let autoscaleVectorProperties: VectorProperties;
      let autoscaleModel: ConvertedItem<'primitive'>;

      before(async () => {
        const coordinate = [1, 1, 2];
        autoscaleVectorProperties = new VectorProperties({
          modelScaleX: 2,
          modelScaleY: 4,
          modelScaleZ: 8,
          modelAutoScale: true,
        });

        autoscaleModel = (await getModelOptions(
          feature,
          Cartesian3.fromDegrees(coordinate[0], coordinate[1], coordinate[2]),
          coordinate,
          autoscaleVectorProperties,
          scene,
          getHeightInfo(feature, new Point(coordinate), vectorProperties),
        ))!;
      });

      after(() => {
        autoscaleVectorProperties.destroy();
      });

      it('should create a model', () => {
        expect(autoscaleModel.item).to.be.an.instanceOf(Model);
      });

      it('should apply the scale to the models model matrix', () => {
        const scale = Matrix4.getScale(
          (autoscaleModel.item as Model).modelMatrix,
          new Cartesian3(),
        );
        expect(scale.x).to.closeTo(2, CesiumMath.EPSILON8);
        expect(scale.y).to.closeTo(4, CesiumMath.EPSILON8);
        expect(scale.z).to.closeTo(8, CesiumMath.EPSILON8);
      });

      it('should reset the scale, if setting a new modelMatrix', () => {
        const modelMatrix = (autoscaleModel.item as Model).modelMatrix.clone();
        (autoscaleModel.item as Model).modelMatrix = Matrix4.setScale(
          modelMatrix,
          new Cartesian3(2, 2, 2),
          new Matrix4(),
        );
        const scale = Matrix4.getScale(
          (autoscaleModel.item as Model).modelMatrix,
          new Cartesian3(),
        );
        expect(scale.x).to.closeTo(4, CesiumMath.EPSILON8);
        expect(scale.y).to.closeTo(8, CesiumMath.EPSILON8);
        expect(scale.z).to.closeTo(16, CesiumMath.EPSILON8);
        (autoscaleModel.item as Model).modelMatrix = Matrix4.setScale(
          modelMatrix,
          Cartesian3.ONE,
          new Matrix4(),
        );
        Matrix4.getScale((autoscaleModel.item as Model).modelMatrix, scale);
        expect(scale.x).to.closeTo(2, CesiumMath.EPSILON8);
        expect(scale.y).to.closeTo(4, CesiumMath.EPSILON8);
        expect(scale.z).to.closeTo(8, CesiumMath.EPSILON8);
      });
    });

    describe('color handling', () => {
      it('should set the color if passing a style with ModelFill', async () => {
        const filledModel = (await getModelOptions(
          feature,
          Cartesian3.ONE,
          [1, 1, 2],
          vectorProperties,
          scene,
          getHeightInfo(feature, new Point([1, 1, 2]), vectorProperties),
          new Style({
            fill: new ModelFill({ color: Color.RED.toCssColorString() }),
          }),
        ))!;

        expect(Color.equals((filledModel.item as Model).color, Color.RED)).to.be
          .true;
      });

      it('should not set the color if passing a style with a normal Fill', async () => {
        const notFilledModel = (await getModelOptions(
          feature,
          Cartesian3.ONE,
          [1, 1, 2],
          vectorProperties,
          scene,
          getHeightInfo(feature, new Point([1, 1, 2]), vectorProperties),
          new Style({
            fill: new Fill({ color: Color.RED.toCssColorString() }),
          }),
        ))!;

        expect((notFilledModel.item as Model).color).to.be.undefined;
      });
    });
  });

  describe('getPrimitiveOptions', () => {
    describe('of a normal primitive', () => {
      let feature: Feature;
      let position: Cartesian3;
      let vectorProperties: VectorProperties;
      let primitive: Primitive;
      let scene: Scene;

      before(() => {
        feature = new Feature({
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
          },
          olcs_allowPicking: false,
        });
        const coordinates = [1, 1, 2];
        scene = getMockScene();
        position = Cartesian3.fromDegrees(
          coordinates[0],
          coordinates[1],
          coordinates[2],
        );
        vectorProperties = new VectorProperties({
          modelScaleX: 2,
          modelScaleY: 4,
          modelScaleZ: 8,
        });
        const style = new Style({
          image: new RegularShape({
            fill: new Fill({ color: '#FF00FF' }),
            points: 5,
            radius: 5,
          }),
        });
        primitive = getPrimitiveOptions(
          feature,
          style,
          position,
          coordinates,
          vectorProperties,
          scene,
          getHeightInfo(feature, new Point(coordinates), vectorProperties),
        )[0].item as Primitive;
      });

      after(() => {
        scene.destroy();
        nock.cleanAll();
        vectorProperties.destroy();
      });

      it('should create a primitive', () => {
        expect(primitive).to.be.an.instanceOf(Primitive);
        expect(
          (primitive.geometryInstances as GeometryInstance[])[0].geometry,
        ).to.be.an.instanceOf(SphereGeometry);
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
      it('should set a 2D point onto the terrain', () => {
        const vectorProperties = new VectorProperties({
          modelScaleX: 2,
          modelScaleY: 4,
          modelScaleZ: 8,
        });
        const style = new Style({
          image: new RegularShape({
            fill: new Fill({ color: '#FF00FF' }),
            points: 5,
            radius: 5,
          }),
        });
        const scene2 = getMockScene();
        scene2.getHeight = (): number => 2;
        const twoD = [13.374517914005413, 52.501750770534045];
        const feature = new Feature({
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
          },
          olcs_allowPicking: false,
        });
        const primitive = getPrimitiveOptions(
          feature,
          style,
          Cartesian3.fromDegrees(twoD[0], twoD[1]),
          [...twoD, 0],
          vectorProperties,
          scene2,
          getHeightInfo(feature, new Point(twoD), vectorProperties),
        )[0].item as Primitive;
        vectorProperties.destroy();
        const { modelMatrix } = primitive;
        const cartographic = Cartographic.fromCartesian(
          Matrix4.getTranslation(modelMatrix, new Cartesian3()),
        );
        expect(cartographic.height).to.not.equal(0);
      });
    });

    describe('of an outlined primitive', () => {
      let feature: Feature;
      let vectorProperties: VectorProperties;
      let primitive: Primitive;
      let scene: Scene;
      let outline: Primitive;

      before(() => {
        feature = new Feature({
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
          },
          olcs_allowPicking: false,
        });
        const coordinates = [1, 1, 2];
        scene = getMockScene();
        const position = Cartesian3.fromDegrees(
          coordinates[0],
          coordinates[1],
          coordinates[2],
        );
        vectorProperties = new VectorProperties({
          modelScaleX: 2,
          modelScaleY: 4,
          modelScaleZ: 8,
        });
        const style = new Style({
          image: new RegularShape({
            fill: new Fill({ color: '#FF00FF' }),
            stroke: new Stroke({ color: '#FF00FF', width: 1 }),
            points: 0,
            radius: 5,
          }),
        });
        [primitive, outline] = getPrimitiveOptions(
          feature,
          style,
          position,
          coordinates,
          vectorProperties,
          scene,
          getHeightInfo(feature, new Point(coordinates), vectorProperties),
        ).map((i) => i.item as Primitive);
      });

      after(() => {
        scene.destroy();
        nock.cleanAll();
        vectorProperties.destroy();
      });

      it('should create a primitive', () => {
        expect(primitive).to.be.an.instanceOf(Primitive);
        expect(
          (primitive.geometryInstances as GeometryInstance[])[0].geometry,
        ).to.be.an.instanceOf(SphereGeometry);
      });

      it('should create an outline primitive', () => {
        expect(outline).to.be.an.instanceOf(Primitive);
        expect(
          (outline.geometryInstances as GeometryInstance[])[0].geometry,
        ).to.be.an.instanceOf(SphereOutlineGeometry);
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
      let feature: Feature;
      let vectorProperties: VectorProperties;
      let scene: Scene;
      let outline: Primitive;

      before(() => {
        feature = new Feature({
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
          },
          olcs_allowPicking: false,
        });
        const coordinates = [1, 1, 2];
        scene = getMockScene();
        const position = Cartesian3.fromDegrees(
          coordinates[0],
          coordinates[1],
          coordinates[2],
        );
        vectorProperties = new VectorProperties({
          modelScaleX: 2,
          modelScaleY: 4,
          modelScaleZ: 8,
        });
        const style = new Style({
          image: new RegularShape({
            stroke: new Stroke({ color: '#FF00FF', width: 1 }),
            points: 5,
            radius: 5,
          }),
        });
        outline = getPrimitiveOptions(
          feature,
          style,
          position,
          coordinates,
          vectorProperties,
          scene,
          getHeightInfo(feature, new Point(coordinates), vectorProperties),
        )[0].item as Primitive;
      });

      after(() => {
        scene.destroy();
        nock.cleanAll();
        vectorProperties.destroy();
      });

      it('should create an outline primitive', () => {
        expect(outline).to.be.an.instanceOf(Primitive);
        expect(
          (outline.geometryInstances as GeometryInstance[])[0].geometry,
        ).to.be.an.instanceOf(SphereOutlineGeometry);
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
      let feature: Feature;
      let vectorProperties: VectorProperties;
      let primitive: Primitive;
      let scene: Scene;
      let outline: Primitive;

      before(() => {
        feature = new Feature({
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
            depthFailColor: '#FF00FF',
          },
          olcs_allowPicking: false,
        });
        const coordinates = [1, 1, 2];
        scene = getMockScene();
        const position = Cartesian3.fromDegrees(
          coordinates[0],
          coordinates[1],
          coordinates[2],
        );
        vectorProperties = new VectorProperties({
          modelScaleX: 2,
          modelScaleY: 4,
          modelScaleZ: 8,
        });
        const style = new Style({
          image: new RegularShape({
            stroke: new Stroke({ color: '#FF00FF', width: 1 }),
            points: 5,
            radius: 5,
          }),
        });
        [primitive, outline] = getPrimitiveOptions(
          feature,
          style,
          position,
          coordinates,
          vectorProperties,
          scene,
          getHeightInfo(feature, new Point(coordinates), vectorProperties),
        ).map((i) => i.item as Primitive);
      });

      after(() => {
        scene.destroy();
        nock.cleanAll();
        vectorProperties.destroy();
      });

      it('should create a primitive', () => {
        expect(primitive).to.be.an.instanceOf(Primitive);
        expect(
          (primitive.geometryInstances as GeometryInstance[])[0].geometry,
        ).to.be.an.instanceOf(SphereGeometry);
      });

      it('should create an outline primitive', () => {
        expect(outline).to.be.an.instanceOf(Primitive);
        expect(
          (outline.geometryInstances as GeometryInstance[])[0].geometry,
        ).to.be.an.instanceOf(SphereOutlineGeometry);
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
      let feature: Feature;
      let vectorProperties: VectorProperties;
      let primitive: Primitive;
      let scene: Scene;

      before(() => {
        feature = new Feature({
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
          },
          olcs_allowPicking: false,
        });
        const coordinates = [1, 1, 2];
        scene = getMockScene();
        const position = Cartesian3.fromDegrees(
          coordinates[0],
          coordinates[1],
          coordinates[2],
        );
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
        primitive = getPrimitiveOptions(
          feature,
          style,
          position,
          coordinates,
          vectorProperties,
          scene,
          getHeightInfo(feature, new Point(coordinates), vectorProperties),
        )[0].item as Primitive;
      });

      after(() => {
        scene.destroy();
        nock.cleanAll();
        vectorProperties.destroy();
      });

      it('should create a primitive', () => {
        expect(primitive).to.be.an.instanceOf(Primitive);
        expect(
          (primitive.geometryInstances as GeometryInstance[])[0].geometry,
        ).to.be.an.instanceOf(SphereGeometry);
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
      let feature: Feature;
      let vectorProperties: VectorProperties;
      let primitive: Primitive;
      let scene: Scene;

      before(() => {
        feature = new Feature({
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
            offset: [0, 0, 1],
          },
          olcs_allowPicking: false,
        });
        const coordinates = [1, 1, 2];
        scene = getMockScene();
        const position = Cartesian3.fromDegrees(
          coordinates[0],
          coordinates[1],
          coordinates[2],
        );
        vectorProperties = new VectorProperties({
          modelScaleX: 2,
          modelScaleY: 4,
          modelScaleZ: 8,
        });
        const style = new Style({
          image: new RegularShape({
            fill: new Fill({ color: '#FF00FF' }),
            points: 5,
            radius: 5,
          }),
        });
        primitive = getPrimitiveOptions(
          feature,
          style,
          position,
          coordinates,
          vectorProperties,
          scene,
          getHeightInfo(feature, new Point(coordinates), vectorProperties),
        )[0].item as Primitive;
      });

      after(() => {
        scene.destroy();
        nock.cleanAll();
        vectorProperties.destroy();
      });

      it('should create a primitive', () => {
        expect(primitive).to.be.an.instanceOf(Primitive);
        expect(
          (primitive.geometryInstances as GeometryInstance[])[0].geometry,
        ).to.be.an.instanceOf(SphereGeometry);
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
      let feature: Feature;
      let vectorProperties: VectorProperties;
      let primitive: Primitive;
      let scene: Scene;

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
        const coordinates = [1, 1, 2];
        scene = getMockScene();
        const position = Cartesian3.fromDegrees(
          coordinates[0],
          coordinates[1],
          coordinates[2],
        );
        vectorProperties = new VectorProperties({});
        const style = new Style({
          image: new RegularShape({
            fill: new Fill({ color: '#FF00FF' }),
            points: 5,
            radius: 5,
          }),
        });
        primitive = getPrimitiveOptions(
          feature,
          style,
          position,
          coordinates,
          vectorProperties,
          scene,
          getHeightInfo(feature, new Point(coordinates), vectorProperties),
        )[0].item as Primitive;
      });

      after(() => {
        scene.destroy();
        nock.cleanAll();
        vectorProperties.destroy();
      });

      it('should create a primitive', () => {
        expect(primitive).to.be.an.instanceOf(Primitive);
        expect(
          (primitive.geometryInstances as GeometryInstance[])[0].geometry,
        ).to.be.an.instanceOf(SphereGeometry);
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
      let feature: Feature;
      let vectorProperties: VectorProperties;
      let primitive: Primitive;
      let scene: Scene;

      before(() => {
        feature = new Feature({
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
          },
          olcs_modelAutoScale: true,
          olcs_allowPicking: false,
        });
        const coordinates = [1, 1, 2];
        scene = getMockScene();
        const position = Cartesian3.fromDegrees(
          coordinates[0],
          coordinates[1],
          coordinates[2],
        );
        vectorProperties = new VectorProperties({
          modelScaleX: 2,
          modelScaleY: 4,
          modelScaleZ: 8,
        });
        const style = new Style({
          image: new RegularShape({
            fill: new Fill({ color: '#FF00FF' }),
            points: 5,
            radius: 5,
          }),
        });
        primitive = getPrimitiveOptions(
          feature,
          style,
          position,
          coordinates,
          vectorProperties,
          scene,
          getHeightInfo(feature, new Point(coordinates), vectorProperties),
        )[0].item as Primitive;
      });

      after(() => {
        scene.destroy();
        nock.cleanAll();
        vectorProperties.destroy();
      });

      it('should create a primitive', () => {
        expect(primitive).to.be.an.instanceOf(Primitive);
        expect(
          (primitive.geometryInstances as GeometryInstance[])[0].geometry,
        ).to.be.an.instanceOf(SphereGeometry);
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
      let feature: Feature;
      let vectorProperties: VectorProperties;
      let primitive: Primitive;
      let scene: Scene;

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
        const coordinates = [1, 1, 2];
        scene = getMockScene();
        const position = Cartesian3.fromDegrees(
          coordinates[0],
          coordinates[1],
          coordinates[2],
        );
        vectorProperties = new VectorProperties({
          modelScaleX: 2,
          modelScaleY: 4,
          modelScaleZ: 8,
        });
        const style = new Style({
          image: new RegularShape({
            fill: new Fill({ color: '#FF00FF' }),
            points: 5,
            radius: 5,
          }),
        });
        primitive = getPrimitiveOptions(
          feature,
          style,
          position,
          coordinates,
          vectorProperties,
          scene,
          getHeightInfo(feature, new Point(coordinates), vectorProperties),
        )[0].item as Primitive;
      });

      after(() => {
        scene.destroy();
        nock.cleanAll();
        vectorProperties.destroy();
      });

      it('should create a primitive', () => {
        expect(primitive).to.be.an.instanceOf(Primitive);
        expect(
          (primitive.geometryInstances as GeometryInstance[])[0].geometry,
        ).to.be.an.instanceOf(SphereGeometry);
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

    describe('returning an empty array', () => {
      it('should return null, if no primitive can be created', () => {
        const feature = new Feature({
          olcs_allowPicking: false,
        });
        const coordinates = [1, 1, 2];
        const scene = getMockScene();
        const position = Cartesian3.fromDegrees(
          coordinates[0],
          coordinates[1],
          coordinates[2],
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
          position,
          coordinates,
          vectorProperties,
          scene,
          getHeightInfo(feature, new Point(coordinates), vectorProperties),
        );
        vectorProperties.destroy();
        expect(primitive).to.be.empty;
      });

      it('should return null, if there is no image style', () => {
        const feature = new Feature({
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
          },
          olcs_allowPicking: false,
        });
        const coordinates = [1, 1, 2];
        const scene = getMockScene();
        const position = Cartesian3.fromDegrees(
          coordinates[0],
          coordinates[1],
          coordinates[2],
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
          position,
          coordinates,
          vectorProperties,
          scene,
          getHeightInfo(feature, new Point(coordinates), vectorProperties),
        );
        vectorProperties.destroy();
        expect(primitive).to.be.empty;
      });
    });
  });
});
