import Feature from 'ol/Feature.js';
import Style from 'ol/style/Style.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import RegularShape from 'ol/style/RegularShape.js';
import { getStylesArray } from '../../../../src/util/featureconverter/convert.js';

describe('util.featureConverter.convert', () => {
  describe('getStylesArray', () => {
    let sandbox;
    let feature;
    let style;

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
      const style4 = new Style({ image: new RegularShape({}) });
      const styleFunction = () => [style, style2];
      const styles = getStylesArray([styleFunction, [style3, style4]], feature);
      expect(styles).to.be.an('array');
      expect(styles).to.have.lengthOf(4);
      expect(styles).to.have.ordered.members([style, style2, style3, style4]);
    });

    it('should handle non style elements', () => {
      const style2 = {};
      const styles = getStylesArray(style2, feature);
      expect(styles).to.be.an('array');
      expect(styles).to.have.lengthOf(0);
    });
  });
});
