import { expect } from 'chai';
import Point from 'ol/geom/Point.js';
import Polygon from 'ol/geom/Polygon.js';
import Feature from 'ol/Feature.js';
import Style from 'ol/style/Style.js';
import RegularShape from 'ol/style/RegularShape.js';
import TextStyle from 'ol/style/Text.js';
import Icon from 'ol/style/Icon.js';
import { Coordinate } from 'ol/coordinate.js';
import {
  HeightReference,
  VerticalOrigin,
  Cartesian3,
  Color,
  Cartesian2,
  HorizontalOrigin,
  LabelStyle,
  PolylineGeometry,
  Scene,
} from '@vcmap-cesium/engine';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import nock from 'nock';
import VectorProperties, {
  PrimitiveOptionsType,
} from '../../../../src/layer/vectorProperties.js';
import {
  validatePoint,
  getBillboardOptions,
  getLabelOptions,
  getLineGeometries,
  BillboardOptions,
  LabelOptions,
  getPointPrimitives,
} from '../../../../src/util/featureconverter/pointToCesium.js';
import { blackPixelURI } from '../../helpers/imageHelpers.js';
import { getCesiumColor } from '../../../../src/style/styleHelpers.js';
import { getCesiumMap } from '../../helpers/cesiumHelpers.js';
import {
  getHeightInfo,
  VectorHeightInfo,
} from '../../../../src/util/featureconverter/vectorHeightInfo.js';
import { CesiumGeometryOption } from '../../../../src/util/featureconverter/vectorGeometryFactory.js';
import { CesiumMap } from '../../../../index.js';

