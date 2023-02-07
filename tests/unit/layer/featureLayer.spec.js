import Style from 'ol/style/Style.js';
import Fill from 'ol/style/Fill.js';
import { SplitDirection } from '@vcmap-cesium/engine';
import DeclarativeStyleItem from '../../../src/style/declarativeStyleItem.js';
import VectorStyleItem from '../../../src/style/vectorStyleItem.js';
import FeatureLayer from '../../../src/layer/featureLayer.js';
import VectorLayer from '../../../src/layer/vectorLayer.js';
import { getVcsEventSpy, setCesiumMap } from '../helpers/cesiumHelpers.js';
import GlobalHider from '../../../src/layer/globalHider.js';
import VcsApp from '../../../src/vcsApp.js';

describe('FeatureLayer', () => {
  let sandbox;
  let app;
  /** @type {import("@vcmap/core").FeatureLayer} */
  let featureLayer;
  /** @type {import("@vcmap/core").CesiumMap} */
  let cesiumMap;

  before(async () => {
    sandbox = sinon.createSandbox();
    app = new VcsApp();
    cesiumMap = await setCesiumMap(app);
  });

  beforeEach(() => {
    featureLayer = new FeatureLayer({});
  });

  afterEach(() => {
    sandbox.restore();
    featureLayer.destroy();
  });

  after(() => {
    app.destroy();
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

  describe('splitDirection', () => {
    it('should return the split direction', () => {
      featureLayer.splitDirection = SplitDirection.LEFT;
      expect(featureLayer.splitDirection).to.equal(SplitDirection.LEFT);
    });

    it('should raise the splitDirectionChanged event', () => {
      const spy = getVcsEventSpy(featureLayer.splitDirectionChanged, sandbox);
      featureLayer.splitDirection = SplitDirection.LEFT;
      expect(spy).to.have.been.calledWith(SplitDirection.LEFT);
    });

    it('should not raise the splitDirectionChanged event, if it does not changed', () => {
      featureLayer.splitDirection = SplitDirection.LEFT;
      const spy = getVcsEventSpy(featureLayer.splitDirectionChanged, sandbox);
      featureLayer.splitDirection = SplitDirection.LEFT;
      expect(spy).to.not.have.been.called;
    });

    it('should update the splitDirection of its implementations', () => {
      // FeatureLayer has no direct impls, but its children e.g. VectorLayer
      const vectorLayer = new VectorLayer({});
      const [impl] = vectorLayer.getImplementationsForMap(cesiumMap);
      vectorLayer.splitDirection = SplitDirection.LEFT;
      expect(impl.splitDirection).to.equal(SplitDirection.LEFT);
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
          splitDirection: 'left',
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

      it('should configure splitDirection', () => {
        expect(outputConfig).to.have.property('splitDirection', inputConfig.splitDirection);
      });
    });
  });
});
