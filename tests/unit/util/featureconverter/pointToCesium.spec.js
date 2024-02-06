import Point from 'ol/geom/Point.js';
import Polygon from 'ol/geom/Polygon.js';
import Feature from 'ol/Feature.js';
import Style from 'ol/style/Style.js';
import RegularShape from 'ol/style/RegularShape.js';
import TextStyle from 'ol/style/Text.js';
import Icon from 'ol/style/Icon.js';
import {
  HeightReference,
  VerticalOrigin,
  Cartesian3,
  Color,
  Cartesian2,
  HorizontalOrigin,
  Model,
  LabelStyle,
  PolylineGeometry,
  PrimitiveCollection,
  Billboard,
  Label,
  Primitive,
  SphereGeometry,
} from '@vcmap-cesium/engine';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import nock from 'nock';
import VectorProperties, {
  PrimitiveOptionsType,
} from '../../../../src/layer/vectorProperties.js';
import pointToCesium, {
  getCoordinates,
  validatePoint,
  getBillboardOptions,
  getLabelOptions,
  getCartesian3AndWGS84FromCoordinates,
  getLineGeometries,
} from '../../../../src/util/featureconverter/pointToCesium.js';
import { blackPixelURI } from '../../helpers/imageHelpers.js';
import { getCesiumColor } from '../../../../src/style/styleHelpers.js';
import Projection from '../../../../src/util/projection.js';
import VectorContext from '../../../../src/layer/cesium/vectorContext.js';
import { getCesiumMap } from '../../helpers/cesiumHelpers.js';

