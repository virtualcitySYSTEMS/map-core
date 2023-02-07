import { Color } from '@vcmap-cesium/engine';
import {
  cesiumColorToColor,
  hexToOlColor,
  parseColor,
  getCesiumColor,
  getStringColor,
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
      const testCesiumColor = Color.fromBytes(testPsColor[0], testPsColor[1], testPsColor[2], testPsColor[3] * 255);
      const test = getCesiumColor(testColor, defaultColor);
      expect(test).to.deep.equal(testCesiumColor);
    });

    it('should correctly return a Cesium Color from the preset default color', () => {
      const defaultPsColor = parseColor(defaultColor);
      const defaultCesiumColor = Color.fromBytes(defaultPsColor[0], defaultPsColor[1],
        defaultPsColor[2], defaultPsColor[3] * 255);
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
});
