import {
  Cartesian3,
  Cartographic,
  HeightReference,
  Matrix4,
  Primitive,
} from '@vcmap-cesium/engine';
import { Feature } from 'ol';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import { LineString, Point } from 'ol/geom.js';
import { expect } from 'chai';
import { getMockScene } from '../../helpers/cesiumHelpers.js';
import VectorProperties from '../../../../src/layer/vectorProperties.js';
import { setupClampedPrimitive } from '../../../../src/util/featureconverter/clampedPrimitive.js';
import { convert, Projection } from '../../../../index.js';

describe('clampedPrimitive', () => {
  let primitive: Primitive;
  let vectorProperties: VectorProperties;
  let heightCallback: (carto: Cartographic) => void;

  before(async () => {
    const scene = getMockScene();
    scene.getHeight = (): number => 2;
    scene.updateHeight = (
      _c: Cartographic,
      cb: (carto: Cartographic) => void,
      _h: HeightReference,
    ): (() => void) => {
      heightCallback = cb;
      return () => {
        heightCallback = (): void => {};
      };
    };
    vectorProperties = new VectorProperties({
      altitudeMode: 'absolute',
    });
    const geometry = new LineString([
      Projection.wgs84ToMercator([0, 0, 1]),
      Projection.wgs84ToMercator([1, 1, 1]),
    ]);
    const feature = new Feature({ geometry });
    const style = new Style({
      stroke: new Stroke({
        color: '#ff0000',
        width: 1,
      }),
    });
    primitive = (await convert(feature, style, vectorProperties, scene))[0]
      .item as Primitive;

    setupClampedPrimitive(
      scene,
      primitive,
      Projection.wgs84ToMercator([0.5, 0.5]) as [number, number],
      HeightReference.RELATIVE_TO_TERRAIN,
    );
  });

  after(() => {
    primitive.destroy();
    vectorProperties.destroy();
  });

  it('should set the height, if there is one', () => {
    const translation = Matrix4.getTranslation(
      primitive.modelMatrix,
      new Cartesian3(),
    );
    Cartesian3.add(Cartesian3.fromDegrees(0.5, 0.5), translation, translation);
    const carto = Cartographic.fromCartesian(translation);
    expect(carto.height).to.be.closeTo(2, 0.00000001);
  });

  it('should set the height, if there is one', () => {
    heightCallback(new Cartographic(1, 1, 25));
    const translation = Matrix4.getTranslation(
      primitive.modelMatrix,
      new Cartesian3(),
    );
    Cartesian3.add(Cartesian3.fromDegrees(0.5, 0.5), translation, translation);
    const carto = Cartographic.fromCartesian(translation);
    expect(carto.height).to.be.closeTo(25, 0.000000001);
  });
});