describe('pointToCesium', () => {
  describe('validatePoint', () => {
    it('should invalidate a point without a coordinate', () => {
      const point = new Point([]);
      expect(validatePoint(point)).to.be.false;
    });

    it('should invalidate a point with only one value', () => {
      const point = new Point([1]);
      expect(validatePoint(point)).to.be.false;
    });

    it('should invalidate a point with a non valid number', () => {
      const point = new Point(['asd' as unknown as number]);
      expect(validatePoint(point)).to.be.false;
    });

    it('should validate a point with 2 coordinates', () => {
      const point = new Point([1, 2]);
      expect(validatePoint(point)).to.be.true;
    });

    it('should validate a point with 3 coordinates', () => {
      const point = new Point([1, 2, 3]);
      expect(validatePoint(point)).to.be.true;
    });

    it('should invalidate a non point geometry', () => {
      const point = new Polygon([
        [
          [1, 2, 3],
          [2, 4, 3],
          [3, 2, 3],
        ],
      ]);
      expect(validatePoint(point as unknown as Point)).to.be.false;
    });
  });

  describe('getBillboardOptions', () => {
    let feature: Feature;
    let heightReference: HeightReference;
    let vectorProperties: VectorProperties;
    let billboardOptions: Partial<BillboardOptions> | null;

    before(() => {
      feature = new Feature({ id: 'myId' });
      heightReference = HeightReference.NONE;
      vectorProperties = new VectorProperties({
        eyeOffset: [1, 1, 1],
        scaleByDistance: [0, 2, 0, 1],
      });
    });

    after(() => {
      vectorProperties.destroy();
    });

    it('should not create billboardOptions if the style is not an ImageStyle', () => {
      billboardOptions = getBillboardOptions(
        feature,
        new Style({}),
        heightReference,
        vectorProperties,
      );
      expect(billboardOptions).to.be.null;
    });

    describe('regularShape Style', () => {
      let regularShapeStyle: Style;

      before(() => {
        regularShapeStyle = new Style({
          image: new RegularShape({
            radius: 1,
            points: 0,
          }),
        });
        billboardOptions = getBillboardOptions(
          feature,
          regularShapeStyle,
          heightReference,
          vectorProperties,
        );
      });

      it('should extract the scale from the style and set on the return Object', () => {
        expect(billboardOptions?.scale).to.be.equal(
          regularShapeStyle.getImage()?.getScale(),
        );
      });

      it('should set the given heightReference on the return Object', () => {
        expect(billboardOptions?.heightReference).to.be.equal(heightReference);
      });

      it('should set the verticalOrigin to the default value VerticalOrigin.Bottom', () => {
        expect(billboardOptions?.verticalOrigin).to.be.equal(
          VerticalOrigin.BOTTOM,
        );
      });

      it('should set the id to the id of the feature', () => {
        expect(billboardOptions?.id).to.be.equal(feature.getId());
      });

      it('should set the eyeOffset', () => {
        expect(billboardOptions?.eyeOffset).to.be.equal(
          vectorProperties.eyeOffset,
        );
      });

      it('should set scaleByDistance', () => {
        expect(billboardOptions?.scaleByDistance).to.be.equal(
          vectorProperties.scaleByDistance,
        );
      });

      it('should set the image', () => {
        expect(billboardOptions?.image).to.be.equal(
          regularShapeStyle.getImage()?.getImage(1),
        );
      });

      it('should set the opacity value of the style to the color alpha value', () => {
        expect(billboardOptions?.color).to.be.instanceOf(Color);
        expect(billboardOptions?.color?.alpha).to.be.equal(
          regularShapeStyle.getImage()?.getOpacity(),
        );
      });
    });

    describe('icon Style', () => {
      let iconStyle;
      let image;

      before(() => {
        image = document.createElement('img');
        image.src = blackPixelURI;
        iconStyle = new Style({
          image: new Icon({
            src: 'image.png',
            size: [1, 1],
            scale: 23,
            opacity: 0.5,
          }),
        });
        billboardOptions = getBillboardOptions(
          feature,
          iconStyle,
          heightReference,
          vectorProperties,
        );
      });

      it('should set image to a Promise if the icon has not been loaded ', () => {
        expect(billboardOptions?.image).to.be.instanceOf(Promise);
      });

      it('should set scale to x scale when scale is an array', () => {
        billboardOptions = getBillboardOptions(
          feature,
          new Style({
            image: new Icon({
              src: 'image.png',
              scale: [2, 3],
            }),
          }),
          heightReference,
          vectorProperties,
        );
        expect(billboardOptions?.scale).to.be.equal(2);
      });
    });
  });

  describe('getLabelOptions', () => {
    let feature: Feature;
    let heightReference: HeightReference;
    let vectorProperties: VectorProperties;
    let labelOptions: Partial<LabelOptions> | null;

    before(() => {
      feature = new Feature({ id: 'myId' });
      heightReference = HeightReference.NONE;
      vectorProperties = new VectorProperties({
        eyeOffset: [1, 1, 1],
        scaleByDistance: [0, 2, 0, 1],
      });
    });

    after(() => {
      vectorProperties.destroy();
    });

    it('should not create labelOptions if the style has no Text Style', () => {
      labelOptions = getLabelOptions(
        feature,
        new Style({}),
        heightReference,
        vectorProperties,
      );
      expect(labelOptions).to.be.null;
    });

    it('should not create labelOptions if the style has no text', () => {
      labelOptions = getLabelOptions(
        feature,
        new Style({
          text: new TextStyle({}),
        }),
        heightReference,
        vectorProperties,
      );
      expect(labelOptions).to.be.null;
    });

    it('should create labelOptions if the style has a text set', () => {
      labelOptions = getLabelOptions(
        feature,
        new Style({
          text: new TextStyle({
            text: 'test',
          }),
        }),
        heightReference,
        vectorProperties,
      );
      expect(labelOptions).to.be.an('object');
      expect(labelOptions?.text).to.be.equal('test');
    });

    it('should set font the font to undefined if not provided', () => {
      labelOptions = getLabelOptions(
        feature,
        new Style({
          text: new TextStyle({
            text: 'test',
          }),
        }),
        heightReference,
        vectorProperties,
      );
      expect(labelOptions?.font).to.be.undefined;
    });

    it('should set font', () => {
      labelOptions = getLabelOptions(
        feature,
        new Style({
          text: new TextStyle({
            font: 'arial',
            text: 'test',
          }),
        }),
        heightReference,
        vectorProperties,
      );
      expect(labelOptions?.font).to.be.equal('arial');
    });

    it('should set default horizontalOrigin if not set on the style', () => {
      labelOptions = getLabelOptions(
        feature,
        new Style({
          text: new TextStyle({
            text: 'test',
          }),
        }),
        heightReference,
        vectorProperties,
      );
      expect(labelOptions?.horizontalOrigin).to.be.equal(
        HorizontalOrigin.CENTER,
      );
    });

    it('should set horizontalOrigin', () => {
      labelOptions = getLabelOptions(
        feature,
        new Style({
          text: new TextStyle({
            textAlign: 'left',
            text: 'test',
          }),
        }),
        heightReference,
        vectorProperties,
      );
      expect(labelOptions?.horizontalOrigin).to.be.equal(HorizontalOrigin.LEFT);
    });

    it('should set default verticalOrigin if not set on the style', () => {
      labelOptions = getLabelOptions(
        feature,
        new Style({
          text: new TextStyle({
            text: 'test',
          }),
        }),
        heightReference,
        vectorProperties,
      );
      expect(labelOptions?.verticalOrigin).to.be.equal(VerticalOrigin.BASELINE);
    });

    it('should set verticalOrigin', () => {
      labelOptions = getLabelOptions(
        feature,
        new Style({
          text: new TextStyle({
            textBaseline: 'top',
            text: 'test',
          }),
        }),
        heightReference,
        vectorProperties,
      );
      expect(labelOptions?.verticalOrigin).to.be.equal(VerticalOrigin.TOP);
    });

    it('should set scale', () => {
      labelOptions = getLabelOptions(
        feature,
        new Style({
          text: new TextStyle({
            textBaseline: 'top',
            text: 'test',
            scale: 2,
          }),
        }),
        heightReference,
        vectorProperties,
      );
      expect(labelOptions?.scale).to.be.equal(2);
    });

    it('should set scale to x scale when scale is an array', () => {
      labelOptions = getLabelOptions(
        feature,
        new Style({
          text: new TextStyle({
            textBaseline: 'top',
            text: 'test',
            scale: [2, 3],
          }),
        }),
        heightReference,
        vectorProperties,
      );
      expect(labelOptions?.scale).to.be.equal(2);
    });

    describe('fill and stroke settings', () => {
      let fillStyle: Fill;
      let strokeStyle: Stroke;
      let color: Color;

      before(() => {
        const olColor = [1, 0, 1, 0.5];
        fillStyle = new Fill({
          color: olColor,
        });
        color = getCesiumColor(olColor, [0, 0, 0, 1]);
        strokeStyle = new Stroke({
          color: olColor,
          width: 3,
        });
      });

      it('should set the fill labelStyle ', () => {
        labelOptions = getLabelOptions(
          feature,
          new Style({
            text: new TextStyle({
              text: 'test',
              fill: fillStyle,
            }),
          }),
          heightReference,
          vectorProperties,
        );
        expect(labelOptions?.style).to.be.equal(LabelStyle.FILL);
        expect(Color.equals(labelOptions!.fillColor!, color)).to.be.true;
        expect(labelOptions?.outlineWidth).to.be.undefined;
        expect(labelOptions?.outlineColor).to.be.undefined;
      });

      it('should set the stroke labelStyle ', () => {
        const style = new Style({
          text: new TextStyle({
            text: 'test',
            stroke: strokeStyle,
          }),
        });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        style.getText()?.setFill(); // has to be set to undefined, otherwise a default fill will be there
        labelOptions = getLabelOptions(
          feature,
          style,
          heightReference,
          vectorProperties,
        );
        expect(labelOptions?.style).to.be.equal(LabelStyle.OUTLINE);
        expect(Color.equals(labelOptions!.outlineColor!, color)).to.be.true;
        expect(labelOptions?.outlineWidth).to.be.equal(3);
      });

      it('should set the stroke and fill label style ', () => {
        labelOptions = getLabelOptions(
          feature,
          new Style({
            text: new TextStyle({
              text: 'test',
              stroke: strokeStyle,
              fill: fillStyle,
            }),
          }),
          heightReference,
          vectorProperties,
        );
        expect(labelOptions?.style).to.be.equal(LabelStyle.FILL_AND_OUTLINE);
        expect(Color.equals(labelOptions!.outlineColor!, color)).to.be.true;
        expect(labelOptions?.outlineWidth).to.be.equal(3);
        expect(Color.equals(labelOptions!.fillColor!, color)).to.be.true;
      });
    });

    describe('additional options', () => {
      before(() => {
        labelOptions = getLabelOptions(
          feature,
          new Style({
            text: new TextStyle({
              text: 'test',
            }),
          }),
          heightReference,
          vectorProperties,
        );
      });

      it('should set the eyeOffset', () => {
        expect(labelOptions?.eyeOffset).to.be.equal(vectorProperties.eyeOffset);
      });

      it('should set scaleByDistance', () => {
        expect(labelOptions?.scaleByDistance).to.be.equal(
          vectorProperties.scaleByDistance,
        );
      });

      it('should set heightReference', () => {
        expect(labelOptions?.heightReference).to.be.equal(heightReference);
      });

      it('should set the default pixelOffset', () => {
        const pixelOffset = new Cartesian2(0, 0);
        expect(labelOptions?.pixelOffset).to.be.instanceOf(Cartesian2);
        expect(Cartesian2.equals(labelOptions?.pixelOffset, pixelOffset)).to.be
          .true;
      });
    });
  });

  describe('getLineGeometries', () => {
    let wgs84Position: Coordinate;
    let position: Cartesian3;
    let lineGeometries: CesiumGeometryOption<'line'>[];

    before(() => {
      wgs84Position = [1, 1, 0];
      const heightInfo: VectorHeightInfo<HeightReference.NONE> = {
        heightReference: HeightReference.NONE,
        layout: 'XYZ',
        extruded: true,
        storeyHeightsAboveGround: [1, 2],
        storeyHeightsBelowGround: [1, 2],
        groundLevelOrMinHeight: 1,
        skirt: 1,
        perPositionHeight: false,
      };
      position = Cartesian3.fromDegrees(
        wgs84Position[0],
        wgs84Position[1],
        wgs84Position[2],
      );
      const style = new Style({
        stroke: new Stroke({
          width: 0,
        }),
      });
      lineGeometries = getLineGeometries(
        heightInfo,
        position,
        wgs84Position,
        style,
      );
    });

    it('should return an array of PolylineGeometries ', () => {
      expect(lineGeometries).to.be.an('array').and.have.length(1);
      lineGeometries.forEach((lineGeometry) => {
        expect(lineGeometry.geometry).to.be.instanceOf(PolylineGeometry);
      });
    });

    it('should use the given position and calculate the second point of the line based on the heightInfo', () => {
      lineGeometries.forEach((lineGeometry, index) => {
        // height corrected by skirt, and sum storeyHeightsBelowGround & storeyHeightsAboveGround
        const correctedCartesian = Cartesian3.fromDegrees(
          wgs84Position[0],
          wgs84Position[1],
          wgs84Position[2] - 7,
        );

        expect(lineGeometry.geometry)
          .to.have.property('_positions')
          .and.to.be.an('array');

        const positions = (
          lineGeometry.geometry as unknown as { _positions: Cartesian3[] }
        )._positions;
        expect(positions[0]).to.equal(position);
        expect(Cartesian3.equals(positions[1], correctedCartesian)).to.be.true;
      });
    });
  });

  describe('getPointPrimitives', () => {
    let feature: Feature;
    let geometry: Point;
    let vectorProperties: VectorProperties;
    let map: CesiumMap;
    let scene: Scene;
    let fillStyle: Fill;
    let regularShapeStyle: RegularShape;

    before(() => {
      const scope = nock('http://localhost');
      scope
        .persist()
        .get('/test.glb')
        .reply(200, {}, { 'Content-Type': 'application/json' });
      feature = new Feature({ id: 'myId' });
      fillStyle = new Fill({
        color: [1, 2, 3, 0.5],
      });
      regularShapeStyle = new RegularShape({
        radius: 1,
        points: 0,
        fill: fillStyle,
      });
      geometry = new Point([1, 1, 0]);
      vectorProperties = new VectorProperties({
        altitudeMode: 'absolute',
        eyeOffset: [1, 1, 1],
      });
      map = getCesiumMap();
      scene = map.getScene()!;
    });

    after(() => {
      nock.cleanAll();
      vectorProperties.destroy();
      map.destroy();
    });

    it('should create a billboard if an image style is provided', async () => {
      const items = await getPointPrimitives(
        feature,
        geometry,
        new Style({ image: regularShapeStyle }),
        vectorProperties,
        scene,
        getHeightInfo(feature, geometry, vectorProperties),
      );
      expect(items).to.have.lengthOf(1);
      expect(items[0].type).to.equal('billboard');
    });

    it('should create a label if an text style is provided', async () => {
      const items = await getPointPrimitives(
        feature,
        geometry,
        new Style({ text: new TextStyle({ text: 'test' }) }),
        vectorProperties,
        scene,
        getHeightInfo(feature, geometry, vectorProperties),
      );
      expect(items).to.have.lengthOf(1);
      expect(items[0].type).to.equal('label');
    });

    it('should create a linePrimitive if an extrusion and stroke style exists', async () => {
      const style = new Style({
        image: regularShapeStyle,
        stroke: new Stroke({ width: 1, color: [1, 1, 1] }),
      });
      const vectorPropertiesWithExtrusion = new VectorProperties({
        altitudeMode: 'absolute',
        eyeOffset: [1, 1, 1],
        extrudedHeight: 10,
      });
      const items = await getPointPrimitives(
        feature,
        geometry,
        style,
        vectorPropertiesWithExtrusion,
        scene,
        getHeightInfo(feature, geometry, vectorPropertiesWithExtrusion),
      );
      expect(items).to.have.lengthOf(2);
      expect(items.map((i) => i.type)).to.have.members(['billboard', 'line']);
      vectorPropertiesWithExtrusion.destroy();
    });

    it('should not create a linePrimitive if an extrusion and no stroke style exists', async () => {
      const style = new Style({ image: regularShapeStyle });
      const vectorPropertiesWithExtrusion = new VectorProperties({
        altitudeMode: 'absolute',
        eyeOffset: [1, 1, 1],
        extrudedHeight: 10,
      });
      const items = await getPointPrimitives(
        feature,
        geometry,
        style,
        vectorPropertiesWithExtrusion,
        scene,
        getHeightInfo(feature, geometry, vectorProperties),
      );
      expect(items).to.have.lengthOf(1);
      expect(items[0].type).to.equal('billboard');
      vectorPropertiesWithExtrusion.destroy();
    });

    describe('creating of models', () => {
      describe('of a normal model', () => {
        let modelVectorProperties: VectorProperties;

        before(() => {
          modelVectorProperties = new VectorProperties({
            modelUrl: 'http://localhost/test.glb',
          });
        });

        after(() => {
          modelVectorProperties.destroy();
        });

        it('should create a model, if a model is parameterized', async () => {
          const items = await getPointPrimitives(
            feature,
            geometry,
            new Style({
              image: regularShapeStyle,
              text: new TextStyle({ text: 'test' }),
            }),
            modelVectorProperties,
            scene,
            getHeightInfo(feature, geometry, modelVectorProperties),
          );
          expect(items).to.have.lengthOf(1);
          expect(items[0].type).to.equal('primitive');
        });
      });

      describe('of an extruded model', () => {
        let modelVectorProperties: VectorProperties;
        let style: Style;

        before(() => {
          modelVectorProperties = new VectorProperties({
            modelUrl: 'http://localhost/test.glb',
            extrudedHeight: 10,
          });
          style = new Style({
            image: regularShapeStyle,
            stroke: new Stroke({ width: 1, color: [1, 1, 1] }),
          });
        });

        after(() => {
          modelVectorProperties.destroy();
        });

        it('should create two primitives', async () => {
          const items = await getPointPrimitives(
            feature,
            geometry,
            style,
            modelVectorProperties,
            scene,
            getHeightInfo(feature, geometry, modelVectorProperties),
          );
          expect(items).to.have.lengthOf(2);
          expect(items.map((i) => i.type)).to.have.members([
            'primitive',
            'line',
          ]);
        });
      });

      describe('of an auto scaled model', () => {
        let modelVectorProperties: VectorProperties;

        before(() => {
          modelVectorProperties = new VectorProperties({
            modelUrl: 'http://localhost/test.glb',
            modelAutoScale: true,
          });
        });

        after(() => {
          modelVectorProperties.destroy();
        });

        it('should create a scaled model', async () => {
          const items = await getPointPrimitives(
            feature,
            geometry,
            new Style({ image: regularShapeStyle }),
            modelVectorProperties,
            scene,
            getHeightInfo(feature, geometry, modelVectorProperties),
          );
          expect(items).to.have.lengthOf(1);
          expect(items[0].type).to.equal('primitive');
          expect(items[0]).to.have.property('autoScale', true);
        });
      });

      describe('of an auto scaled extruded model', () => {
        let modelVectorProperties: VectorProperties;
        let style: Style;

        before(() => {
          modelVectorProperties = new VectorProperties({
            modelUrl: 'http://localhost/test.glb',
            modelAutoScale: true,
            extrudedHeight: 10,
          });
          style = new Style({
            image: regularShapeStyle,
            stroke: new Stroke({ width: 1, color: [1, 1, 1] }),
          });
        });

        after(() => {
          modelVectorProperties.destroy();
        });

        it('should create a scaled model', async () => {
          const items = await getPointPrimitives(
            feature,
            geometry,
            style,
            modelVectorProperties,
            scene,
            getHeightInfo(feature, geometry, modelVectorProperties),
          );
          expect(items).to.have.lengthOf(2);
          expect(items.map((i) => i.type)).to.have.members([
            'primitive',
            'line',
          ]);
          expect(items.find((i) => i.type === 'primitive')).to.have.property(
            'autoScale',
            true,
          );
        });
      });
    });

    describe('creating of primitives', () => {
      describe('of a normal primitive', () => {
        let primitiveVectorProperties: VectorProperties;

        before(() => {
          primitiveVectorProperties = new VectorProperties({
            primitiveOptions: {
              type: PrimitiveOptionsType.SPHERE,
              geometryOptions: {},
            },
          });
        });

        after(() => {
          primitiveVectorProperties.destroy();
        });

        it('should create a primitive, if a primitive is parameterized', async () => {
          const items = await getPointPrimitives(
            feature,
            geometry,
            new Style({ image: regularShapeStyle }),
            primitiveVectorProperties,
            scene,
            getHeightInfo(feature, geometry, primitiveVectorProperties),
          );
          expect(items).to.have.lengthOf(1);
        });
      });

      describe('of an extruded primitive', () => {
        let primitiveVectorProperties: VectorProperties;
        let style: Style;

        before(() => {
          primitiveVectorProperties = new VectorProperties({
            primitiveOptions: {
              type: PrimitiveOptionsType.SPHERE,
              geometryOptions: {},
            },
            extrudedHeight: 10,
          });
          style = new Style({
            image: regularShapeStyle,
            stroke: new Stroke({ width: 1, color: [1, 1, 1] }),
          });
        });

        after(() => {
          primitiveVectorProperties.destroy();
        });

        it('should create two primitives', async () => {
          const items = await getPointPrimitives(
            feature,
            geometry,
            style,
            primitiveVectorProperties,
            scene,
            getHeightInfo(feature, geometry, primitiveVectorProperties),
          );
          expect(items).to.have.lengthOf(2);
          expect(items.map((i) => i.type)).to.have.members([
            'primitive',
            'line',
          ]);
        });
      });

      describe('of an auto scaled primitive', () => {
        let primitiveVectorProperties: VectorProperties;

        before(() => {
          primitiveVectorProperties = new VectorProperties({
            primitiveOptions: {
              type: PrimitiveOptionsType.SPHERE,
              geometryOptions: {},
            },
            modelAutoScale: true,
          });
        });

        after(() => {
          primitiveVectorProperties.destroy();
        });

        it('should create a scaled primitive', async () => {
          const items = await getPointPrimitives(
            feature,
            geometry,
            new Style({ image: regularShapeStyle }),
            primitiveVectorProperties,
            scene,
            getHeightInfo(feature, geometry, primitiveVectorProperties),
          );
          expect(items).to.have.lengthOf(1);
          expect(items[0].type).to.equal('primitive');
        });
      });

      describe('of an auto scaled extruded primitive', () => {
        let primitiveVectorProperties: VectorProperties;
        let style: Style;

        before(() => {
          primitiveVectorProperties = new VectorProperties({
            primitiveOptions: {
              type: PrimitiveOptionsType.SPHERE,
              geometryOptions: {},
            },
            modelAutoScale: true,
            extrudedHeight: 10,
          });
          style = new Style({
            image: regularShapeStyle,
            stroke: new Stroke({ width: 1, color: [1, 1, 1] }),
          });
        });

        after(() => {
          primitiveVectorProperties.destroy();
        });

        it('should create a scaled primitive & line', async () => {
          const items = await getPointPrimitives(
            feature,
            geometry,
            style,
            primitiveVectorProperties,
            scene,
            getHeightInfo(feature, geometry, primitiveVectorProperties),
          );
          expect(items).to.have.lengthOf(2);
          expect(items.map((i) => i.type)).to.have.members([
            'primitive',
            'line',
          ]);
          expect(items.find((i) => i.type === 'primitive')).to.have.property(
            'autoScale',
            true,
          );
        });
      });
    });
  });
});
