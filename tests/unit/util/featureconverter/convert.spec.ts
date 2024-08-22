import Feature from 'ol/Feature.js';
import Style, { StyleFunction, StyleLike } from 'ol/style/Style.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import RegularShape from 'ol/style/RegularShape.js';
import { expect } from 'chai';
import { Polygon, MultiPolygon, LineString } from 'ol/geom.js';
import {
  Cartesian3,
  GroundPolylinePrimitive,
  GroundPrimitive,
  Math as CesiumMath,
  Matrix4,
  Primitive,
  Scene,
  Transforms,
} from '@vcmap-cesium/engine';
import sinon, { SinonSandbox } from 'sinon';
import convert, {
  getStylesArray,
} from '../../../../src/util/featureconverter/convert.js';
import {
  ArrowEnd,
  ArrowStyle,
  CesiumMap,
  mercatorToCartesian,
  PrimitiveOptionsType,
  VectorProperties,
} from '../../../../index.js';
import { getCesiumMap } from '../../helpers/cesiumHelpers.js';

describe('convert', () => {
  describe('getStylesArray', () => {
    let sandbox: SinonSandbox;
    let feature: Feature;
    let style: Style;

    before(() => {
      sandbox = sinon.createSandbox();
      feature = new Feature({});
      style = new Style({});
    });

    it('should handle single Style and return an array', () => {
      const styles = getStylesArray(style, feature);
      expect(styles).to.be.an('array');
      expect(styles).to.have.lengthOf(1);
      expect(styles[0]).to.be.equal(style);
    });

    it('should handle an array of styles and return an array', () => {
      const style2 = new Style({ fill: new Fill({}) });
      const styles = getStylesArray([style, style2], feature);
      expect(styles).to.be.an('array');
      expect(styles).to.have.lengthOf(2);
      expect(styles).to.have.ordered.members([style, style2]);
    });

    it('should handle style functions', () => {
      const styleFunction = sandbox.fake.returns(style);
      const styles = getStylesArray(styleFunction, feature);
      expect(styles).to.be.an('array');
      expect(styles).to.have.lengthOf(1);
      expect(styles).to.have.members([style]);
    });

    it('should handle nested styles', () => {
      const style2 = new Style({ fill: new Fill({}) });
      const style3 = new Style({ stroke: new Stroke({}) });
      const style4 = new Style({
        image: new RegularShape({
          radius: 1,
          points: 0,
        }),
      });
      const styleFunction: StyleFunction = (): Style[] => [style, style2];
      const styles = getStylesArray(
        [styleFunction, [style3, style4]] as unknown as StyleLike,
        feature,
      );
      expect(styles).to.be.an('array');
      expect(styles).to.have.lengthOf(4);
      expect(styles).to.have.ordered.members([style, style2, style3, style4]);
    });

    it('should handle non style elements', () => {
      const style2 = {};
      const styles = getStylesArray(style2 as unknown as Style, feature);
      expect(styles).to.be.an('array');
      expect(styles).to.have.lengthOf(0);
    });
  });

  describe('converting a feature with a single geometry', () => {
    let feature: Feature;
    let emptyStyle: Style;
    let style: Style;
    let geometry: Polygon;
    let vectorProperties: VectorProperties;
    let map: CesiumMap;
    let scene: Scene;

    before(() => {
      emptyStyle = new Style({});
      style = new Style({
        fill: new Fill({
          color: [1, 1, 1],
        }),
        stroke: new Stroke({
          color: [1, 1, 1],
        }),
      });
      geometry = new Polygon([
        [
          [1, 1, 1],
          [1, 2, 1],
          [2, 2, 1],
          [1, 1, 1],
        ],
        [
          [1.4, 1.4, 1],
          [1.6, 1.6, 1],
          [1.4, 1.6, 1],
          [1.4, 1.4, 1],
        ],
      ]);
      feature = new Feature({ id: 'myId', geometry });
      vectorProperties = new VectorProperties({
        altitudeMode: 'absolute',
        eyeOffset: [1, 1, 1],
      });
      map = getCesiumMap();
      scene = map.getScene()!;
    });

    after(() => {
      vectorProperties.destroy();
      map.destroy();
    });

    it('should return without a fill or stroke style', () => {
      const items = convert(feature, emptyStyle, vectorProperties, scene);
      expect(items).to.be.empty;
    });

    it('should create Primitives for AltitudeMode absolute', async () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'absolute',
      });
      const items = await convert(
        feature,
        style,
        altitudeModeVectorProperties,
        scene,
      );
      expect(items).to.have.lengthOf(2);
    });

    it('should create Primitives for AltitudeMode relativeTo*', async () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'relativeToGround',
      });
      const items = await convert(
        feature,
        style,
        altitudeModeVectorProperties,
        scene,
      );
      expect(items).to.have.lengthOf(2);
    });

    it('should create a Ground Primitives for AltitudeMode clampToGround', async () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'clampToGround',
      });
      const items = await convert(
        feature,
        style,
        altitudeModeVectorProperties,
        scene,
      );
      expect(items).to.have.lengthOf(2);
      expect(items.some((i) => i.item instanceof GroundPolylinePrimitive)).to.be
        .true;
      expect(items.some((i) => i.item instanceof GroundPrimitive)).to.be.true;
    });

    it('should create only GroundPolylinePrimitive for non Fill Styles', async () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'clampToGround',
      });
      const strokeStyle = new Style({ stroke: new Stroke({}) });
      const items = await convert(
        feature,
        strokeStyle,
        altitudeModeVectorProperties,
        scene,
      );
      expect(items).lengthOf(1);
      expect(items[0].item).to.be.an.instanceOf(GroundPolylinePrimitive);
    });

    it('should create only GroundPrimitive for non Stroke Styles', async () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'clampToGround',
      });
      const fillStyle = new Style({ fill: new Fill({}) });
      const items = await convert(
        feature,
        fillStyle,
        altitudeModeVectorProperties,
        scene,
      );
      expect(items).lengthOf(1);
      expect(items[0].item).to.be.an.instanceOf(GroundPrimitive);
    });

    it('should create primitive per style', async () => {
      const fillStyle = new Style({ fill: new Fill({}) });
      const items = await convert(
        feature,
        [fillStyle, fillStyle],
        vectorProperties,
        scene,
      );
      expect(items).lengthOf(2);
    });
  });

  describe('converting a feature with a multi geometry', () => {
    let feature: Feature;
    let emptyStyle: Style;
    let style: Style;
    let geometry: MultiPolygon;
    let vectorProperties: VectorProperties;
    let map: CesiumMap;
    let scene: Scene;

    before(() => {
      emptyStyle = new Style({});
      style = new Style({
        fill: new Fill({
          color: [1, 1, 1],
        }),
        stroke: new Stroke({
          color: [1, 1, 1],
        }),
      });
      geometry = new MultiPolygon([
        [
          [
            [1, 1, 1],
            [1, 2, 1],
            [2, 2, 1],
            [1, 1, 1],
          ],
          [
            [1.4, 1.4, 1],
            [1.6, 1.6, 1],
            [1.4, 1.6, 1],
            [1.4, 1.4, 1],
          ],
        ],
        [
          [
            [10, 10, 10],
            [10, 20, 10],
            [20, 20, 10],
            [10, 10, 10],
          ],
        ],
      ]);
      feature = new Feature({ id: 'myId', geometry });
      vectorProperties = new VectorProperties({
        altitudeMode: 'absolute',
        eyeOffset: [1, 1, 1],
      });
      map = getCesiumMap();
      scene = map.getScene()!;
    });

    after(() => {
      vectorProperties.destroy();
      map.destroy();
    });

    it('should return without a fill or stroke style', () => {
      const items = convert(feature, emptyStyle, vectorProperties, scene);
      expect(items).to.be.empty;
    });

    it('should create Primitives for AltitudeMode absolute', async () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'absolute',
      });
      const items = await convert(
        feature,
        style,
        altitudeModeVectorProperties,
        scene,
      );
      expect(items).to.have.lengthOf(2);
    });

    it('should create Primitives for AltitudeMode relativeTo*', async () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'relativeToGround',
      });
      const items = await convert(
        feature,
        style,
        altitudeModeVectorProperties,
        scene,
      );
      expect(items).to.have.lengthOf(4);
    });

    it('should create a Ground Primitives for AltitudeMode clampToGround', async () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'clampToGround',
      });
      const items = await convert(
        feature,
        style,
        altitudeModeVectorProperties,
        scene,
      );
      expect(items).to.have.lengthOf(2);
      expect(items.some((i) => i.item instanceof GroundPolylinePrimitive)).to.be
        .true;
      expect(items.some((i) => i.item instanceof GroundPrimitive)).to.be.true;
    });

    it('should create only GroundPolylinePrimitive for non Fill Styles', async () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'clampToGround',
      });
      const strokeStyle = new Style({ stroke: new Stroke({}) });
      const items = await convert(
        feature,
        strokeStyle,
        altitudeModeVectorProperties,
        scene,
      );
      expect(items).lengthOf(1);
      expect(items[0].item).to.be.an.instanceOf(GroundPolylinePrimitive);
    });

    it('should create only GroundPrimitive for non Stroke Styles', async () => {
      const altitudeModeVectorProperties = new VectorProperties({
        altitudeMode: 'clampToGround',
      });
      const fillStyle = new Style({ fill: new Fill({}) });
      const items = await convert(
        feature,
        fillStyle,
        altitudeModeVectorProperties,
        scene,
      );
      expect(items).lengthOf(1);
      expect(items[0].item).to.be.an.instanceOf(GroundPrimitive);
    });

    it('should create primitive per style', async () => {
      const fillStyle = new Style({ fill: new Fill({}) });
      const items = await convert(
        feature,
        [fillStyle, fillStyle],
        vectorProperties,
        scene,
      );
      expect(items).lengthOf(2);
    });
  });

  describe('batching relative to ground multi geometries', () => {
    let vectorProperties: VectorProperties;
    let style: Style;
    let map: CesiumMap;
    let scene: Scene;

    before(() => {
      style = new Style({
        fill: new Fill({
          color: [1, 1, 1],
        }),
      });

      vectorProperties = new VectorProperties({
        altitudeMode: 'relativeToGround',
      });
      map = getCesiumMap();
      scene = map.getScene()!;
    });

    after(() => {
      vectorProperties.destroy();
      map.destroy();
    });

    it('should create a primitive for each geometry with a differing clamp origin', async () => {
      const geometry = new MultiPolygon([
        [
          [
            [1, 1, 1],
            [1, 2, 1],
            [2, 2, 1],
            [1, 1, 1],
          ],
          [
            [1.4, 1.4, 1],
            [1.6, 1.6, 1],
            [1.4, 1.6, 1],
            [1.4, 1.4, 1],
          ],
        ],
        [
          [
            [10, 10, 10],
            [10, 20, 10],
            [20, 20, 10],
            [10, 10, 10],
          ],
        ],
      ]);
      const feature = new Feature({ id: 'myId', geometry });
      const items = await convert(feature, style, vectorProperties, scene);
      expect(items).to.have.lengthOf(2);
    });

    it('should batch primitives which have the same clamp origin', async () => {
      const geometry = new MultiPolygon([
        [
          [
            [1, 1, 1],
            [1, 2, 1],
            [2, 2, 1],
            [1, 1, 1],
          ],
        ],
        [
          [
            [1, 1, 10],
            [1, 2, 10],
            [2, 2, 10],
            [1, 1, 10],
          ],
        ],
      ]);
      const feature = new Feature({ id: 'myId', geometry });
      const items = await convert(feature, style, vectorProperties, scene);
      expect(items).to.have.lengthOf(1);
    });
  });

  describe('arrow style', () => {
    let arrowStyle: ArrowStyle;
    let feature: Feature;
    let vectorProperties: VectorProperties;
    let map: CesiumMap;
    let geometry: LineString;
    let scene: Scene;

    before(() => {
      geometry = new LineString([
        [1, 1, 0],
        [1, 2, 1],
      ]);
      feature = new Feature({ id: 'myId', geometry });
      vectorProperties = new VectorProperties({
        altitudeMode: 'absolute',
        eyeOffset: [1, 1, 1],
      });
      map = getCesiumMap();
      scene = map.getScene()!;
    });

    beforeEach(() => {
      arrowStyle = new ArrowStyle({
        primitiveOptions: {
          type: PrimitiveOptionsType.SPHERE,
          geometryOptions: {
            radius: 1,
          },
        },
      });
    });

    after(() => {
      vectorProperties.destroy();
      map.destroy();
    });

    it('should add an arrow primitive to the last coordinate', async () => {
      const items = await convert(feature, arrowStyle, vectorProperties, scene);
      expect(items).to.have.lengthOf(2);
      const translation = Matrix4.getTranslation(
        (items[0].item as Primitive).modelMatrix,
        new Cartesian3(),
      );
      expect(
        Cartesian3.equals(
          mercatorToCartesian(geometry.getLastCoordinate()),
          translation,
        ),
      ).to.be.true;
    });

    it('should add an arrow primitive to the first coordinate', async () => {
      arrowStyle.end = ArrowEnd.START;
      const items = await convert(feature, arrowStyle, vectorProperties, scene);
      expect(items).to.have.lengthOf(2);
      const translation = Matrix4.getTranslation(
        (items[0].item as Primitive).modelMatrix,
        new Cartesian3(),
      );
      expect(
        Cartesian3.equals(
          mercatorToCartesian(geometry.getFirstCoordinate()),
          translation,
        ),
      ).to.be.true;
    });

    it('should add an arrow primitive to the first & last coordinate', async () => {
      arrowStyle.end = ArrowEnd.BOTH;
      const items = await convert(feature, arrowStyle, vectorProperties, scene);
      expect(items).to.have.lengthOf(3);
    });

    it('should not add arrow primitives, if end is NONE', async () => {
      arrowStyle.end = ArrowEnd.NONE;
      const items = await convert(feature, arrowStyle, vectorProperties, scene);
      expect(items).to.have.lengthOf(1);
    });

    it('should set pitch & heading on the primitive', async () => {
      const items = await convert(feature, arrowStyle, vectorProperties, scene);
      expect(items).to.have.lengthOf(2);
      const headingPitchRoll = Transforms.fixedFrameToHeadingPitchRoll(
        (items[0].item as Primitive).modelMatrix,
      );
      expect(headingPitchRoll.heading).to.be.closeTo(
        CesiumMath.PI_OVER_TWO,
        CesiumMath.EPSILON5,
      );
      expect(headingPitchRoll.pitch).to.be.closeTo(
        CesiumMath.PI_OVER_FOUR,
        CesiumMath.EPSILON2,
      );
    });
  });
});
