import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import LineString from 'ol/geom/LineString.js';
import {
  ClassificationType,
  Primitive,
  ClassificationPrimitive,
  HeightReference,
  GroundPrimitive,
  Color,
  PerInstanceColorAppearance,
  GroundPolylinePrimitive,
  PolylineMaterialAppearance,
} from '@vcmap-cesium/engine';
import Fill from 'ol/style/Fill.js';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import {
  createClassificationPrimitive,
  createLinePrimitive,
  createOutlinePrimitive,
  createPrimitive,
  getHeightAboveGround,
  getHeightInfo,
  getMaterialAppearance,
  getMinHeightOrGroundLevel,
  getStoreyHeights,
  validateStoreys,
} from '../../../../src/util/featureconverter/featureconverterHelper.js';
import VectorProperties from '../../../../src/layer/vectorProperties.js';
import { getMockScene } from '../../helpers/cesiumHelpers.js';

describe('util.featureconverter.vectorLayerHelper', () => {
  describe('getMaterialAppearance', () => {
    let testScene;
    let testFill;
    let testFeature;

    before(() => {
      testFeature = new Feature({
        geometry: new Polygon([
          [
            [0, 0, 0],
            [1, 0, 0],
            [1, 1, 0],
          ],
        ]),
      });
      testScene = getMockScene();
    });

    beforeEach(() => {
      testFill = new Fill({
        color: [0, 0, 0, 1],
      });
    });

    it('should set flat to true', () => {
      const testMaterial = getMaterialAppearance(
        testScene,
        testFill,
        testFeature,
      );
      expect(testMaterial).to.have.property('flat', true);
    });

    it('should set translucent to false for fully opaque fills', () => {
      const testMaterial = getMaterialAppearance(
        testScene,
        testFill,
        testFeature,
      );
      expect(testMaterial).to.have.property('translucent', false);
    });

    it('should set translucent to true for transparent fills', () => {
      testFill.setColor([0, 0, 0, 0.5]);
      const testMaterial = getMaterialAppearance(
        testScene,
        testFill,
        testFeature,
      );
      expect(testMaterial).to.have.property('translucent', true);
    });

    it('should set depthTest to true', () => {
      const testMaterial = getMaterialAppearance(
        testScene,
        testFill,
        testFeature,
      );
      expect(testMaterial.renderState.depthTest).to.have.property(
        'enabled',
        true,
      );
    });

    it('should create a color material', () => {
      const testMaterial = getMaterialAppearance(
        testScene,
        testFill,
        testFeature,
      );
      expect(testMaterial.material).to.have.property('type', 'Color');
    });
  });

  describe('createClassificationPrimitive', () => {
    let test;

    before(() => {
      test = createClassificationPrimitive(
        {},
        [],
        Color.RED,
        ClassificationType.TERRAIN,
      );
    });

    after(() => {
      test.destroy();
    });

    it('should return a classificationPrimitive', () => {
      expect(test).to.be.an.instanceof(ClassificationPrimitive);
    });

    describe('appearance', () => {
      it('should create a PerInstanceColorAppearance', () => {
        expect(test.appearance).to.be.an.instanceOf(PerInstanceColorAppearance);
      });

      it('should set flat to false', () => {
        expect(test.appearance).to.have.property('flat', false);
      });

      it('should set lineWidth to 1', () => {
        expect(test.appearance.renderState).to.have.property('lineWidth', 1);
      });

      it('should set translucent to false if the color is opaque', () => {
        expect(test.appearance).to.have.property('translucent', false);
      });

      it('should set translucent to true, if the color is translucent', () => {
        test.destroy();
        test = createClassificationPrimitive(
          {},
          [],
          Color.fromAlpha(Color.RED, 0.5),
          ClassificationType.TERRAIN,
        );
        expect(test.appearance).to.have.property('translucent', true);
      });
    });

    it('should set classificationType based on the input', () => {
      expect(test).to.have.property(
        'classificationType',
        ClassificationType.TERRAIN,
      );
      test.destroy();
      test = createClassificationPrimitive(
        {},
        [],
        Color.RED,
        ClassificationType.BOTH,
      );
      expect(test).to.have.property(
        'classificationType',
        ClassificationType.BOTH,
      );
    });
  });

  describe('createPrimitive', () => {
    let feature;
    let scene;
    let geometries;
    let style;
    let vectorProperties;

    before(() => {
      scene = getMockScene();
      geometries = [];
      style = new Style({ fill: new Fill({ color: '#3399CC' }) });
      vectorProperties = new VectorProperties({});
    });

    beforeEach(() => {
      feature = new Feature({
        geometry: new Polygon([
          [
            [0, 0, 0],
            [1, 0, 0],
            [1, 1, 0],
          ],
        ]),
      });
    });

    after(() => {
      vectorProperties.destroy();
    });

    it('should create a ClassificationPrimitive for classified features which are not ground primitives', () => {
      feature.set('olcs_classificationType', 'both');
      const primitive = createPrimitive(
        scene,
        vectorProperties,
        true,
        feature,
        geometries,
        style,
        false,
      );
      expect(primitive).to.be.an.instanceOf(ClassificationPrimitive);
      primitive.destroy();
    });

    it('should create GroundPrimitives for classified ground primitives, setting their classification type', () => {
      feature.set('olcs_classificationType', 'both');
      const primitive = createPrimitive(
        scene,
        vectorProperties,
        true,
        feature,
        geometries,
        style,
        true,
      );
      expect(primitive).to.be.an.instanceOf(GroundPrimitive);
      expect(primitive.classificationType).to.equal(ClassificationType.BOTH);
      primitive.destroy();
    });

    it('should create a Primitive for non-ground, non-classification features', () => {
      const primitive = createPrimitive(
        scene,
        vectorProperties,
        true,
        feature,
        geometries,
        style,
        false,
      );
      expect(primitive).to.be.an.instanceOf(Primitive);
      primitive.destroy();
    });

    it('should create a Primitive for non-classification ground features, defaulting to terrain only classification.', () => {
      const primitive = createPrimitive(
        scene,
        vectorProperties,
        true,
        feature,
        geometries,
        style,
        true,
      );
      expect(primitive).to.be.an.instanceOf(GroundPrimitive);
      expect(primitive.classificationType).to.equal(ClassificationType.TERRAIN);
      primitive.destroy();
    });

    it('should set allowPicking based on the input', () => {
      let primitive = createPrimitive(
        scene,
        vectorProperties,
        false,
        feature,
        geometries,
        style,
        false,
      );
      expect(primitive.allowPicking).to.be.false;
      primitive.destroy();
      primitive = createPrimitive(
        scene,
        vectorProperties,
        true,
        feature,
        geometries,
        style,
        false,
      );
      expect(primitive.allowPicking).to.be.true;
      primitive.destroy();
    });
  });

  describe('createOutlinePrimitive', () => {
    let scene;
    let vectorProperties;
    let feature;
    let geometries;
    let style;

    before(() => {
      scene = getMockScene();
      geometries = [];
      vectorProperties = new VectorProperties({});
    });

    beforeEach(() => {
      feature = new Feature({
        geometry: new LineString([
          [1, 1, 0],
          [2, 2, 0],
        ]),
      });
      style = new Style({
        stroke: new Stroke({
          color: '#000000',
        }),
      });
    });

    after(() => {
      vectorProperties.destroy();
    });

    it('should return a Primitive', () => {
      const primitive = createOutlinePrimitive(
        scene,
        vectorProperties,
        true,
        feature,
        geometries,
        style,
      );
      expect(primitive).to.be.an.instanceOf(Primitive);
      primitive.destroy();
    });

    it('should set allowPicking based on input', () => {
      let primitive = createOutlinePrimitive(
        scene,
        vectorProperties,
        true,
        feature,
        geometries,
        style,
      );
      expect(primitive.allowPicking).to.be.true;
      primitive.destroy();

      primitive = createOutlinePrimitive(
        scene,
        vectorProperties,
        false,
        feature,
        geometries,
        style,
      );
      expect(primitive.allowPicking).to.be.false;
      primitive.destroy();
    });

    describe('appearance', () => {
      it('should create a PerInstanceColorAppearance', () => {
        const primitive = createOutlinePrimitive(
          scene,
          vectorProperties,
          true,
          feature,
          geometries,
          style,
        );
        expect(primitive.appearance).to.be.an.instanceOf(
          PerInstanceColorAppearance,
        );
        primitive.destroy();
      });

      it('should set translucent to false for opaque strokes', () => {
        const primitive = createOutlinePrimitive(
          scene,
          vectorProperties,
          true,
          feature,
          geometries,
          style,
        );
        expect(primitive.appearance.translucent).to.be.false;
        primitive.destroy();
      });

      it('should set translucent to false for translucent strokes', () => {
        style.getStroke().setColor([0, 0, 0, 0.5]);
        const primitive = createOutlinePrimitive(
          scene,
          vectorProperties,
          true,
          feature,
          geometries,
          style,
        );
        expect(primitive.appearance.translucent).to.be.true;
        primitive.destroy();
      });
    });
  });

  describe('createLinePrimitive', () => {
    let feature;
    let scene;
    let geometries;
    let style;
    let vectorProperties;

    before(() => {
      scene = getMockScene();
      geometries = [];
      style = new Style({ stroke: new Stroke({ color: '#3399CC' }) });
      vectorProperties = new VectorProperties({});
    });

    beforeEach(() => {
      feature = new Feature({
        geometry: new LineString([
          [0, 0, 0],
          [1, 0, 0],
          [1, 1, 0],
        ]),
      });
    });

    after(() => {
      vectorProperties.destroy();
    });

    it('should create GroundPrimitives for classified ground primitives, setting their classification type', () => {
      feature.set('olcs_classificationType', 'both');
      const primitive = createLinePrimitive(
        scene,
        vectorProperties,
        true,
        feature,
        geometries,
        style,
        true,
      );
      expect(primitive).to.be.an.instanceOf(GroundPolylinePrimitive);
      expect(primitive.classificationType).to.equal(ClassificationType.BOTH);
      primitive.destroy();
    });

    it('should create a Primitive for non-ground, non-classification features', () => {
      const primitive = createLinePrimitive(
        scene,
        vectorProperties,
        true,
        feature,
        geometries,
        style,
        false,
      );
      expect(primitive).to.be.an.instanceOf(Primitive);
      primitive.destroy();
    });

    it('should create a Primitive for non-classification ground features, defaulting to terrain only classification', () => {
      const primitive = createLinePrimitive(
        scene,
        vectorProperties,
        true,
        feature,
        geometries,
        style,
        true,
      );
      expect(primitive).to.be.an.instanceOf(GroundPolylinePrimitive);
      expect(primitive.classificationType).to.equal(ClassificationType.TERRAIN);
      primitive.destroy();
    });

    it('should set allowPicking based on the input', () => {
      let primitive = createLinePrimitive(
        scene,
        vectorProperties,
        false,
        feature,
        geometries,
        style,
        false,
      );
      expect(primitive.allowPicking).to.be.false;
      primitive.destroy();
      primitive = createLinePrimitive(
        scene,
        vectorProperties,
        true,
        feature,
        geometries,
        style,
        false,
      );
      expect(primitive.allowPicking).to.be.true;
      primitive.destroy();
    });

    describe('appearance', () => {
      it('should create a PerInstanceColorAppearance', () => {
        const primitive = createLinePrimitive(
          scene,
          vectorProperties,
          true,
          feature,
          geometries,
          style,
          false,
        );
        expect(primitive.appearance).to.be.an.instanceOf(
          PolylineMaterialAppearance,
        );
        primitive.destroy();
      });

      it('should create a color typed material for non-dashed strokes', () => {
        const primitive = createLinePrimitive(
          scene,
          vectorProperties,
          true,
          feature,
          geometries,
          style,
          false,
        );
        expect(primitive.appearance.material).to.have.property('type', 'Color');
        primitive.destroy();
      });

      it('should create a stripe material for dashed strokes', () => {
        style.getStroke().setLineDash([1, 1]);
        const primitive = createLinePrimitive(
          scene,
          vectorProperties,
          true,
          feature,
          geometries,
          style,
          false,
        );
        expect(primitive.appearance.material).to.have.property(
          'type',
          'Stripe',
        );
        primitive.destroy();
      });

      it('should set translucent to false for opaque strokes', () => {
        const primitive = createLinePrimitive(
          scene,
          vectorProperties,
          true,
          feature,
          geometries,
          style,
          false,
        );
        expect(primitive.appearance.translucent).to.be.false;
        primitive.destroy();
      });

      it('should set translucent to false for translucent strokes', () => {
        style.getStroke().setColor([0, 0, 0, 0.5]);
        const primitive = createLinePrimitive(
          scene,
          vectorProperties,
          true,
          feature,
          geometries,
          style,
          false,
        );
        expect(primitive.appearance.translucent).to.be.true;
        primitive.destroy();
      });
    });
  });

  describe('getMinHeightOrGroundLevel', () => {
    it('should return the groundLevel, if its a finite number', () => {
      const height = getMinHeightOrGroundLevel(1, [
        [0, 0, -1],
        [1, 1, 1],
      ]);
      expect(height).to.equal(1);
    });

    it('should return the minimum height of the coordinates if no ground level is supplied', () => {
      const height = getMinHeightOrGroundLevel(null, [
        [0, 0, -1],
        [1, 1, 1],
      ]);
      expect(height).to.equal(-1);
    });

    it('should return 0 if the minimum height is not a finite number', () => {
      const height = getMinHeightOrGroundLevel(null, [[1, 1, -Infinity]]);
      expect(height).to.equal(0);
    });
  });

  describe('getStoreyHeights', () => {
    let storeyHeights;

    it('should return extrudedHeight as storeyHeight Array with one entry for positive extrudedHeights', () => {
      storeyHeights = getStoreyHeights(12, [], 0);
      expect(storeyHeights).to.have.members([12]);
    });

    it('should return positive extrudedHeight as storeyHeight Array with one entry for negative extrudedHeights', () => {
      const storeyHeightsAbsolute = getStoreyHeights(-12, [], 0);
      expect(storeyHeightsAbsolute).to.have.members([12]);
    });

    it('should fill Storeyheight when no storeyHeight is given', () => {
      storeyHeights = getStoreyHeights(4, [], 2);
      expect(storeyHeights).to.have.members([2, 2]);
    });

    it('should fill up Storeyheights with latest value', () => {
      storeyHeights = getStoreyHeights(4, [2], 0);
      expect(storeyHeights).to.have.members([2, 2]);
    });

    it('should fill up Storeyheights with latest value', () => {
      storeyHeights = getStoreyHeights(7, [1, 2], 0);
      expect(storeyHeights).to.have.members([1, 2, 2, 2]);
    });

    it('should fill up the last entry of storeyheights so its sum equals the extrudedHeight', () => {
      storeyHeights = getStoreyHeights(4, [3], 0);
      expect(storeyHeights).to.have.members([3, 1]);
    });

    it('should handle negative extrusions the same as positive extrusions', () => {
      storeyHeights = getStoreyHeights(-6, [4], 0);
      expect(storeyHeights).to.have.members([4, 2]);
    });

    it('should handle too many storeyHeights, by reducing the values so the sum equals the extrudedHeight', () => {
      storeyHeights = getStoreyHeights(6, [4, 4, 1], 0);
      expect(storeyHeights).to.have.members([4, 2]);
    });

    it('should handle too large storeyHeights, by reducing the values so the sum equals the extrudedHeight', () => {
      storeyHeights = getStoreyHeights(6, [8, 4, 1], 0);
      expect(storeyHeights).to.have.members([6]);
    });
  });

  describe('validateStoreys', () => {
    it('should shrink storeys, and storeyHeights if more then 100 storeys', () => {
      const storeyHeights = new Array(112).fill(1);
      validateStoreys(112, storeyHeights);
      expect(storeyHeights).to.have.lengthOf(100);
    });

    it('should remove storeys, if no storeyHeights are set', () => {
      const storeyHeights = [];
      validateStoreys(2, []);
      expect(storeyHeights).to.have.lengthOf(0);
    });

    it('should remove storeyHeights, if no storeys are set', () => {
      const storeyHeights = [1, 1];
      validateStoreys(0, storeyHeights);
      expect(storeyHeights).to.have.lengthOf(0);
    });

    it('should fill missing storeyHeights with the last value', () => {
      const storeyHeights = [1, 2];
      validateStoreys(3, storeyHeights);
      expect(storeyHeights).to.have.ordered.members([1, 2, 2]);
    });

    it('should remove excess storeys', () => {
      const storeyHeights = [1, 1];
      validateStoreys(1, storeyHeights);
      expect(storeyHeights).to.have.lengthOf(1);
    });
  });

  describe('getHeightInfo', () => {
    let vectorProperties;

    afterEach(() => {
      if (vectorProperties) {
        vectorProperties.destroy();
      }
    });

    it('should create heightInfo based on default VectorProperties', () => {
      // defaults are always 0 and empty arrays.
      vectorProperties = new VectorProperties({});
      const feature = new Feature({});
      const heightInfo = getHeightInfo(feature, vectorProperties, []);
      expect(heightInfo.extruded).to.equal(false);
      expect(heightInfo.storeyHeightsAboveGround).to.be.empty;
      expect(heightInfo.storeyHeightsBelowGround).to.be.empty;
      expect(heightInfo.skirt).to.equal(0);
      expect(heightInfo.groundLevel).to.equal(0);
      expect(heightInfo.perPositionHeight).to.equal(false);
    });

    it('legacy case storeyNumber + storeyHeight', () => {
      vectorProperties = new VectorProperties({});
      const feature = new Feature({
        olcs_storeyNumber: 2,
        olcs_storeyHeight: 2,
      });

      const heightInfo = getHeightInfo(feature, vectorProperties, []);
      expect(heightInfo.extruded).to.equal(true);
      expect(heightInfo.storeyHeightsAboveGround).to.have.ordered.members([
        2, 2,
      ]);
    });

    it('legacy case extrudedHeight + storeyHeight', () => {
      vectorProperties = new VectorProperties({});
      const feature = new Feature({
        olcs_extrudedHeight: 3,
        olcs_storeyHeight: 2,
      });
      const heightInfo = getHeightInfo(feature, vectorProperties, []);
      expect(heightInfo.extruded).to.equal(true);
      expect(heightInfo.storeyHeightsAboveGround).to.have.ordered.members([
        2, 1,
      ]);
    });

    it('legacy case negative extrudedHeight + storeyHeight', () => {
      vectorProperties = new VectorProperties({});
      const feature = new Feature({
        olcs_extrudedHeight: -3,
        olcs_storeyHeight: 2,
      });
      const heightInfo = getHeightInfo(feature, vectorProperties, []);
      expect(heightInfo.extruded).to.equal(true);
      expect(heightInfo.storeyHeightsAboveGround).to.be.empty;
      expect(heightInfo.storeyHeightsBelowGround).to.have.ordered.members([
        2, 1,
      ]);
    });

    it('legacy case extrudedHeight + storeyNumber', () => {
      vectorProperties = new VectorProperties({});
      const feature = new Feature({
        olcs_extrudedHeight: 4,
        olcs_storeyNumber: 2,
      });
      const heightInfo = getHeightInfo(feature, vectorProperties, []);
      expect(heightInfo.extruded).to.equal(true);
      expect(heightInfo.storeyHeightsAboveGround).to.have.ordered.members([
        2, 2,
      ]);
    });

    it('legacy case negative extrudedHeight + storeyNumber', () => {
      vectorProperties = new VectorProperties({});
      const feature = new Feature({
        olcs_extrudedHeight: -4,
        olcs_storeyNumber: 2,
      });
      const heightInfo = getHeightInfo(feature, vectorProperties, []);
      expect(heightInfo.extruded).to.equal(true);
      expect(heightInfo.storeyHeightsBelowGround).to.have.ordered.members([
        2, 2,
      ]);
    });

    it('legacy case storeyNumber + layer storeyHeight', () => {
      vectorProperties = new VectorProperties({
        storeyHeight: 4,
      });
      const feature = new Feature({
        olcs_storeyNumber: 2,
      });
      const heightInfo = getHeightInfo(feature, vectorProperties, []);
      expect(heightInfo.extruded).to.equal(true);
      expect(heightInfo.storeyHeightsAboveGround).to.have.ordered.members([
        4, 4,
      ]);
    });

    it('storeys above and below ground above 100 should be set to 100', () => {
      vectorProperties = new VectorProperties({});
      const feature = new Feature({
        olcs_storeysAboveGround: 150,
        olcs_storeyHeightsAboveGround: 150,
        olcs_storeysBelowGround: 150,
        olcs_storeyHeightsBelowGround: 150,
      });
      const heightInfo = getHeightInfo(feature, vectorProperties, []);
      expect(heightInfo.extruded).to.equal(true);
      expect(heightInfo.storeyHeightsAboveGround).to.have.lengthOf(100);
      expect(heightInfo.storeyHeightsBelowGround).to.have.lengthOf(100);
    });

    it('if storeysAboveGround or storeysBelowGround without storeyHeight is set, it should return 0', () => {
      vectorProperties = new VectorProperties({});
      const feature = new Feature({
        olcs_storeysAboveGround: 1,
        olcs_storeysBelowGround: 1,
      });
      const heightInfo = getHeightInfo(feature, vectorProperties, []);
      expect(heightInfo.extruded).to.equal(false);
      expect(heightInfo.storeyHeightsAboveGround).to.be.empty;
      expect(heightInfo.storeyHeightsBelowGround).to.be.empty;
    });

    it('if only one storeyHeight is set, it should return 0', () => {
      vectorProperties = new VectorProperties({});
      const feature = new Feature({
        olcs_storeyHeightsAboveGround: [1],
        olcs_storeyHeightsBelowGround: [1],
      });
      const heightInfo = getHeightInfo(feature, vectorProperties, []);
      expect(heightInfo.extruded).to.equal(false);
      expect(heightInfo.storeyHeightsAboveGround).to.be.empty;
      expect(heightInfo.storeyHeightsBelowGround).to.be.empty;
    });

    it('should set per PositionHeight to true, if a z coordinate is given', () => {
      vectorProperties = new VectorProperties({});
      const feature = new Feature({});
      const heightInfo = getHeightInfo(feature, vectorProperties, [[1, 2, 3]]);
      expect(heightInfo.perPositionHeight).to.equal(true);
    });

    it('should set per PositionHeight to false, if a z coordinate is given and more than 1 storeys', () => {
      vectorProperties = new VectorProperties({});
      const feature = new Feature({
        olcs_storeysAboveGround: 10,
        olcs_storeyHeightsAboveGround: 10,
      });

      const heightInfo = getHeightInfo(feature, vectorProperties, [[1, 2, 3]]);
      expect(heightInfo.perPositionHeight).to.equal(false);
    });

    it('should set per PositionHeight to false, if ground level is given, even if a z coordinate is given', () => {
      vectorProperties = new VectorProperties({});
      const feature = new Feature({
        olcs_groundLevel: 12,
      });
      const heightInfo = getHeightInfo(feature, vectorProperties, [[1, 2, 3]]);
      expect(heightInfo.perPositionHeight).to.equal(false);
    });

    it('should set per PositionHeight to false, if ground level is given, even if a z coordinate is given and more than 1 storeys', () => {
      vectorProperties = new VectorProperties({});
      const feature = new Feature({
        olcs_storeysAboveGround: 1,
        olcs_groundLevel: 12,
      });

      const heightInfo = getHeightInfo(feature, vectorProperties, [[1, 2, 3]]);
      expect(heightInfo.perPositionHeight).to.equal(false);
    });

    it('should extract the minimum z value as the groundlevel from the coordinates', () => {
      vectorProperties = new VectorProperties({});
      const feature = new Feature({});
      const heightInfo = getHeightInfo(feature, vectorProperties, [
        [1, 2, 3],
        [1, 2, 4],
        [1, 2, 2],
      ]);
      expect(heightInfo.groundLevel).to.equal(2);
    });
  });

  describe('getHeightAboveGround', () => {
    let vectorProperties;
    let feature;
    let heightReference;

    before(() => {
      vectorProperties = new VectorProperties({ heightAboveGround: 5 });
      feature = new Feature({});
    });

    it('should return 0 if heightReference is CLAMP_TO_GROUND', () => {
      heightReference = HeightReference.CLAMP_TO_GROUND;
      const heightAboveGround = getHeightAboveGround(
        feature,
        heightReference,
        vectorProperties,
      );
      expect(heightAboveGround).to.equal(0);
    });

    it('should return 0 if heightReference is NONE', () => {
      heightReference = HeightReference.NONE;
      const heightAboveGround = getHeightAboveGround(
        feature,
        heightReference,
        vectorProperties,
      );
      expect(heightAboveGround).to.equal(0);
    });

    it('should return heightAboveGround from vectorProperties if heightReference is RELATIVE_TO_GROUND', () => {
      heightReference = HeightReference.RELATIVE_TO_GROUND;
      const heightAboveGround = getHeightAboveGround(
        feature,
        heightReference,
        vectorProperties,
      );
      expect(heightAboveGround).to.equal(5);
    });
  });
});
