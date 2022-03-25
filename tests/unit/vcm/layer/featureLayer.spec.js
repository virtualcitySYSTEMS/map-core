import Style from 'ol/style/Style.js';
import Fill from 'ol/style/Fill.js';
import DeclarativeStyleItem from '../../../../src/vcs/vcm/util/style/declarativeStyleItem.js';
import VectorStyleItem from '../../../../src/vcs/vcm/util/style/vectorStyleItem.js';
import FeatureLayer from '../../../../src/vcs/vcm/layer/featureLayer.js';
import { getCesiumEventSpy } from '../../helpers/cesiumHelpers.js';
import { styleCollection } from '../../../../src/vcs/vcm/globalCollections.js';

describe('vcs.vcm.layer.FeatureLayer', () => {
  let sandbox;
  /** @type {import("@vcmap/core").FeatureLayer} */
  let featureLayer;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  beforeEach(() => {
    featureLayer = new FeatureLayer({});
  });

  afterEach(() => {
    sandbox.restore();
    featureLayer.destroy();
  });

  describe('setStyle', () => {
    it('should set a style item', () => {
      const vectorStyle = new VectorStyleItem({});
      featureLayer.setStyle(vectorStyle);
      expect(featureLayer).to.have.property('style', vectorStyle);
      const declarativeStyle = new DeclarativeStyleItem({});
      featureLayer.setStyle(declarativeStyle);
      expect(featureLayer).to.have.property('style', declarativeStyle);
    });

    it('should set an ol style on a styleItem without overwritting the default style', () => {
      const style = new Style({ fill: new Fill({ color: [0, 0, 255, 1] }) });
      featureLayer.setStyle(style);
      expect(featureLayer).to.have.property('style').and.to.be.an.instanceOf(VectorStyleItem).and.to.not.equal(featureLayer.defaultStyle);
      expect(featureLayer.style.fillColor).to.have.members([0, 0, 255, 1]);
    });

    it('should set the style based on a framework style', () => {
      const style = new VectorStyleItem({});
      styleCollection.add(style);
      featureLayer.setStyle(style.name);
      expect(featureLayer).to.have.property('style', style);
    });

    it('should not change the style, if a style was not found with a given name', () => {
      featureLayer.setStyle('test');
      expect(featureLayer).to.have.property('style', featureLayer.defaultStyle);
    });

    it('should raise the styleChanged with the new style', () => {
      const spy = getCesiumEventSpy(sandbox, featureLayer.styleChanged);
      const style = new VectorStyleItem({});
      featureLayer.setStyle(style);
      expect(spy).to.have.been.calledWithExactly(style);
    });
  });

  describe('getting a config', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const config = featureLayer.toJSON();
        expect(config).to.have.all.keys('name', 'type');
      });
    });

    describe('of a configured layer', () => {
      let inputConfig;
      let outputConfig;
      let configuredLayer;

      before(() => {
        inputConfig = {
          style: {
            type: 'vector',
            fill: {
              color: '#FF00FF',
            },
          },
          genericFeatureProperties: {
            test: true,
          },
        };
        configuredLayer = new FeatureLayer(inputConfig);
        outputConfig = configuredLayer.toJSON();
      });

      after(() => {
        configuredLayer.destroy();
      });

      it('should set the style options', () => {
        expect(outputConfig).to.have.property('style')
          .and.to.eql({
            type: 'vector',
            fill: {
              color: [255, 0, 255, 1],
            },
          });
      });

      it('should set genericFeatureProperties', () => {
        expect(outputConfig).to.have.property('genericFeatureProperties')
          .and.to.have.property('test', true);
      });
    });
  });
});