describe('util.featureConverter.pointToCesium', () => {
  describe('getCoordinates', () => {
    it('should return a array with the coordinates of all geometries', () => {
      const point = new Point([50, 50, 3]);
      const point2 = new Point([54, 54, 3]);
      const coordinates = getCoordinates([point, point2]);
      expect(coordinates.length).to.be.equal(2);
      expect(coordinates).to.have.deep.members([
        [50, 50, 3],
        [54, 54, 3],
      ]);
    });
  });

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
      const point = new Point(['asd']);
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
      expect(validatePoint(point)).to.be.false;
    });
  });

  describe('getBillboardOptions', () => {
    let feature;
    let heightReference;
    let vectorProperties;
    let billboardOptions;

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
      let regularShapeStyle;

      before(() => {
        regularShapeStyle = new Style({
          image: new RegularShape({
            scale: 23,
            opacity: 0.5,
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
        expect(billboardOptions.scale).to.be.equal(
          regularShapeStyle.getImage().getScale(),
        );
      });

      it('should set the given heightReference on the return Object', () => {
        expect(billboardOptions.heightReference).to.be.equal(heightReference);
      });

      it('should set the verticalOrigin to the default value VerticalOrigin.Bottom', () => {
        expect(billboardOptions.verticalOrigin).to.be.equal(
          VerticalOrigin.BOTTOM,
        );
      });

      it('should set the id to the id of the feature', () => {
        expect(billboardOptions.id).to.be.equal(feature.getId());
      });

      it('should set the eyeOffset', () => {
        expect(billboardOptions.eyeOffset).to.be.equal(
          vectorProperties.eyeOffset,
        );
      });

      it('should set scaleByDistance', () => {
        expect(billboardOptions.scaleByDistance).to.be.equal(
          vectorProperties.scaleByDistance,
        );
      });

      it('should set the image', () => {
        expect(billboardOptions.image).to.be.equal(
          regularShapeStyle.getImage().getImage(1),
        );
      });

      it('should set the opacity value of the style to the color alpha value', () => {
        expect(billboardOptions.color).to.be.instanceOf(Color);
        expect(billboardOptions.color.alpha).to.be.equal(
          regularShapeStyle.getImage().getOpacity(),
        );
      });

      it('should set scale to x scale when scale is an array', () => {
        billboardOptions = getBillboardOptions(
          feature,
          new Style({
            image: new RegularShape({
              textBaseline: 'top',
              text: 'test',
              scale: [2, 3],
            }),
          }),
          heightReference,
          vectorProperties,
        );
        expect(billboardOptions.scale).to.be.equal(2);
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
            imgSize: [1, 1],
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
        expect(billboardOptions.image).to.be.instanceOf(Promise);
      });
    });
  });

  describe('getLabelOptions', () => {
    let feature;
    let heightReference;
    let vectorProperties;
    let labelOptions;

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
      expect(labelOptions.text).to.be.equal('test');
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
      expect(labelOptions.font).to.be.undefined;
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
      expect(labelOptions.font).to.be.equal('arial');
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
      expect(labelOptions.horizontalOrigin).to.be.equal(
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
      expect(labelOptions.horizontalOrigin).to.be.equal(HorizontalOrigin.LEFT);
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
      expect(labelOptions.verticalOrigin).to.be.equal(VerticalOrigin.BASELINE);
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
      expect(labelOptions.verticalOrigin).to.be.equal(VerticalOrigin.TOP);
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
      expect(labelOptions.scale).to.be.equal(2);
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
      expect(labelOptions.scale).to.be.equal(2);
    });

    describe('fill and stroke settings', () => {
      let fillStyle;
      let strokeStyle;
      let color;

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
        expect(labelOptions.style).to.be.equal(LabelStyle.FILL);
        expect(Color.equals(labelOptions.fillColor, color)).to.be.true;
        expect(labelOptions.outlineWidth).to.be.undefined;
        expect(labelOptions.outlineColor).to.be.undefined;
      });

      it('should set the stroke labelStyle ', () => {
        const style = new Style({
          text: new TextStyle({
            text: 'test',
            stroke: strokeStyle,
          }),
        });
        style.getText().setFill(); // has to be set to undefined, otherwise a default fill will be there
        labelOptions = getLabelOptions(
          feature,
          style,
          heightReference,
          vectorProperties,
        );
        expect(labelOptions.style).to.be.equal(LabelStyle.OUTLINE);
        expect(Color.equals(labelOptions.outlineColor, color)).to.be.true;
        expect(labelOptions.outlineWidth).to.be.equal(3);
      });

      it('should set the stroke and fill labelstyle ', () => {
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
        expect(labelOptions.style).to.be.equal(LabelStyle.FILL_AND_OUTLINE);
        expect(Color.equals(labelOptions.outlineColor, color)).to.be.true;
        expect(labelOptions.outlineWidth).to.be.equal(3);
        expect(Color.equals(labelOptions.fillColor, color)).to.be.true;
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
        expect(labelOptions.eyeOffset).to.be.equal(vectorProperties.eyeOffset);
      });

      it('should set scaleByDistance', () => {
        expect(labelOptions.scaleByDistance).to.be.equal(
          vectorProperties.scaleByDistance,
        );
      });

      it('should set heightReference', () => {
        expect(labelOptions.heightReference).to.be.equal(heightReference);
      });

      it('should set the default pixelOffset', () => {
        const pixelOffset = new Cartesian2(0, 0);
        expect(labelOptions.pixelOffset).to.be.instanceOf(Cartesian2);
        expect(Cartesian2.equals(labelOptions.pixelOffset, pixelOffset)).to.be
          .true;
      });
    });
  });

  describe('getCartesian3AndWGS84FromCoordinates', () => {
    let coordinates;
    let coordinatesWGS84;
    let coordinatesCartesian3;
    let heightInfo;
    let wgs84Positions;
    let positions;

    describe('relativeToGround HeightReference', () => {
      before(() => {
        coordinates = [
          [0, 1, 0],
          [0, 2, 0],
        ];
        coordinatesWGS84 = coordinates.map((coord) =>
          Projection.mercatorToWgs84(coord),
        );
        coordinatesCartesian3 = coordinatesWGS84.map((coord) =>
          Cartesian3.fromDegrees(coord[0], coord[1], 4),
        );
        heightInfo = {
          extruded: true,
          storeysAboveGround: 2,
          storeysBelowGround: 2,
          storeyHeightsAboveGround: [1, 2],
          storeyHeightsBelowGround: [1, 2],
          groundLevel: 1,
          skirt: 1,
          perPositionHeight: 1,
          heightReference: HeightReference.RELATIVE_TO_GROUND,
          heightAboveGroundAdjustment: 1,
        };
        ({ wgs84Positions, positions } = getCartesian3AndWGS84FromCoordinates(
          coordinates.slice(),
          heightInfo,
        ));
      });

      it('should return wgs84Positions and Positions array of length 2', () => {
        expect(wgs84Positions).to.be.an('array').and.have.length(2);
        expect(positions).to.be.an('array').and.have.length(2);
      });

      it('should return correct cartesian3 positions with the heightAboveGround adjustment', () => {
        positions.forEach((pos, index) => {
          expect(pos).to.be.instanceOf(Cartesian3);
          expect(Cartesian3.equals(pos, coordinatesCartesian3[index])).to.be
            .true;
        });
      });

      it('should return correct wgs84positions', () => {
        expect(wgs84Positions).to.have.deep.members(coordinatesWGS84);
      });
    });

    describe('other HeightReference', () => {
      before(() => {
        coordinates = [
          [0, 1, 0],
          [0, 2, 0],
        ];
        coordinatesWGS84 = coordinates.map((coord) =>
          Projection.mercatorToWgs84(coord),
        );
        // height adjusted by groundlevel + sum(storeyHeightsAboveGround)
        coordinatesCartesian3 = coordinatesWGS84.map((coord) =>
          Cartesian3.fromDegrees(coord[0], coord[1], 4),
        );
        heightInfo = {
          extruded: false,
          storeysAboveGround: 2,
          storeysBelowGround: 2,
          storeyHeightsAboveGround: [1, 2],
          storeyHeightsBelowGround: [1, 2],
          groundLevel: 1,
          skirt: 1,
          perPositionHeight: false,
          heightReference: HeightReference.NONE,
        };
        ({ wgs84Positions, positions } = getCartesian3AndWGS84FromCoordinates(
          coordinates.slice(),
          heightInfo,
        ));
      });

      it('should return wgs84Positions and Positions array of length 2', () => {
        expect(wgs84Positions).to.be.an('array').and.have.length(2);
        expect(positions).to.be.an('array').and.have.length(2);
      });

      it('should return correct cartesian3 positions', () => {
        positions.forEach((pos, index) => {
          expect(pos).to.be.instanceOf(Cartesian3);
          expect(Cartesian3.equals(pos, coordinatesCartesian3[index])).to.be
            .true;
        });
      });

      it('should return correct wgs84positions', () => {
        expect(wgs84Positions).to.have.deep.members(coordinatesWGS84);
      });
    });
  });

  describe('getLineGeometries', () => {
    let wgs84Positions;
    let heightInfo;
    let positions;
    let style;
    let lineGeometries;

    before(() => {
      wgs84Positions = [
        [1, 1, 0],
        [1, 2, 0],
      ];
      heightInfo = {
        extruded: true,
        storeysAboveGround: 2,
        storeysBelowGround: 2,
        storeyHeightsAboveGround: [1, 2],
        storeyHeightsBelowGround: [1, 2],
        groundLevel: 1,
        skirt: 1,
        perPositionHeight: false,
      };
      positions = wgs84Positions.map((pos) => Cartesian3.fromDegrees(...pos));
      style = new Style({
        stroke: new Stroke({
          width: 0,
        }),
      });
      lineGeometries = getLineGeometries(
        wgs84Positions,
        heightInfo,
        positions,
        style,
      );
    });

    it('should return an array of PolylineGeometries ', () => {
      expect(lineGeometries).to.be.an('array').and.have.length(2);
      lineGeometries.forEach((lineGeometry) => {
        expect(lineGeometry).to.be.instanceOf(PolylineGeometry);
      });
    });

    it('should use the given position and calculate the second point of the line based on the heightInfo', () => {
      lineGeometries.forEach((lineGeometry, index) => {
        expect(lineGeometry._positions).to.be.an('array');
        expect(lineGeometry._positions[0]).to.be.equal(positions[index]);
        // height corrected by skirt, and sum storeyHeightsBelowGround
        const correctedCartesian = Cartesian3.fromDegrees(
          wgs84Positions[index][0],
          wgs84Positions[index][1],
          wgs84Positions[index][2] - 4,
        );
        expect(
          Cartesian3.equals(lineGeometry._positions[1], correctedCartesian),
        ).to.be.true;
      });
    });
  });

  describe('pointToCesium', () => {
    let feature;
    let emptyStyle;
    let geometries;
    let vectorProperties;
    let map;
    let scene;
    let primitiveCollection;
    let context;
    let fillStyle;
    let regularShapeStyle;

    before(() => {
      const scope = nock('http://localhost');
      scope
        .persist()
        .get('/test.glb')
        .reply(200, {}, { 'Content-Type': 'application/json' });
      feature = new Feature({ id: 'myId' });
      emptyStyle = new Style({});
      fillStyle = new Fill({
        color: [1, 2, 3, 0.5],
      });
      regularShapeStyle = new RegularShape({
        fill: fillStyle,
      });
      geometries = [new Point([1, 1, 0])];
      vectorProperties = new VectorProperties({
        altitudeMode: 'absolute',
        eyeOffset: [1, 1, 1],
      });
      map = getCesiumMap();
      scene = map.getScene();
      primitiveCollection = new PrimitiveCollection();
      context = new VectorContext(map, primitiveCollection);
    });

    afterEach(() => {
      context.clear();
    });

    after(() => {
      nock.cleanAll();
      context.destroy();
      primitiveCollection.destroy();
      vectorProperties.destroy();
      map.destroy();
    });

    it('should return if no image, or text style is given ', async () => {
      await pointToCesium(
        feature,
        emptyStyle,
        geometries,
        vectorProperties,
        scene,
        context,
      );
      expect(context.featureToPrimitiveMap.size).to.be.equal(0);
      expect(context.featureToBillboardMap.size).to.be.equal(0);
      expect(context.featureToLabelMap.size).to.be.equal(0);
    });

    it('should create a billboard if an image style is provided', async () => {
      await pointToCesium(
        feature,
        new Style({ image: regularShapeStyle }),
        geometries,
        vectorProperties,
        scene,
        context,
      );
      expect(context.billboards.length).to.equal(1);
      expect(context.featureToBillboardMap.size).to.be.equal(1);
      expect(context.billboards.get(0)).to.be.instanceOf(Billboard);
      expect(context.featureToPrimitiveMap.size).to.be.equal(0);
    });

    it('should create a label if an text style is provided', async () => {
      await pointToCesium(
        feature,
        new Style({ text: new TextStyle({ text: 'test' }) }),
        geometries,
        vectorProperties,
        scene,
        context,
      );
      expect(context.featureToLabelMap.size).to.be.equal(1);
      expect(context.labels.length).to.equal(1);
      expect(context.labels.get(0)).to.be.instanceOf(Label);
      expect(context.featureToPrimitiveMap.size).to.be.equal(0);
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
      await pointToCesium(
        feature,
        style,
        geometries,
        vectorPropertiesWithExtrusion,
        scene,
        context,
      );
      expect(context.billboards.length).to.equal(1);
      expect(context.featureToBillboardMap.size).to.be.equal(1);
      expect(context.billboards.get(0)).to.be.instanceOf(Billboard);
      expect(context.featureToPrimitiveMap.size).to.be.equal(1);
      expect(context.primitives.length).to.be.equal(1);
      expect(context.primitives.get(0)).to.be.instanceOf(Primitive);
      vectorPropertiesWithExtrusion.destroy();
    });

    it('should not create a linePrimitive if an extrusion and no stroke style exists', async () => {
      const style = new Style({ image: regularShapeStyle });
      const vectorPropertiesWithExtrusion = new VectorProperties({
        altitudeMode: 'absolute',
        eyeOffset: [1, 1, 1],
        extrudedHeight: 10,
      });
      await pointToCesium(
        feature,
        style,
        geometries,
        vectorPropertiesWithExtrusion,
        scene,
        context,
      );
      expect(context.billboards.length).to.equal(1);
      expect(context.featureToBillboardMap.size).to.be.equal(1);
      expect(context.billboards.get(0)).to.be.instanceOf(Billboard);
      expect(context.featureToPrimitiveMap.size).to.be.equal(0);
      vectorPropertiesWithExtrusion.destroy();
    });

    describe('creating of models', () => {
      describe('of a normal model', () => {
        let modelVectorProperties;

        before(() => {
          modelVectorProperties = new VectorProperties({
            modelUrl: 'http://localhost/test.glb',
          });
        });

        after(() => {
          modelVectorProperties.destroy();
        });

        it('should create a model, if a model is parameterized', async () => {
          await pointToCesium(
            feature,
            new Style({ image: regularShapeStyle }),
            geometries,
            modelVectorProperties,
            scene,
            context,
          );
          expect(context.featureToPrimitiveMap.size).to.be.equal(1);
          expect(context.primitives.get(0)).to.be.an.instanceOf(Model);
        });

        it('should not create a billboard, if creating a model', async () => {
          await pointToCesium(
            feature,
            new Style({ image: regularShapeStyle }),
            geometries,
            modelVectorProperties,
            scene,
            context,
          );
          expect(context.billboards.length).to.equal(0);
          expect(context.featureToBillboardMap.size).to.be.equal(0);
        });

        it('should not create a label, if creating a model', async () => {
          await pointToCesium(
            feature,
            new Style({ text: new TextStyle({ text: 'test' }) }),
            geometries,
            modelVectorProperties,
            scene,
            context,
          );
          expect(context.featureToLabelMap.size).to.be.equal(0);
          expect(context.labels.length).to.equal(0);
        });
      });

      describe('of an extruded model', () => {
        let modelVectorProperties;
        let style;

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
          await pointToCesium(
            feature,
            style,
            geometries,
            modelVectorProperties,
            scene,
            context,
          );
          expect(context.primitives.length).to.be.equal(2);
        });

        it('should create a model', async () => {
          await pointToCesium(
            feature,
            style,
            geometries,
            modelVectorProperties,
            scene,
            context,
          );
          expect(context.featureToPrimitiveMap.size).to.be.equal(1);
          expect(context.primitives.get(1)).to.be.an.instanceOf(Model);
        });

        it('should create a linePrimitive', async () => {
          await pointToCesium(
            feature,
            style,
            geometries,
            modelVectorProperties,
            scene,
            context,
          );
          expect(context.featureToPrimitiveMap.size).to.be.equal(1);
          expect(context.primitives.get(0)).to.be.instanceOf(Primitive);
        });

        it('should not create a billboard, if creating a model', async () => {
          await pointToCesium(
            feature,
            new Style({ image: regularShapeStyle }),
            geometries,
            modelVectorProperties,
            scene,
            context,
          );
          expect(context.billboards.length).to.equal(0);
          expect(context.featureToBillboardMap.size).to.be.equal(0);
        });

        it('should not create a label, if creating a model', async () => {
          await pointToCesium(
            feature,
            new Style({ text: new TextStyle({ text: 'test' }) }),
            geometries,
            modelVectorProperties,
            scene,
            context,
          );
          expect(context.featureToLabelMap.size).to.be.equal(0);
          expect(context.labels.length).to.equal(0);
        });
      });

      describe('of an auto scaled model', () => {
        let modelVectorProperties;

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
          await pointToCesium(
            feature,
            new Style({ image: regularShapeStyle }),
            geometries,
            modelVectorProperties,
            scene,
            context,
          );
          expect(context.featureToScaledPrimitiveMap.size).to.be.equal(1);
          expect(context.scaledPrimitives.get(0)).to.be.an.instanceOf(Model);
        });

        it('should not create a billboard, if creating a model', async () => {
          await pointToCesium(
            feature,
            new Style({ image: regularShapeStyle }),
            geometries,
            modelVectorProperties,
            scene,
            context,
          );
          expect(context.billboards.length).to.equal(0);
          expect(context.featureToBillboardMap.size).to.be.equal(0);
        });

        it('should not create a label, if creating a model', async () => {
          await pointToCesium(
            feature,
            new Style({ text: new TextStyle({ text: 'test' }) }),
            geometries,
            modelVectorProperties,
            scene,
            context,
          );
          expect(context.featureToLabelMap.size).to.be.equal(0);
          expect(context.labels.length).to.equal(0);
        });
      });

      describe('of an auto scaled extruded model', () => {
        let modelVectorProperties;
        let style;

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
          await pointToCesium(
            feature,
            style,
            geometries,
            modelVectorProperties,
            scene,
            context,
          );
          expect(context.featureToScaledPrimitiveMap.size).to.be.equal(1);
          expect(context.scaledPrimitives.get(0)).to.be.an.instanceOf(Model);
        });

        it('should create a linePrimitive', async () => {
          await pointToCesium(
            feature,
            style,
            geometries,
            modelVectorProperties,
            scene,
            context,
          );
          expect(context.featureToPrimitiveMap.size).to.be.equal(1);
          expect(context.primitives.get(0)).to.be.instanceOf(Primitive);
        });

        it('should not create a billboard, if creating a model', async () => {
          await pointToCesium(
            feature,
            style,
            geometries,
            modelVectorProperties,
            scene,
            context,
          );
          expect(context.billboards.length).to.equal(0);
          expect(context.featureToBillboardMap.size).to.be.equal(0);
        });

        it('should not create a label, if creating a model', async () => {
          await pointToCesium(
            feature,
            new Style({ text: new TextStyle({ text: 'test' }) }),
            geometries,
            modelVectorProperties,
            scene,
            context,
          );
          expect(context.featureToLabelMap.size).to.be.equal(0);
          expect(context.labels.length).to.equal(0);
        });
      });
    });

    describe('creating of primitives', () => {
      describe('of a normal primitive', () => {
        let primitiveVectorProperties;

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
          await pointToCesium(
            feature,
            new Style({ image: regularShapeStyle }),
            geometries,
            primitiveVectorProperties,
            scene,
            context,
          );
          expect(context.featureToPrimitiveMap.size).to.be.equal(1);
          expect(context.primitives.get(0)).to.be.an.instanceOf(Primitive);
        });

        it('should not create a billboard, if creating a primitive', async () => {
          await pointToCesium(
            feature,
            new Style({ image: regularShapeStyle }),
            geometries,
            primitiveVectorProperties,
            scene,
            context,
          );
          expect(context.billboards.length).to.equal(0);
          expect(context.featureToBillboardMap.size).to.be.equal(0);
        });

        it('should not create a label, if creating a primitive', async () => {
          await pointToCesium(
            feature,
            new Style({
              image: regularShapeStyle,
              text: new TextStyle({ text: 'test' }),
            }),
            geometries,
            primitiveVectorProperties,
            scene,
            context,
          );
          expect(context.featureToLabelMap.size).to.be.equal(0);
          expect(context.labels.length).to.equal(0);
        });
      });

      describe('of an extruded primitive', () => {
        let primitiveVectorProperties;
        let style;

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
          await pointToCesium(
            feature,
            style,
            geometries,
            primitiveVectorProperties,
            scene,
            context,
          );
          expect(context.primitives.length).to.be.equal(2);
        });

        it('should create the primitive', async () => {
          await pointToCesium(
            feature,
            style,
            geometries,
            primitiveVectorProperties,
            scene,
            context,
          );
          expect(context.featureToPrimitiveMap.size).to.be.equal(1);
          expect(context.primitives.get(1)).to.be.an.instanceOf(Primitive);
          expect(
            context.primitives.get(1).geometryInstances[0].geometry,
          ).to.be.an.instanceOf(SphereGeometry);
        });

        it('should create a linePrimitive', async () => {
          await pointToCesium(
            feature,
            style,
            geometries,
            primitiveVectorProperties,
            scene,
            context,
          );
          expect(context.featureToPrimitiveMap.size).to.be.equal(1);
          expect(context.primitives.get(0)).to.be.instanceOf(Primitive);
        });

        it('should not create a billboard, if creating a primitive', async () => {
          await pointToCesium(
            feature,
            new Style({ image: regularShapeStyle }),
            geometries,
            primitiveVectorProperties,
            scene,
            context,
          );
          expect(context.billboards.length).to.equal(0);
          expect(context.featureToBillboardMap.size).to.be.equal(0);
        });

        it('should not create a label, if creating a primitive', async () => {
          await pointToCesium(
            feature,
            new Style({
              image: regularShapeStyle,
              text: new TextStyle({ text: 'test' }),
            }),
            geometries,
            primitiveVectorProperties,
            scene,
            context,
          );
          expect(context.featureToLabelMap.size).to.be.equal(0);
          expect(context.labels.length).to.equal(0);
        });
      });

      describe('of an auto scaled primitive', () => {
        let primitiveVectorProperties;

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
          await pointToCesium(
            feature,
            new Style({ image: regularShapeStyle }),
            geometries,
            primitiveVectorProperties,
            scene,
            context,
          );
          expect(context.featureToScaledPrimitiveMap.size).to.be.equal(1);
          expect(context.scaledPrimitives.get(0)).to.be.an.instanceOf(
            Primitive,
          );
        });

        it('should not create a billboard, if creating a primitive', async () => {
          await pointToCesium(
            feature,
            new Style({ image: regularShapeStyle }),
            geometries,
            primitiveVectorProperties,
            scene,
            context,
          );
          expect(context.billboards.length).to.equal(0);
          expect(context.featureToBillboardMap.size).to.be.equal(0);
        });

        it('should not create a label, if creating a primitive', async () => {
          await pointToCesium(
            feature,
            new Style({
              image: regularShapeStyle,
              text: new TextStyle({ text: 'test' }),
            }),
            geometries,
            primitiveVectorProperties,
            scene,
            context,
          );
          expect(context.featureToLabelMap.size).to.be.equal(0);
          expect(context.labels.length).to.equal(0);
        });
      });

      describe('of an auto scaled extruded primitive', () => {
        let primitiveVectorProperties;
        let style;

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

        it('should create a scaled primitive', async () => {
          await pointToCesium(
            feature,
            style,
            geometries,
            primitiveVectorProperties,
            scene,
            context,
          );
          expect(context.featureToScaledPrimitiveMap.size).to.be.equal(1);
          expect(context.scaledPrimitives.get(0)).to.be.an.instanceOf(
            Primitive,
          );
        });

        it('should create a linePrimitive', async () => {
          await pointToCesium(
            feature,
            style,
            geometries,
            primitiveVectorProperties,
            scene,
            context,
          );
          expect(context.featureToPrimitiveMap.size).to.be.equal(1);
          expect(context.primitives.get(0)).to.be.instanceOf(Primitive);
        });

        it('should not create a billboard, if creating a primitive', async () => {
          await pointToCesium(
            feature,
            style,
            geometries,
            primitiveVectorProperties,
            scene,
            context,
          );
          expect(context.billboards.length).to.equal(0);
          expect(context.featureToBillboardMap.size).to.be.equal(0);
        });

        it('should not create a label, if creating a primitive', async () => {
          await pointToCesium(
            feature,
            new Style({
              image: regularShapeStyle,
              text: new TextStyle({ text: 'test' }),
            }),
            geometries,
            primitiveVectorProperties,
            scene,
            context,
          );
          expect(context.featureToLabelMap.size).to.be.equal(0);
          expect(context.labels.length).to.equal(0);
        });
      });
    });

    describe('priority of model vs. primitive', () => {
      it('should create a model, if the model is defined on the feature, even if a primitive is defined on the vector properties', async () => {
        const modelFeature = new Feature({
          id: 'foo',
          olcs_modelUrl: 'http://localhost/test.glb',
        });
        const primitiveVectorProperties = new VectorProperties({
          primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
          },
        });
        await pointToCesium(
          modelFeature,
          new Style({ image: regularShapeStyle }),
          geometries,
          primitiveVectorProperties,
          scene,
          context,
        );
        primitiveVectorProperties.destroy();
        expect(context.featureToPrimitiveMap.size).to.be.equal(1);
        expect(context.primitives.get(0)).to.be.an.instanceOf(Model);
      });

      it('should create a primitive, if the primitive is defined on the feature, even if a model is defined on the vector properties', async () => {
        const primitiveFeature = new Feature({
          id: 'foo',
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
          },
        });
        const modelVectorProperties = new VectorProperties({
          modelUrl: 'http://localhost/test.glb',
        });
        await pointToCesium(
          primitiveFeature,
          new Style({ image: regularShapeStyle }),
          geometries,
          modelVectorProperties,
          scene,
          context,
        );
        modelVectorProperties.destroy();
        expect(context.featureToPrimitiveMap.size).to.be.equal(1);
        expect(context.primitives.get(0)).to.be.an.instanceOf(Primitive);
      });

      it('should create a model, if both model and primitive are defined on the vector properties', async () => {
        const primitiveAndModelVectorProperties = new VectorProperties({
          modelUrl: 'http://localhost/test.glb',
          primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {},
          },
        });
        await pointToCesium(
          feature,
          new Style({ image: regularShapeStyle }),
          geometries,
          primitiveAndModelVectorProperties,
          scene,
          context,
        );
        primitiveAndModelVectorProperties.destroy();
        expect(context.featureToPrimitiveMap.size).to.be.equal(1);
        expect(context.primitives.get(0)).to.be.an.instanceOf(Model);
      });
    });
  });
});
