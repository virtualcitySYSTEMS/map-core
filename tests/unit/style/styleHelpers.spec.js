import { Color } from '@vcmap-cesium/engine';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import RegularShape from 'ol/style/RegularShape.js';
import Circle from 'ol/style/Circle.js';
import Icon from 'ol/style/Icon.js';
import {
  cesiumColorToColor,
  hexToOlColor,
  parseColor,
  getCesiumColor,
  getStringColor,
  getFillOptions,
  getFillFromOptions,
  getStrokeOptions,
  getStrokeFromOptions,
  getImageStyleFromOptions,
  getImageStyleOptions,
} from '../../../src/style/styleHelpers.js';

describe('styleHelpers', () => {
  describe('stylehexToOlColor', () => {
    it('should convert a hex Color Value to a ol.Color type', () => {
      const olColor = hexToOlColor('#ff0000');
      expect(olColor).to.has.ordered.members([255, 0, 0, 1]);
    });

    it('should convert a 3 digit hex value to', () => {
      const olColor = hexToOlColor('#f00');
      expect(olColor).to.has.ordered.members([255, 0, 0, 1]);
    });

    it('should use alpha value if it exists', () => {
      const olColor = hexToOlColor('#ff0000', 0);
      expect(olColor).to.has.ordered.members([255, 0, 0, 0]);
    });
  });

  describe('cesiumColorToColor', () => {
    it('should convert a cesium Color to an ol.Color', () => {
      const cesiumColor = Color.RED;
      const cesiumColor2 = new Color(1.0, 1.0, 1.0, 0);
      const olColor = cesiumColorToColor(cesiumColor);
      const olColor2 = cesiumColorToColor(cesiumColor2);

      expect(olColor).to.has.ordered.members([255, 0, 0, 1]);
      expect(olColor2).to.has.ordered.members([255, 255, 255, 0]);
    });
  });

  describe('parseColor', () => {
    it('should parse an array of color values', () => {
      const color = parseColor([255, 0, 0]);
      expect(color).to.has.ordered.members([255, 0, 0, 1]);

      const color2 = parseColor([255, 0, 0, 0.5]);
      expect(color2).to.has.ordered.members([255, 0, 0, 0.5]);
    });

    it('should parse an hex value', () => {
      const color = parseColor('#ff0000');
      expect(color).to.has.ordered.members([255, 0, 0, 1]);
      const color2 = parseColor('#0000ff');
      expect(color2).to.has.ordered.members([0, 0, 255, 1]);
    });

    it('should parse an rgb color string', () => {
      const color = parseColor('rgb(0,255,0)');
      expect(color).to.has.ordered.members([0, 255, 0, 1]);
    });

    it('should parse an rgba color string', () => {
      const color = parseColor('rgba(0,255,0,0.4)');
      expect(color).to.has.ordered.members([0, 255, 0, 0.4]);
    });

    it('should return the default color if the color cannot be parsed', () => {
      const defaultColor = [1, 2, 3, 1];
      const color = parseColor('notacolor', defaultColor);
      expect(color).to.be.equal(defaultColor);
    });

    it('should ignore the default color if the color can be parsed', () => {
      const defaultColor = [1, 2, 3, 1];
      const color = parseColor('#ff0000', defaultColor);
      expect(color).to.not.be.equal(defaultColor);
    });
  });

  describe('getCesiumColor', () => {
    let defaultColor;

    before(() => {
      defaultColor = [0, 0, 0, 1];
    });

    it('should correctly return a Cesium Color from a given input color', () => {
      const testColor = [1, 1, 1, 1];
      const testPsColor = parseColor(testColor);
      const testCesiumColor = Color.fromBytes(
        testPsColor[0],
        testPsColor[1],
        testPsColor[2],
        testPsColor[3] * 255,
      );
      const test = getCesiumColor(testColor, defaultColor);
      expect(test).to.deep.equal(testCesiumColor);
    });

    it('should correctly return a Cesium Color from the preset default color', () => {
      const defaultPsColor = parseColor(defaultColor);
      const defaultCesiumColor = Color.fromBytes(
        defaultPsColor[0],
        defaultPsColor[1],
        defaultPsColor[2],
        defaultPsColor[3] * 255,
      );
      const test = getCesiumColor(undefined, defaultColor);
      expect(test).to.deep.equal(defaultCesiumColor);
    });

    it('should return a Cesium Color Object', () => {
      const testColor = [1, 1, 1, 1];
      const test = getCesiumColor(testColor, defaultColor);
      expect(test).to.be.an.instanceof(Color);
    });
  });

  describe('getStringColor', () => {
    it('should return an rgba Color String', () => {
      const color = getStringColor([255, 0, 0]);
      expect(color).to.equal('rgba(255,0,0,1)');
      const color2 = getStringColor([255, 0, 0, 0.5]);
      expect(color2).to.equal('rgba(255,0,0,0.5)');
    });
  });

  describe('fillOptions', () => {
    it('should serialize a Fill Object', () => {
      const fill = new Fill({
        color: [2, 3, 4, 0.5],
      });
      const fillOptions = getFillOptions(fill);
      expect(fillOptions.color).to.have.members([2, 3, 4, 0.5]);
    });

    it('should deserialize a Fill Object', () => {
      const fillOptions = {
        color: [2, 3, 4, 0.5],
      };
      const fill = getFillFromOptions(fillOptions);
      expect(fill).to.be.an.instanceof(Fill);
      expect(fill.getColor()).to.have.members([2, 3, 4, 0.5]);
    });
  });

  describe('strokeOptions', () => {
    it('should serialize a Stroke Object', () => {
      const stroke = new Stroke({
        color: [2, 3, 4, 0.5],
        width: 10,
        lineDash: [2],
      });
      const strokeOptions = getStrokeOptions(stroke);
      expect(strokeOptions.color).to.have.members([2, 3, 4, 0.5]);
      expect(strokeOptions.width).to.be.equal(10);
      expect(strokeOptions.lineDash).to.have.members([2]);
    });

    it('should serialize a Stroke Object with undefined properties', () => {
      const stroke = new Stroke({
        color: [2, 3, 4, 0.5],
      });
      const strokeOptions = getStrokeOptions(stroke);
      expect(strokeOptions).to.be.deep.equal({ color: [2, 3, 4, 0.5] });
    });

    it('should deserialize a Stroke Object', () => {
      const strokeOptions = {
        color: [2, 3, 4, 0.5],
        width: 10,
        lineDash: [2],
      };
      const stroke = getStrokeFromOptions(strokeOptions);
      expect(stroke).to.be.an.instanceof(Stroke);
      expect(stroke.getColor()).to.have.members([2, 3, 4, 0.5]);
      expect(stroke.getWidth()).to.be.equal(10);
      expect(stroke.getLineDash()).to.have.members([2]);
    });
  });

  describe('imageStyleOptions', () => {
    describe('RegularShape', () => {
      it('should serialize a RegularShape', () => {
        const regularShape = new RegularShape({
          scale: 2,
          fill: new Fill({ color: [1, 2, 3, 1] }),
          points: 3,
          angle: 2,
          radius: 4,
          stroke: new Stroke({ color: [2, 3, 4, 1], width: 3 }),
        });
        const imageStyleOptions = getImageStyleOptions(regularShape);
        expect(imageStyleOptions.scale).to.be.equal(2);
        expect(imageStyleOptions.points).to.be.equal(3);
        expect(imageStyleOptions.angle).to.be.equal(2);
        expect(imageStyleOptions.radius).to.be.equal(4);
        expect(imageStyleOptions.fill).to.be.deep.equal({
          color: [1, 2, 3, 1],
        });
        expect(imageStyleOptions.stroke).to.be.deep.equal({
          color: [2, 3, 4, 1],
          width: 3,
        });
      });

      it('should serialize a RegularShape with undefined properties', () => {
        const regularShape = new RegularShape({
          scale: 2,
        });
        const imageStyleOptions = getImageStyleOptions(regularShape);
        expect(imageStyleOptions).to.be.deep.equal({ scale: 2 });
      });

      it('should deserialize a RegularShape', () => {
        const regularShapeOptions = {
          scale: 2,
          fill: {
            color: [1, 2, 3, 1],
          },
          points: 3,
          radius: 4,
        };
        const regularShape = getImageStyleFromOptions(regularShapeOptions);
        expect(regularShape).to.be.an.instanceof(RegularShape);
        expect(regularShape.getStroke()).to.be.null;
        expect(regularShape.getFill()).to.be.an.instanceof(Fill);
        expect(regularShape.getFill().getColor()).to.have.members([1, 2, 3, 1]);
        expect(regularShape.getScale()).to.be.equal(2);
        expect(regularShape.getPoints()).to.be.equal(3);
        expect(regularShape.getRadius()).to.be.equal(4);
      });
    });

    describe('Circle', () => {
      it('should serialize a Circle', () => {
        const circleStyle = new Circle({
          scale: 2,
          fill: new Fill({ color: [1, 2, 3, 1] }),
          radius: 4,
          stroke: new Stroke({ color: [2, 3, 4, 1], width: 3 }),
        });
        const imageStyleOptions = getImageStyleOptions(circleStyle);
        expect(imageStyleOptions.scale).to.be.equal(2);
        expect(imageStyleOptions.radius).to.be.equal(4);
        expect(imageStyleOptions.fill).to.be.deep.equal({
          color: [1, 2, 3, 1],
        });
        expect(imageStyleOptions.stroke).to.be.deep.equal({
          color: [2, 3, 4, 1],
          width: 3,
        });
      });

      it('should serialize a Circle with undefined properties', () => {
        const circleStyle = new Circle({
          scale: 2,
        });
        const imageStyleOptions = getImageStyleOptions(circleStyle);
        expect(imageStyleOptions).to.be.deep.equal({ scale: 2 });
      });

      it('should deserialize a Circle', () => {
        const circleOptions = {
          scale: 2,
          fill: {
            color: [1, 2, 3, 1],
          },
          radius: 4,
        };
        const circleStyle = getImageStyleFromOptions(circleOptions);
        expect(circleStyle).to.be.an.instanceof(Circle);
        expect(circleStyle.getStroke()).to.be.null;
        expect(circleStyle.getFill()).to.be.an.instanceof(Fill);
        expect(circleStyle.getFill().getColor()).to.have.members([1, 2, 3, 1]);
        expect(circleStyle.getScale()).to.be.equal(2);
        expect(circleStyle.getRadius()).to.be.equal(4);
      });
    });

    describe('Icon', () => {
      it('should serialize a Icon', () => {
        const iconStyle = new Icon({
          src: 'test',
          scale: 2,
          opacity: 3,
          color: [1, 2, 3, 1],
          anchor: [1, 1],
        });
        const imageStyleOptions = getImageStyleOptions(iconStyle);
        expect(imageStyleOptions.scale).to.be.equal(2);
        expect(imageStyleOptions.opacity).to.be.equal(3);
        expect(imageStyleOptions.src).to.be.equal('test');
        expect(imageStyleOptions.color).to.have.members([1, 2, 3, 1]);
        // we do not check anchor, anchor returns undefined if the icon has not
        // been loaded and the internal size is still null
      });

      it('should serialize a Icon with undefined properties', () => {
        const iconStyle = new Icon({
          scale: 2,
          src: 'test',
        });
        const imageStyleOptions = getImageStyleOptions(iconStyle);
        expect(imageStyleOptions).to.be.deep.equal({
          scale: 2,
          src: 'test',
          opacity: 1,
        });
      });

      it('should deserialize a Icon', () => {
        const iconOptions = {
          scale: 2,
          src: 'test',
          color: [1, 2, 3, 1],
          opacity: 1,
        };
        const iconStyle = getImageStyleFromOptions(iconOptions);
        expect(iconStyle).to.be.an.instanceof(Icon);
        expect(iconStyle.getColor()).to.have.members([1, 2, 3, 1]);
        expect(iconStyle.getOpacity()).to.be.equal(1);
        expect(iconStyle.getSrc()).to.be.equal('test');
      });
    });
  });
});
