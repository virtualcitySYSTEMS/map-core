import type { Scene } from '@vcmap-cesium/engine';
import {
  Cartesian3,
  CircleGeometry,
  CircleOutlineGeometry,
  ClassificationPrimitive,
  GroundPolylineGeometry,
  GroundPolylinePrimitive,
  GroundPrimitive,
  HeightReference,
  PerInstanceColorAppearance,
  PolylineGeometry,
  PolylineMaterialAppearance,
  Primitive,
} from '@vcmap-cesium/engine';
import { expect } from 'chai';
import Fill from 'ol/style/Fill.js';
import Feature from 'ol/Feature.js';
import Stroke from 'ol/style/Stroke.js';
import Style from 'ol/style/Style.js';
import { Circle, LineString, Polygon } from 'ol/geom.js';
import { getMockScene } from '../../helpers/cesiumHelpers.js';
import type { VectorGeometryFactory } from '../../../../src/util/featureconverter/vectorGeometryFactory.js';
import {
  createClassificationPrimitiveItem,
  createGroundLinePrimitiveItem,
  createGroundPrimitiveItem,
  createLinePrimitiveItem,
  createOutlinePrimitiveItem,
  createSolidPrimitiveItem,
  getCesiumGeometriesOptions,
  getMaterialAppearance,
} from '../../../../src/util/featureconverter/vectorGeometryFactory.js';
import VectorProperties from '../../../../src/layer/vectorProperties.js';
import type { ConvertedItem } from '../../../../src/util/featureconverter/convert.js';
import type {
  ClampedHeightReference,
  VectorHeightInfo,
} from '../../../../src/util/featureconverter/vectorHeightInfo.js';
import { getCircleGeometryFactory } from '../../../../src/util/featureconverter/circleToCesium.js';

function getAbsoluteHeightInfo(): VectorHeightInfo<HeightReference.NONE> {
  return {
    groundLevelOrMinHeight: 0,
    extruded: false,
    skirt: 0,
    storeyHeightsAboveGround: [],
    perPositionHeight: true,
    storeyHeightsBelowGround: [],
    heightReference: HeightReference.NONE,
    layout: 'XYZ',
  };
}

