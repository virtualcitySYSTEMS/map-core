import { expect } from 'chai';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import Style, { type StyleFunction } from 'ol/style/Style.js';
import '../../../src/ol/feature.js';
import {
  globalHidden,
  hidden,
  highlighted,
} from '../../../src/layer/featureVisibility.js';
import VectorStyleItem from '../../../src/style/vectorStyleItem.js';

describe('ol.Feature', () => {
  describe('#getOriginalStyle', () => {
    let feature: Feature;
    let style: Style;

    beforeEach(() => {
      feature = new Feature();
      style = new Style({});
    });

    it('should return undefined, if no style is set', () => {
      expect(feature.getOriginalStyle()).to.be.undefined;
    });

    it('should return the set style', () => {
      feature.setStyle(style);
      expect(feature.getOriginalStyle()).to.equal(style);
    });

    it('should return a set style function', () => {
      const styleFunction: StyleFunction = () => [style];
      feature.setStyle(styleFunction);
      expect(feature.getOriginalStyle()).to.equal(styleFunction);
    });

    it('should return undefined, if the style is unset', () => {
      feature.setStyle(style);
      feature.setStyle(undefined);
      expect(feature.getOriginalStyle()).to.be.undefined;
    });

    it('should return the set style of a highlighted feature', () => {
      const highlightStyle = new VectorStyleItem({});
      feature.setStyle(style);
      feature[highlighted] = highlightStyle;
      expect(feature.getOriginalStyle()).to.equal(style);
      expect(feature.getStyle()).to.equal(highlightStyle.style);
    });

    it('should return the set style of a hidden feature', () => {
      feature.setStyle(style);
      feature[hidden] = true;
      expect(feature.getOriginalStyle()).to.equal(style);
      expect(feature.getStyle()).to.not.equal(style);
    });

    it('should return the set style of a globally hidden feature', () => {
      feature.setStyle(style);
      feature[globalHidden] = true;
      expect(feature.getOriginalStyle()).to.equal(style);
      expect(feature.getStyle()).to.not.equal(style);
    });
  });

  describe('#clone', () => {
    let feature: Feature;
    let style: Style;

    beforeEach(() => {
      feature = new Feature({ geometry: new Point([0, 0]), foo: 'bar' });
      style = new Style({});
    });

    it('should clone the geometry and properties', () => {
      const clone = feature.clone();
      expect(clone).to.not.equal(feature);
      expect(clone.get('foo')).to.equal('bar');
      expect(clone.getGeometry()?.getCoordinates()).to.have.ordered.members([
        0, 0,
      ]);
      expect(clone.getGeometry()).to.not.equal(feature.getGeometry());
    });

    it('should clone the style of a feature', () => {
      feature.setStyle(style);
      expect(feature.clone().getOriginalStyle()).to.equal(style);
    });

    it('should clone the original style of a highlighted feature', () => {
      feature.setStyle(style);
      feature[highlighted] = new VectorStyleItem({});
      const clone = feature.clone();
      expect(clone.getOriginalStyle()).to.equal(style);
      expect(clone.getStyle()).to.equal(style);
    });

    it('should clone the original style of a hidden feature', () => {
      feature.setStyle(style);
      feature[hidden] = true;
      expect(feature.clone().getStyle()).to.equal(style);
    });

    it('should clone the original style of a globally hidden feature', () => {
      feature.setStyle(style);
      feature[globalHidden] = true;
      expect(feature.clone().getStyle()).to.equal(style);
    });

    it('should not set a style on the clone of a hidden feature without style', () => {
      feature[hidden] = true;
      expect(feature.clone().getOriginalStyle()).to.be.undefined;
    });

    it('should not set a style on the clone of a highlighted feature without style', () => {
      feature[highlighted] = new VectorStyleItem({});
      expect(feature.clone().getOriginalStyle()).to.be.undefined;
    });

    it('should not copy hidden or highlighted state to the clone', () => {
      feature[highlighted] = new VectorStyleItem({});
      feature[hidden] = true;
      feature[globalHidden] = true;
      const clone = feature.clone();
      expect(clone[highlighted]).to.be.undefined;
      expect(clone[hidden]).to.be.undefined;
      expect(clone[globalHidden]).to.be.undefined;
    });
  });
});
