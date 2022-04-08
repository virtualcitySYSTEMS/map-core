/* eslint-disable no-template-curly-in-string,mocha/no-setup-in-describe */
import Circle from 'ol/style/Circle.js';
import Stroke from 'ol/style/Stroke.js';
import Fill from 'ol/style/Fill.js';
import Icon from 'ol/style/Icon.js';
import OpenlayersText from 'ol/style/Text.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import MultiLineString from 'ol/geom/MultiLineString.js';
import LineString from 'ol/geom/LineString.js';
import MultiPolygon from 'ol/geom/MultiPolygon.js';
import Polygon from 'ol/geom/Polygon.js';
import DeclarativeStyleItem from '../../../src/style/declarativeStyleItem.js';
import { originalFeatureSymbol } from '../../../src/layer/vectorSymbols.js';

describe('DeclarativeStyleItem', () => {
  /** @type {import("@vcmap/core").DeclarativeStyleItem} */
  let DSI;

  describe('constructor', () => {
    it('should always add a show property to the cesiumStyle', async () => {
      DSI = new DeclarativeStyleItem({});
      await DSI.cesiumStyle.readyPromise;
      expect(DSI).to.have.property('cesiumStyle')
        .and.to.have.property('show');

      expect(DSI.cesiumStyle.show.evaluate(new Feature())).to.be.true;
      DSI.destroy();
    });
  });

  describe('.style', () => {
    beforeEach(async () => {
      DSI = new DeclarativeStyleItem({
        declarativeStyle: {
          defines: {
            hasExtrusion: 'Number(${olcs_extrudedHeight}) > 0',
          },
          color: {
            conditions: [
              ['Boolean(${noFill})===true', 'false'],
              ['${class} === "up"', 'color("#FF0000") * vec4(1, 1, 1, ${hasExtrusion} ? 0.5 : 1.0)'],
              ['${class} === "middle"', 'color("#00FF00") * vec4(1, 1, 1, ${hasExtrusion} ? 0.5 : 1.0)'],
              ['${class} === "down"', 'color("#0000FF") * vec4(1, 1, 1, ${hasExtrusion} ? 0.5 : 1.0)'],
              ['${image} === "sensor"', 'color("#FF00FF")'],
              ['${image} === "marker"', 'color("#00FFFF")'],
              ['true', 'color("#FFFFFF")'],
            ],
          },
          labelText: '${pegel}',
          labelColor: {
            conditions: [
              ['${pegel} > 3.5', 'color("#FF0000")'],
              ['${pegel} > 3', 'color("#00FF00")'],
              ['${pegel} <= 3', 'color("#0000FF")'],
            ],
          },
          strokeColor: {
            conditions: [
              ['${image} === "sensor"', 'color("#FF00FF")'],
              ['${image} === "marker"', 'color("#00FFFF")'],
              ['true', 'color("#000000")'],
            ],
          },
          strokeWidth: '2',
          pointSize: {
            conditions: [
              ['Boolean(${pointSize})===true', '${pointSize}'],
              ['true', 'false'],
            ],
          },
          pointOutlineColor: {
            conditions: [
              ['Boolean(${image})===true', 'color("#00FF00")'],
            ],
          },
          pointOutlineWidth: {
            conditions: [
              ['Boolean(${pointWidth})===true', '${pointWidth}'],
              ['true', 'false'],
            ],
          },
          scale: {
            conditions: [
              ['Boolean(${scale})===true', '${scale}'],
              ['true', '1'],
            ],
          },
        },
      });
      await DSI.cesiumStyle.readyPromise;
    });

    afterEach(() => {
      DSI.destroy();
    });

    function polygonTests(description, getFeature) {
      describe(description, () => {
        let feature;
        beforeEach(() => {
          feature = getFeature();
        });

        it('should set color as fill', () => {
          const style = DSI.style(feature, 1);
          expect(style.getFill()).to.be.an.instanceOf(Fill);
          expect(style.getFill().getColor()).to.have.members([255, 0, 0, 1]);
        });

        it('should set the stroke', () => {
          const style = DSI.style(feature, 1);
          expect(style.getStroke()).to.be.an.instanceOf(Stroke);
          expect(style.getStroke().getColor()).to.have.members([0, 0, 0, 1]);
          expect(style.getStroke().getWidth()).to.equal(2);
        });

        it('should only set stroke, if the color evaluates to false', () => {
          feature.set('noFill', true);
          const style = DSI.style(feature, 1);
          expect(style.getFill()).to.be.null;
          expect(style.getStroke()).to.be.an.instanceOf(Stroke);
        });
      });
    }
    polygonTests('Polygon', () => new Feature({
      geometry: new Polygon([[[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]]),
      class: 'up',
    }));
    polygonTests('MultiPolygon', () => new Feature({
      geometry: new MultiPolygon([[[[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]]]),
      class: 'up',
    }));

    function lineTests(description, getFeature) {
      describe(description, () => {
        let feature;
        beforeEach(() => {
          feature = getFeature();
        });

        it('should set the color as stroke', () => {
          const style = DSI.style(feature, 1);
          expect(style.getFill()).to.be.null;
          expect(style.getStroke()).to.be.an.instanceOf(Stroke);
          expect(style.getStroke().getColor()).to.have.members([0, 0, 255, 1]);
          expect(style.getStroke().getWidth()).to.equal(2);
        });

        it('should set the color as fill, if the line is extruded', () => {
          feature.set('olcs_storeyHeight', 1);
          feature.set('olcs_storeyNumber', 1);
          const style = DSI.style(feature, 1);
          expect(style.getFill()).to.be.an.instanceOf(Fill);
          expect(style.getFill().getColor()).to.have.members([0, 0, 255, 1]);
        });

        it('should set the strokeColor as stroke, if extruded', () => {
          feature.set('olcs_extrudedHeight', 1);
          const style = DSI.style(feature, 1);
          expect(style.getStroke()).to.be.an.instanceOf(Stroke);
          expect(style.getStroke().getColor()).to.have.members([0, 0, 0, 1]);
          expect(style.getStroke().getWidth()).to.equal(2);
        });
      });
    }
    lineTests('LineString', () => new Feature({
      geometry: new LineString([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]),
      class: 'down',
    }));
    lineTests('MultiLineString', () => new Feature({
      geometry: new MultiLineString([[[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]]),
      class: 'down',
    }));

    function pointTestShape(description, getFeature) {
      describe(description, () => {
        let feature;
        beforeEach(() => {
          feature = getFeature();
        });

        it('should set the color as the circle color', () => {
          const style = DSI.style(feature, 1);
          expect(style.getFill()).to.be.null;
          expect(style.getImage()).to.be.an.instanceOf(Circle);
          expect(style.getImage().getFill().getColor()).to.have.members([0, 255, 255, 1]);
        });

        it('should set the stroke as stroke', () => {
          const style = DSI.style(feature, 1);
          expect(style.getStroke()).to.be.an.instanceOf(Stroke);
          expect(style.getStroke().getColor()).to.have.members([0, 255, 255, 1]);
          expect(style.getStroke().getWidth()).to.equal(2);
        });

        it('should set the pointOutlineColor if there is a width', () => {
          feature.set('pointWidth', 2);
          const style = DSI.style(feature, 1);
          expect(style.getImage()).to.be.an.instanceOf(Circle);
          expect(style.getImage().getStroke().getColor()).to.have.members([0, 255, 0, 1]);
          expect(style.getImage().getStroke().getWidth()).to.equal(2);
        });

        it('should set the cesium default style', () => {
          const newFeature = new Feature();
          newFeature.setGeometry(feature.getGeometry());
          const style = DSI.style(newFeature, 1);
          expect(style.getImage()).to.be.instanceOf(Circle);
          expect(style.getImage().getFill().getColor()).to.be.have.members([255, 255, 255, 1]);
          expect(style.getImage().getStroke()).to.be.null;
        });

        it('should set a label', () => {
          feature.set('pegel', 2);
          const style = DSI.style(feature, 1);
          expect(style.getText()).to.be.an.instanceOf(OpenlayersText);
          expect(style.getText().getText()).to.equal('2');
        });

        it('should set a label color', () => {
          feature.set('pegel', 2);
          const style = DSI.style(feature, 1);
          expect(style.getText()).to.be.an.instanceOf(OpenlayersText);
          expect(style.getText().getFill().getColor()).to.have.members([255, 0, 0, 1]);
        });

        it('should set the radius based on a point size & outlineWidth', () => {
          feature.set('pointSize', 10);
          feature.set('pointWidth', 2);
          const style = DSI.style(feature, 1);
          expect(style.getImage()).to.be.an.instanceOf(Circle);
          expect(style.getImage().getRadius()).to.equal(6);
        });

        it('should scale the image based on a scale', () => {
          feature.set('scale', 6);
          const style = DSI.style(feature, 1);
          expect(style.getImage().getScale()).to.equal(6);
        });

        it('should cache the circle and reuse on same style', () => {
          const style1 = DSI.style(feature, 1);
          const style2 = DSI.style(feature, 1);
          expect(style1.getImage()).to.be.equal(style2.getImage());
        });

        it('should cache the circle and reuse on same style for different features', () => {
          const style1 = DSI.style(feature, 1);
          const feature2 = feature.clone();
          const style2 = DSI.style(feature2, 1);
          expect(style1.getImage()).to.be.equal(style2.getImage());
        });

        it('should not cache the circle if the style is different', () => {
          const style1 = DSI.style(feature, 1);
          const feature2 = feature.clone();
          feature2.set('image', 'sensor');
          const style2 = DSI.style(feature2, 1);
          expect(style1.getImage()).to.not.be.equal(style2.getImage());
        });
      });
    }
    const getPoint = () => new Feature({
      geometry: new Point([0, 0, 1], 'XYZ'),
      image: 'marker',
    });
    const getMultiPoint = () => new Feature({
      geometry: new Point([0, 0, 1], 'XYZ'),
      image: 'marker',
    });
    pointTestShape('Point - Circle', getPoint);
    pointTestShape('MultiPoint - Circle', getMultiPoint);

    function pointTestImage(description, getFeature) {
      describe(description, () => {
        let feature;
        beforeEach(async () => {
          feature = getFeature();
          DSI = new DeclarativeStyleItem({
            declarativeStyle: {
              image: '${src}',
              color: 'color("#FF00FF")',
              scale: {
                conditions: [
                  ['Boolean(${scale})===true', '${scale}'],
                  ['true', '1'],
                ],
              },
            },
          });
          await DSI.cesiumStyle.readyPromise;
        });

        it('should set an image based on a url', () => {
          feature.set('src', 'test');
          const style = DSI.style(feature, 1);
          expect(style.getImage()).to.be.an.instanceOf(Icon);
          expect(style.getImage().getSrc()).to.equal('test');
        });

        it('should not evaluate circle, if the src is undefined or false', () => {
          const style = DSI.style(feature, 1);
          expect(style.getImage()).to.be.null;
        });

        it('should scale the image based on a scale', () => {
          feature.set('src', 'test');
          feature.set('scale', 6);
          const style = DSI.style(feature, 1);
          expect(style.getImage().getScale()).to.equal(6);
        });
      });
    }

    pointTestImage('Point - Image', getPoint);
    pointTestImage('MultiPoint - Image', getMultiPoint);

    describe('ObliqueMap Polygon Feature', () => {
      let feature;
      beforeEach(() => {
        const actualFeature = new Feature({
          geometry: new Polygon([[[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]]),
          class: 'up',
        });
        feature = new Feature({});
        feature[originalFeatureSymbol] = actualFeature;
      });

      it('should set color as fill', () => {
        const style = DSI.style(feature, 1);
        expect(style.getFill()).to.be.an.instanceOf(Fill);
        expect(style.getFill().getColor()).to.have.members([255, 0, 0, 1]);
      });

      it('should set the stroke', () => {
        const style = DSI.style(feature, 1);
        expect(style.getStroke()).to.be.an.instanceOf(Stroke);
        expect(style.getStroke().getColor()).to.have.members([0, 0, 0, 1]);
        expect(style.getStroke().getWidth()).to.equal(2);
      });
    });
  });

  describe('toJSON', () => {
    beforeEach(() => {
      DSI = new DeclarativeStyleItem({});
    });

    it('should add the declarative style to the options', () => {
      const options = DSI.toJSON();
      expect(options).to.have.property('declarativeStyle').and.to.have.property('show', 'true');
    });
  });

  describe('clone', () => {
    it('should create a new style item identical to this one', () => {
      const newStyle = DSI.clone();
      newStyle.name = DSI.name;
      expect(newStyle.toJSON()).to.eql(DSI.toJSON());
    });

    it('should accept a styleItem to clone on to', () => {
      const newStyle = new DeclarativeStyleItem({});
      DSI.clone(newStyle);
      newStyle.name = DSI.name;
      expect(newStyle.toJSON()).to.eql(DSI.toJSON());
    });
  });

  describe('assign', () => {
    it('should assign the options of one to the other', () => {
      const newStyle = new DeclarativeStyleItem({});
      newStyle.assign(DSI);
      newStyle.name = DSI.name;
      expect(newStyle.toJSON()).to.eql(DSI.toJSON());
    });
  });
});