describe('vectorGeometryFactory', () => {
  describe('getMaterialAppearance', () => {
    let testScene: Scene;
    let testFill: Fill;
    let testFeature: Feature;

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
      expect(
        (testMaterial.renderState as { depthTest: object }).depthTest,
      ).to.have.property('enabled', true);
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

  describe('createClassificationPrimitiveItem', () => {
    let test: ConvertedItem<'primitive'>;

    before(() => {
      test = createClassificationPrimitiveItem(
        new Feature(),
        new Style({ fill: new Fill({ color: '#ff0000' }) }),
        new VectorProperties({
          classificationType: 'both',
        }),
        [
          {
            type: 'fill',
            geometry: new CircleGeometry({ center: Cartesian3.ONE, radius: 1 }),
            heightInfo: getAbsoluteHeightInfo(),
          },
        ],
      );
    });

    after(() => {
      test.item.destroy();
    });

    it('should return a classificationPrimitive', () => {
      expect(test.item).to.be.an.instanceof(ClassificationPrimitive);
    });

    describe('appearance', () => {
      it('should create a PerInstanceColorAppearance', () => {
        expect((test.item as Primitive).appearance).to.be.an.instanceOf(
          PerInstanceColorAppearance,
        );
      });

      it('should set flat to false', () => {
        expect((test.item as Primitive).appearance).to.have.property(
          'flat',
          false,
        );
      });

      it('should set lineWidth to 1', () => {
        expect(
          (test.item as Primitive).appearance?.renderState,
        ).to.have.property('lineWidth', 1);
      });

      it('should set translucent to false if the color is opaque', () => {
        expect((test.item as Primitive).appearance).to.have.property(
          'translucent',
          false,
        );
      });

      it('should set translucent to true, if the color is translucent', () => {
        const test2 = createClassificationPrimitiveItem(
          new Feature(),
          new Style({ fill: new Fill({ color: [255, 0, 0, 0.5] }) }),
          new VectorProperties({
            classificationType: 'both',
          }),
          [
            {
              type: 'fill',
              geometry: new CircleGeometry({
                center: Cartesian3.ONE,
                radius: 1,
              }),
              heightInfo: getAbsoluteHeightInfo(),
            },
          ],
        );
        expect((test2.item as Primitive).appearance).to.have.property(
          'translucent',
          true,
        );
        test2.item.destroy();
      });
    });
  });

  describe('createSolidPrimitiveItem', () => {
    it('should create a primitive', () => {
      const item = createSolidPrimitiveItem(
        new Feature({}),
        new Style({ fill: new Fill({ color: '#ff0000' }) }),
        new VectorProperties({}),
        getMockScene(),
        [
          {
            type: 'fill',
            geometry: new CircleGeometry({ center: Cartesian3.ONE, radius: 1 }),
            heightInfo: getAbsoluteHeightInfo(),
          },
        ],
      );
      expect(item.item).to.be.an.instanceof(Primitive);
      item.item.destroy();
    });
  });

  describe('createGroundPrimitiveItem', () => {
    it('should create a ground primitive', () => {
      const item = createGroundPrimitiveItem(
        new Feature({}),
        new Style({ fill: new Fill({ color: '#ff0000' }) }),
        new VectorProperties({}),
        getMockScene(),
        [
          {
            type: 'fill',
            geometry: new CircleGeometry({ center: Cartesian3.ONE, radius: 1 }),
            heightInfo: getAbsoluteHeightInfo(),
          },
        ],
      );
      expect(item.item).to.be.an.instanceof(GroundPrimitive);
      item.item.destroy();
    });
  });

  describe('createOutlinePrimitiveItem', () => {
    let vectorProperties: VectorProperties;
    let feature: Feature;
    let style: Style;

    before(() => {
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

    it('should create a primitive', () => {
      const primitive = createOutlinePrimitiveItem(
        feature,
        style,
        vectorProperties,
        [
          {
            type: 'outline',
            geometry: new CircleOutlineGeometry({
              center: Cartesian3.ONE,
              radius: 1,
            }),
            heightInfo: getAbsoluteHeightInfo(),
          },
        ],
      );
      expect(primitive.item).to.be.an.instanceOf(Primitive);
      primitive.item.destroy();
    });

    describe('appearance', () => {
      it('should create a PerInstanceColorAppearance', () => {
        const primitive = createOutlinePrimitiveItem(
          feature,
          style,
          vectorProperties,
          [
            {
              type: 'outline',
              geometry: new CircleOutlineGeometry({
                center: Cartesian3.ONE,
                radius: 1,
              }),
              heightInfo: getAbsoluteHeightInfo(),
            },
          ],
        );
        expect((primitive.item as Primitive).appearance).to.be.an.instanceOf(
          PerInstanceColorAppearance,
        );
        primitive.item.destroy();
      });

      it('should set translucent to false for opaque strokes', () => {
        const primitive = createOutlinePrimitiveItem(
          feature,
          style,
          vectorProperties,
          [
            {
              type: 'outline',
              geometry: new CircleOutlineGeometry({
                center: Cartesian3.ONE,
                radius: 1,
              }),
              heightInfo: getAbsoluteHeightInfo(),
            },
          ],
        );
        expect((primitive.item as Primitive).appearance.translucent).to.be
          .false;
        primitive.item.destroy();
      });

      it('should set translucent to false for translucent strokes', () => {
        style.getStroke()!.setColor([0, 0, 0, 0.5]);
        const primitive = createOutlinePrimitiveItem(
          feature,
          style,
          vectorProperties,
          [
            {
              type: 'outline',
              geometry: new CircleOutlineGeometry({
                center: Cartesian3.ONE,
                radius: 1,
              }),
              heightInfo: getAbsoluteHeightInfo(),
            },
          ],
        );
        expect((primitive.item as Primitive).appearance.translucent).to.be.true;
        primitive.item.destroy();
      });
    });
  });

  describe('createLinePrimitiveItem', () => {
    let feature: Feature;
    let style: Style;
    let vectorProperties: VectorProperties;

    before(() => {
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

    it('should create a primitive', () => {
      const primitive = createLinePrimitiveItem(
        feature,
        style,
        vectorProperties,
        [
          {
            type: 'line',
            geometry: new PolylineGeometry({
              positions: [Cartesian3.ZERO, Cartesian3.ONE],
            }),
            heightInfo: getAbsoluteHeightInfo(),
          },
        ],
      );
      expect(primitive.item).to.be.an.instanceOf(Primitive);
      primitive.item.destroy();
    });

    describe('appearance', () => {
      it('should create a PerInstanceColorAppearance', () => {
        const primitive = createLinePrimitiveItem(
          feature,
          style,
          vectorProperties,
          [
            {
              type: 'line',
              geometry: new PolylineGeometry({
                positions: [Cartesian3.ZERO, Cartesian3.ONE],
              }),
              heightInfo: getAbsoluteHeightInfo(),
            },
          ],
        );
        expect((primitive.item as Primitive).appearance).to.be.an.instanceOf(
          PolylineMaterialAppearance,
        );
        primitive.item.destroy();
      });

      it('should create a color typed material for non-dashed strokes', () => {
        const primitive = createLinePrimitiveItem(
          feature,
          style,
          vectorProperties,
          [
            {
              type: 'line',
              geometry: new PolylineGeometry({
                positions: [Cartesian3.ZERO, Cartesian3.ONE],
              }),
              heightInfo: getAbsoluteHeightInfo(),
            },
          ],
        );
        expect(
          (primitive.item as Primitive).appearance.material,
        ).to.have.property('type', 'Color');
        primitive.item.destroy();
      });

      it('should create a stripe material for dashed strokes', () => {
        style.getStroke()!.setLineDash([1, 1]);
        const primitive = createLinePrimitiveItem(
          feature,
          style,
          vectorProperties,
          [
            {
              type: 'line',
              geometry: new PolylineGeometry({
                positions: [Cartesian3.ZERO, Cartesian3.ONE],
              }),
              heightInfo: getAbsoluteHeightInfo(),
            },
          ],
        );
        expect(
          (primitive.item as Primitive).appearance.material,
        ).to.have.property('type', 'Stripe');
        primitive.item.destroy();
      });

      it('should set translucent to false for opaque strokes', () => {
        const primitive = createLinePrimitiveItem(
          feature,
          style,
          vectorProperties,
          [
            {
              type: 'line',
              geometry: new PolylineGeometry({
                positions: [Cartesian3.ZERO, Cartesian3.ONE],
              }),
              heightInfo: getAbsoluteHeightInfo(),
            },
          ],
        );
        expect((primitive.item as Primitive).appearance.translucent).to.be
          .false;
        primitive.item.destroy();
      });

      it('should set translucent to false for translucent strokes', () => {
        style.getStroke()!.setColor([0, 0, 0, 0.5]);
        const primitive = createLinePrimitiveItem(
          feature,
          style,
          vectorProperties,
          [
            {
              type: 'line',
              geometry: new PolylineGeometry({
                positions: [Cartesian3.ZERO, Cartesian3.ONE],
              }),
              heightInfo: getAbsoluteHeightInfo(),
            },
          ],
        );
        expect((primitive.item as Primitive).appearance.translucent).to.be.true;
        primitive.item.destroy();
      });
    });
  });

  describe('createGroundLinePrimitiveItem', () => {
    let feature: Feature;
    let style: Style;
    let vectorProperties: VectorProperties;

    before(() => {
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

    it('should create a ground polyline primitive', () => {
      const primitive = createGroundLinePrimitiveItem(
        feature,
        style,
        vectorProperties,
        [
          {
            type: 'groundLine',
            geometry: new GroundPolylineGeometry({
              positions: [Cartesian3.ZERO, Cartesian3.ONE],
            }),
            heightInfo: getAbsoluteHeightInfo(),
          },
        ],
      );
      expect(primitive.item).to.be.an.instanceOf(GroundPolylinePrimitive);
      primitive.item.destroy();
    });

    describe('appearance', () => {
      it('should create a PerInstanceColorAppearance', () => {
        const primitive = createGroundLinePrimitiveItem(
          feature,
          style,
          vectorProperties,
          [
            {
              type: 'groundLine',
              geometry: new GroundPolylineGeometry({
                positions: [Cartesian3.ZERO, Cartesian3.ONE],
              }),
              heightInfo: getAbsoluteHeightInfo(),
            },
          ],
        );
        expect((primitive.item as Primitive).appearance).to.be.an.instanceOf(
          PolylineMaterialAppearance,
        );
        primitive.item.destroy();
      });

      it('should create a color typed material for non-dashed strokes', () => {
        const primitive = createGroundLinePrimitiveItem(
          feature,
          style,
          vectorProperties,
          [
            {
              type: 'groundLine',
              geometry: new GroundPolylineGeometry({
                positions: [Cartesian3.ZERO, Cartesian3.ONE],
              }),
              heightInfo: getAbsoluteHeightInfo(),
            },
          ],
        );
        expect(
          (primitive.item as Primitive).appearance.material,
        ).to.have.property('type', 'Color');
        primitive.item.destroy();
      });

      it('should create a stripe material for dashed strokes', () => {
        style.getStroke()!.setLineDash([1, 1]);
        const primitive = createGroundLinePrimitiveItem(
          feature,
          style,
          vectorProperties,
          [
            {
              type: 'groundLine',
              geometry: new GroundPolylineGeometry({
                positions: [Cartesian3.ZERO, Cartesian3.ONE],
              }),
              heightInfo: getAbsoluteHeightInfo(),
            },
          ],
        );
        expect(
          (primitive.item as Primitive).appearance.material,
        ).to.have.property('type', 'Stripe');
        primitive.item.destroy();
      });

      it('should set translucent to false for opaque strokes', () => {
        const primitive = createGroundLinePrimitiveItem(
          feature,
          style,
          vectorProperties,
          [
            {
              type: 'groundLine',
              geometry: new GroundPolylineGeometry({
                positions: [Cartesian3.ZERO, Cartesian3.ONE],
              }),
              heightInfo: getAbsoluteHeightInfo(),
            },
          ],
        );
        expect((primitive.item as Primitive).appearance.translucent).to.be
          .false;
        primitive.item.destroy();
      });

      it('should set translucent to false for translucent strokes', () => {
        style.getStroke()!.setColor([0, 0, 0, 0.5]);
        const primitive = createGroundLinePrimitiveItem(
          feature,
          style,
          vectorProperties,
          [
            {
              type: 'groundLine',
              geometry: new GroundPolylineGeometry({
                positions: [Cartesian3.ZERO, Cartesian3.ONE],
              }),
              heightInfo: getAbsoluteHeightInfo(),
            },
          ],
        );
        expect((primitive.item as Primitive).appearance.translucent).to.be.true;
        primitive.item.destroy();
      });
    });
  });

  describe('getCesiumGeometriesOptions', () => {
    let style: Style;
    let geometryFactory: VectorGeometryFactory<'circle'>;
    let geometry: Circle;

    before(() => {
      const fill = new Fill({ color: '#ff0000' });
      const stroke = new Stroke({ color: '#0000ff', width: 1 });
      style = new Style({ fill, stroke });
      geometryFactory = getCircleGeometryFactory();
      geometry = new Circle([0, 0, 1], 10);
    });

    describe('for clamped height reference', () => {
      let heightInfo: VectorHeightInfo<ClampedHeightReference>;

      before(() => {
        heightInfo = {
          heightReference: HeightReference.CLAMP_TO_GROUND,
          layout: 'XYZ',
        };
      });

      it('should create a fill & ground line geometry for fill & stroke styles', () => {
        const geometryOptions = getCesiumGeometriesOptions(
          style,
          geometry,
          geometryFactory,
          heightInfo,
        );
        expect(geometryOptions).to.have.lengthOf(2);
        const types = geometryOptions.map((o) => o.type);
        expect(types).to.include('fill');
        expect(types).to.include('groundLine');
      });
    });

    describe('extrusion handling', () => {
      let heightInfo: VectorHeightInfo<HeightReference.NONE>;

      beforeEach(() => {
        heightInfo = getAbsoluteHeightInfo();
        heightInfo.extruded = true;
      });

      it('should create a fill & outline for each storey above ground', () => {
        heightInfo.storeyHeightsAboveGround = [3, 4, 5];
        const geometryOptions = getCesiumGeometriesOptions(
          style,
          geometry,
          geometryFactory,
          heightInfo,
        );

        expect(geometryOptions).to.have.lengthOf(6);
        const types = geometryOptions.map((o) => o.type);
        expect(types).to.have.members([
          'solid',
          'solid',
          'solid',
          'outline',
          'outline',
          'outline',
        ]);
      });

      it('should create a fill & outline for each storey below ground', () => {
        heightInfo.storeyHeightsBelowGround = [3, 4, 5];
        const geometryOptions = getCesiumGeometriesOptions(
          style,
          geometry,
          geometryFactory,
          heightInfo,
        );

        expect(geometryOptions).to.have.lengthOf(6);
        const types = geometryOptions.map((o) => o.type);
        expect(types).to.have.members([
          'solid',
          'solid',
          'solid',
          'outline',
          'outline',
          'outline',
        ]);
      });

      it('should add a fill & outline for a skirt', () => {
        heightInfo.storeyHeightsBelowGround = [3, 4];
        heightInfo.skirt = 2;
        const geometryOptions = getCesiumGeometriesOptions(
          style,
          geometry,
          geometryFactory,
          heightInfo,
        );

        expect(geometryOptions).to.have.lengthOf(6);
        const types = geometryOptions.map((o) => o.type);
        expect(types).to.have.members([
          'solid',
          'solid',
          'solid',
          'outline',
          'outline',
          'outline',
        ]);
      });
    });

    describe('non extruded, non clamped geometry options', () => {
      let heightInfo: VectorHeightInfo<HeightReference.NONE>;

      before(() => {
        heightInfo = getAbsoluteHeightInfo();
      });

      it('should create a fill & line geometry for fill & stroke styles', () => {
        const geometryOptions = getCesiumGeometriesOptions(
          style,
          geometry,
          geometryFactory,
          heightInfo,
        );
        expect(geometryOptions).to.have.lengthOf(2);
        const types = geometryOptions.map((o) => o.type);
        expect(types).to.include('fill');
        expect(types).to.include('line');
      });
    });
  });
});
