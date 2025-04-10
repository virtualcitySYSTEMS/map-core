import sinon from 'sinon';
import { expect } from 'chai';
import type Icon from 'ol/style/Icon.js';
import type { StyleFunction } from 'ol/style/Style.js';
import Style from 'ol/style/Style.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import type {
  VectorClusterTemplateFunction,
  VectorClusterStyleItemOptions,
} from '../../../index.js';
import {
  VectorStyleItem,
  VectorLayer,
  originalFeatureSymbol,
  highlighted,
  VectorClusterStyleItem,
  vectorClusterGroupName,
  vcsLayerName,
} from '../../../index.js';
import { getVcsEventSpy } from '../helpers/cesiumHelpers.js';

describe('VectorClusterStyleItem', () => {
  let sandbox: sinon.SinonSandbox;
  let clusterStyleItem: VectorClusterStyleItem;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  beforeEach(() => {
    clusterStyleItem = new VectorClusterStyleItem({
      template: ['some', '/url', '.jpg'].join(''),
      breaks: [2, 3, 4, 5, 10],
      zeroScaleOffset: 3,
      scaleFactor: 0.2,
    });
  });

  afterEach(() => {
    clusterStyleItem.destroy();
    sandbox.restore();
  });

  describe('constructor', () => {
    it('should add an event listener to clear the style cache', () => {
      const clearCache = sandbox.spy(clusterStyleItem, 'clearCache');
      clusterStyleItem.styleChanged.raiseEvent();
      expect(clearCache).to.have.been.called;
    });
  });

  describe('breaks', () => {
    it('should call style changed, if breaks change', () => {
      const spy = getVcsEventSpy(clusterStyleItem.styleChanged, sandbox);

      clusterStyleItem.breaks = [5, 10, 20];
      expect(spy).to.have.been.called;
    });

    it('should not call style changed, if breaks are the same', () => {
      const spy = getVcsEventSpy(clusterStyleItem.styleChanged, sandbox);

      clusterStyleItem.breaks = clusterStyleItem.breaks.slice();
      expect(spy).to.not.have.been.called;
    });

    it('should sort breaks', () => {
      clusterStyleItem.breaks = [10, 5, 3, 1, 2];
      expect(clusterStyleItem.breaks).to.have.ordered.members([1, 2, 3, 5, 10]);
    });
  });

  describe('zeroScaleOffset', () => {
    it('should call style changed, if zeroScaleOffset change', () => {
      const spy = getVcsEventSpy(clusterStyleItem.styleChanged, sandbox);

      clusterStyleItem.zeroScaleOffset = 1;
      expect(spy).to.have.been.called;
    });

    it('should not call style changed, if zeroScaleOffset are the same', () => {
      const spy = getVcsEventSpy(clusterStyleItem.styleChanged, sandbox);

      // eslint-disable-next-line no-self-assign
      clusterStyleItem.zeroScaleOffset = clusterStyleItem.zeroScaleOffset;
      expect(spy).to.not.have.been.called;
    });
  });

  describe('template context', () => {
    it('should call style changed, if context change', () => {
      const spy = getVcsEventSpy(clusterStyleItem.styleChanged, sandbox);

      clusterStyleItem.templateContext = { font: 'Arial' };
      expect(spy).to.have.been.called;
    });

    it('should create a clone of the object assigned', () => {
      const context: { font: string; foo?: string } = { font: 'Arial' };
      clusterStyleItem.templateContext = context;
      context.foo = 'bar';
      expect(clusterStyleItem.templateContext)
        .to.not.equal(context)
        .and.not.have.property('foo');
    });

    it('should not allow mutating the context', () => {
      const context: { font: string } = { font: 'Arial' };
      clusterStyleItem.templateContext = context;
      clusterStyleItem.templateContext.font = 'Times';
      expect(clusterStyleItem.templateContext).to.have.property(
        'font',
        'Arial',
      );
    });
  });

  describe('scaleFactor', () => {
    it('should call style changed, if scaleFactor change', () => {
      const spy = getVcsEventSpy(clusterStyleItem.styleChanged, sandbox);

      clusterStyleItem.scaleFactor = 1;
      expect(spy).to.have.been.called;
    });

    it('should not call style changed, if scaleFactor are the same', () => {
      const spy = getVcsEventSpy(clusterStyleItem.styleChanged, sandbox);

      // eslint-disable-next-line no-self-assign
      clusterStyleItem.scaleFactor = clusterStyleItem.scaleFactor;
      expect(spy).to.not.have.been.called;
    });
  });

  describe('setTemplate', () => {
    it('should call styleChanged', () => {
      const spy = getVcsEventSpy(clusterStyleItem.styleChanged, sandbox);

      clusterStyleItem.setTemplate('test');
      expect(spy).to.have.been.called;
    });

    it('should set the template', () => {
      clusterStyleItem.setTemplate('test');
      expect(clusterStyleItem.template).to.equal('test');
    });

    it('should set a template function', () => {
      const templateFunction: VectorClusterTemplateFunction = () => ({
        template: 'test',
        cacheKey: 'test',
      });
      clusterStyleItem.setTemplate(templateFunction);
      expect(clusterStyleItem.template).to.equal(templateFunction);
    });
  });

  describe('findBreakIndex', () => {
    it('should return the break index for an exact break', () => {
      const index = clusterStyleItem.findBreakIndex(3);
      expect(index).to.equal(1); // 3
    });

    it('should return the break index of the next range', () => {
      const index = clusterStyleItem.findBreakIndex(6);
      expect(index).to.equal(4); // 10
    });

    it('should return the last range + 1 for sizes larger then the largest group', () => {
      const index = clusterStyleItem.findBreakIndex(20);
      expect(index).to.equal(5); // 10+
    });
  });

  describe('getClusterText', () => {
    it('returns the size for exact cluster sizes', () => {
      const text = clusterStyleItem.getClusterText(2);
      expect(text).to.equal('2');
    });

    it('should return the range for ranged cluster sizes', () => {
      const text = clusterStyleItem.getClusterText(6);
      expect(text).to.equal('5+');
    });
  });

  describe('determineScale', () => {
    it('should return 0.6 for exact cluster sizes', () => {
      const scale = clusterStyleItem.determineScale(2);
      expect(scale).to.equal(0.6);
    });

    it('should return 0.6 plus n times the scale factor for ranged sizes', () => {
      const scale = clusterStyleItem.determineScale(12);
      expect(scale).to.equal(1);
    });
  });

  describe('style function', () => {
    describe('cluster feature', () => {
      let feature: Feature;
      let styleFunction: StyleFunction;

      beforeEach(() => {
        feature = new Feature();
        feature[vectorClusterGroupName] = 'test';
        const child = new Feature();
        feature.set('features', new Array(6).fill(child));
        styleFunction = clusterStyleItem.createStyleFunction(() => undefined);
      });

      it('should create a style for a given cluster feature', () => {
        const style = styleFunction(feature, 1);
        expect(style).to.be.an.instanceOf(Style);
      });

      it('should cache a style for a given cluster size', () => {
        const style = styleFunction(feature, 1);
        const cache = styleFunction(feature, 1);
        expect(style).to.equal(cache);
      });
    });

    describe('single feature', () => {
      let feature: Feature;
      let child: Feature;
      let layer: VectorLayer;
      let styleFunction: StyleFunction;

      beforeEach(() => {
        feature = new Feature();
        feature[vectorClusterGroupName] = 'test';
        child = new Feature({
          geometry: new Point([1, 1]),
        });
        feature.set('features', [child]);
        layer = new VectorLayer({});
        layer.addFeatures([child]);
        styleFunction = clusterStyleItem.createStyleFunction((name) =>
          name === layer.name ? layer : undefined,
        );
      });

      it('should return the layers style', () => {
        const style = styleFunction(feature, 1);
        expect(style).to.equal(layer.style.style);
      });

      it('should return undefined, if the features layer cannot be determined', () => {
        const style = styleFunction(new Feature({ features: [child] }), 1);
        expect(style).to.be.undefined;
      });

      it('should execute the style, if it is a style function', () => {
        const layerStyle = new Style({});
        layer.style.style = (): Style => layerStyle;
        const style = styleFunction(feature, 1);
        expect(style).to.equal(layerStyle);
      });

      it('should return the highlighted style of a feature', () => {
        child[highlighted] = new VectorStyleItem({});
        const style = styleFunction(feature, 1);
        expect(style).to.equal(child[highlighted].style);
      });

      it('should return the feature style, if set', () => {
        const featureStyle = new Style({});
        child.setStyle(featureStyle);
        const style = styleFunction(feature, 1);
        expect(style).to.equal(featureStyle);
      });

      it('should determine the original feature, if the feature is an oblique clone', () => {
        const actualChild = new Feature();
        const featureStyle = new Style({});
        actualChild.setStyle(featureStyle);
        actualChild[vcsLayerName] = layer.name;
        child[originalFeatureSymbol] = actualChild;
        const style = styleFunction(feature, 1);
        expect(style).to.equal(featureStyle);
      });
    });

    describe('using a custom cache key', () => {
      let feature: Feature;
      let styleFunction: StyleFunction;

      beforeEach(() => {
        feature = new Feature();
        feature[vectorClusterGroupName] = 'test';
        const child = new Feature();
        feature.set('features', new Array(6).fill(child));
        let called = 0;
        clusterStyleItem.setTemplate(() => {
          if (called === 0) {
            called += 1;
            return {
              template: 'test',
              cacheKey: 'test',
            };
          } else {
            return {
              template: 'test',
              cacheKey: 'test2',
            };
          }
        });
        styleFunction = clusterStyleItem.createStyleFunction(() => undefined);
      });

      it('should create a style for a given cluster feature', () => {
        const style = styleFunction(feature, 1);
        expect(style).to.be.an.instanceOf(Style);
      });

      it('should cache a style for a given cluster size', () => {
        const style = styleFunction(feature, 1);
        const cache1 = styleFunction(feature, 1);
        const cache2 = styleFunction(feature, 1);
        expect(style).to.not.equal(cache1);
        expect(cache2).to.equal(cache1);
      });
    });

    describe('using custom template context', () => {
      let feature: Feature;
      let styleFunction: StyleFunction;

      beforeEach(() => {
        feature = new Feature();
        feature[vectorClusterGroupName] = 'test';
        const child = new Feature();
        feature.set('features', new Array(6).fill(child));
        clusterStyleItem.setTemplate(() => {
          return {
            template: '{{test}}',
            cacheKey: 'test',
            context: {
              test: 'foo',
            },
          };
        });
        styleFunction = clusterStyleItem.createStyleFunction(() => undefined);
      });

      it('should create a style for a given cluster feature', () => {
        const style = styleFunction(feature, 1) as Style;
        expect(style).to.be.an.instanceOf(Style);
        expect((style?.getImage() as Icon).getSrc()).to.equal(
          'data:image/svg+xml,foo',
        );
      });
    });

    describe('template failure', () => {
      it('should gracefully handle error in templating engine', () => {
        const feature = new Feature();
        feature[vectorClusterGroupName] = 'test';
        const child = new Feature();
        feature.set('features', new Array(6).fill(child));
        clusterStyleItem.setTemplate('{{#if bar}}foo');
        const styleFunction = clusterStyleItem.createStyleFunction(
          () => undefined,
        );
        expect(() => {
          styleFunction(feature, 1);
        }).to.not.throw(Error);
      });
    });
  });

  describe('getting a config', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default vector cluster group', () => {
        const config = new VectorStyleItem({}).toJSON();
        expect(config).to.have.all.keys('name', 'type');
      });
    });

    describe('of a configured vector cluster group', () => {
      let inputConfig: VectorClusterStyleItemOptions;
      let outputConfig: VectorClusterStyleItemOptions;
      let configureVectorCluster: VectorClusterStyleItem;

      before(() => {
        inputConfig = {
          breaks: [1, 2, 3],
          zeroScaleOffset: 4,
          scaleFactor: 0.2,
          templateContext: {
            font: 'Arial',
          },
          template: 'test',
        };
        configureVectorCluster = new VectorClusterStyleItem(inputConfig);
        outputConfig = configureVectorCluster.toJSON();
      });

      after(() => {
        configureVectorCluster.destroy();
      });

      it('should configure breaks', () => {
        expect(outputConfig)
          .to.have.property('breaks')
          .and.to.eql(inputConfig.breaks);
      });

      it('should configure zeroScaleOffset', () => {
        expect(outputConfig)
          .to.have.property('zeroScaleOffset')
          .and.to.equal(inputConfig.zeroScaleOffset);
      });

      it('should configure scaleFactor', () => {
        expect(outputConfig)
          .to.have.property('scaleFactor')
          .and.to.equal(inputConfig.scaleFactor);
      });

      it('should configure template', () => {
        expect(outputConfig)
          .to.have.property('template')
          .and.to.equal(inputConfig.template);
      });

      it('should configure templateContext', () => {
        expect(outputConfig)
          .to.have.property('templateContext')
          .and.to.eql(inputConfig.templateContext)
          .and.to.not.equal(inputConfig.templateContext);
      });
    });
  });
});
