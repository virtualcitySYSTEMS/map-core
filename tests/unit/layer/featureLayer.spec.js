import Style from 'ol/style/Style.js';
import Fill from 'ol/style/Fill.js';
import DeclarativeStyleItem from '../../../src/style/declarativeStyleItem.js';
import VectorStyleItem from '../../../src/style/vectorStyleItem.js';
import FeatureLayer from '../../../src/layer/featureLayer.js';
import { getVcsEventSpy } from '../helpers/cesiumHelpers.js';
import GlobalHider from '../../../src/layer/globalHider.js';

describe('FeatureLayer', () => {
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

  describe('setting globalHider', () => {
    it('should reload layer to update featureVisibility listeners on impl', () => {
      const reloadSpy = sandbox.spy(featureLayer, 'forceRedraw');
      featureLayer.setGlobalHider(new GlobalHider());
      expect(reloadSpy).to.have.been.called;
    });
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

    it('should raise the styleChanged with the new style', () => {
      const spy = getVcsEventSpy(featureLayer.styleChanged, sandbox);
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
            type: VectorStyleItem.className,
            name: 'style',
            fill: {
              color: '#FF00FF',
            },
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
            type: VectorStyleItem.className,
            name: 'style',
            fill: {
              color: [255, 0, 255, 1],
            },
          });
      });
    });
  });
});
