import Feature from 'ol/Feature.js';
import Style from 'ol/style/Style.js';
import GlobalHider from '../../../../src/vcs/vcm/layer/globalHider.js';
import VectorStyleItem, { vectorStyleSymbol } from '../../../../src/vcs/vcm/util/style/vectorStyleItem.js';
import { getCesiumEventSpy, createDummyCesium3DTileFeature } from '../../helpers/cesiumHelpers.js';
import {
  FeatureVisibilityAction,
  globalHidden,
  hidden,
  highlighted,
  originalStyle,
} from '../../../../src/vcs/vcm/layer/featureVisibility.js';

describe('vcs.vcm.layer.GlobalHider', () => {
  let sandbox;
  /** @type {vcs.vcm.layer.GlobalHider} */
  let GH;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  beforeEach(() => {
    GH = new GlobalHider();
  });

  afterEach(() => {
    GH.destroy();
    sandbox.restore();
  });

  describe('hideObjects', () => {
    it('should add a counter to each UUID', () => {
      GH.hideObjects(['test', 'test1']);
      expect(GH.hiddenObjects).to.have.property('test', 1);
      expect(GH.hiddenObjects).to.have.property('test1', 1);
    });

    it('should increase an already existing counter', () => {
      GH.hideObjects(['test', 'test1']);
      GH.hideObjects(['test1', 'test2']);
      expect(GH.hiddenObjects).to.have.property('test', 1);
      expect(GH.hiddenObjects).to.have.property('test1', 2);
      expect(GH.hiddenObjects).to.have.property('test2', 1);
    });

    it('should set lastUpdated', () => {
      sandbox.useFakeTimers(1);
      GH.hideObjects(['test', 'test1']);
      expect(GH.lastUpdated).to.equal(Date.now());
    });

    it('should raise changed event', () => {
      const spy = getCesiumEventSpy(sandbox, GH.changed);
      GH.hideObjects(['test', 'test1']);
      expect(spy).to.have.been.calledWith({ action: FeatureVisibilityAction.HIDE, ids: ['test', 'test1'] });
    });

    it('should not set lastUpdated, if the array is empty', () => {
      sandbox.useFakeTimers(1);
      GH.hideObjects([]);
      expect(GH.lastUpdated).to.not.equal(Date.now());
    });

    it('should not raise changed event, if the array is empty', () => {
      const spy = getCesiumEventSpy(sandbox, GH.changed);
      GH.hideObjects([]);
      expect(spy).to.not.have.been.called;
    });

    it('should not set lastUpdated, if the no new feature where added', () => {
      const clock = sandbox.useFakeTimers(1);
      GH.hideObjects(['test']);
      clock.tick(1);
      GH.hideObjects(['test']);
      expect(GH.lastUpdated).to.not.equal(Date.now());
    });

    it('should not raise changed event, if the no new feature where added', () => {
      GH.hideObjects(['test']);
      const spy = getCesiumEventSpy(sandbox, GH.changed);
      GH.hideObjects(['test']);
      expect(spy).to.not.have.been.called;
    });

    it('should only raise the changed event for newly hidden ids', () => {
      GH.hideObjects(['test']);
      const spy = getCesiumEventSpy(sandbox, GH.changed);
      GH.hideObjects(['test', 'test1']);
      expect(spy).to.have.been.calledWith({ action: FeatureVisibilityAction.HIDE, ids: ['test1'] });
    });
  });

  describe('addFeature / hasFeature', () => {
    it('should add a feature to the set of a uuid', () => {
      const feature = new Feature();
      GH.addFeature('test', feature);
      expect(GH.hasFeature('test', feature)).to.be.true;
    });

    it('should set show false on a Cesium3DTile feature', () => {
      const tileFeature = createDummyCesium3DTileFeature();
      GH.addFeature('test', tileFeature);
      expect(tileFeature.show).to.be.false;
    });

    it('should set an empty style on an ol.Feature', () => {
      const feature = new Feature();
      GH.addFeature('test', feature);
      const empty = feature.getStyle();
      expect(empty.getFill()).to.be.null;
      expect(empty.getText()).to.be.null;
      expect(empty.getImage()).to.be.null;
      expect(empty.getStroke()).to.be.null;
    });

    it('should add the globalHidden symbol', () => {
      const feature = new Feature();
      GH.addFeature('test', feature);
      expect(feature).to.have.property(globalHidden, true);
    });

    it('should set the originalStyle symbol', () => {
      const feature = new Feature();
      const style = new Style({});
      feature.setStyle(style);
      GH.addFeature('test', feature);
      expect(feature).to.have.property(originalStyle, style);
    });

    it('should not reset the originalStyle symbol', () => {
      const feature = new Feature();
      feature[originalStyle] = undefined;
      const style = new Style({});
      feature.setStyle(style);
      GH.addFeature('test', feature);
      expect(feature).to.have.property(originalStyle, undefined);
    });
  });

  describe('showObjects', () => {
    beforeEach(() => {
      GH.hideObjects(['test', 'test1']);
    });

    it('should reduce the counter by one', () => {
      GH.hideObjects(['test', 'test1']);
      GH.showObjects(['test']);
      expect(GH.hiddenObjects).to.have.property('test', 1);
      expect(GH.hiddenObjects).to.have.property('test1', 2);
    });

    it('should clear a set, if the features where shown', () => {
      const feature = new Feature();
      GH.addFeature('test', feature);
      GH.showObjects(['test']);
      expect(GH.hasFeature('test', feature)).to.be.false;
    });

    it('should delete the key from hidden objects', () => {
      GH.showObjects(['test']);
      expect(GH.hiddenObjects).to.not.have.property('test');
    });

    it('should raise changed event', () => {
      const spy = getCesiumEventSpy(sandbox, GH.changed);
      GH.showObjects(['test', 'test1']);
      expect(spy).to.have.been.calledWith({ action: FeatureVisibilityAction.SHOW, ids: ['test', 'test1'] });
    });

    it('should not raise changed event, if the array is empty', () => {
      const spy = getCesiumEventSpy(sandbox, GH.changed);
      GH.showObjects([]);
      expect(spy).to.not.have.been.called;
    });

    it('should not raise changed event, if the no new feature where added', () => {
      GH.showObjects(['test']);
      const spy = getCesiumEventSpy(sandbox, GH.changed);
      GH.showObjects(['test']);
      expect(spy).to.not.have.been.called;
    });

    it('should only raise the changed event for newly shown ids', () => {
      GH.hideObjects(['test']);
      const spy = getCesiumEventSpy(sandbox, GH.changed);
      GH.showObjects(['test', 'test1']);
      expect(spy).to.have.been.calledWith({ action: FeatureVisibilityAction.SHOW, ids: ['test1'] });
    });

    describe('feature handling', () => {
      describe('of features without layer feature visibilty mutations', () => {
        it('should set show to true on cesium tiles', () => {
          const tileFeature = createDummyCesium3DTileFeature();
          GH.addFeature('test', tileFeature);
          GH.showObjects(['test']);
          expect(tileFeature.show).to.be.true;
        });

        it('should set the style to null for features without there own style', () => {
          const featureWithoutStyle = new Feature();
          GH.addFeature('test', featureWithoutStyle);
          GH.showObjects(['test']);
          expect(featureWithoutStyle.getStyle()).to.be.null;
        });

        it('should set the feature style for features with there own style', () => {
          const featureWithStyle = new Feature();
          const style = new VectorStyleItem({});
          featureWithStyle[vectorStyleSymbol] = style;
          featureWithStyle.setStyle(style.style);

          GH.addFeature('test', featureWithStyle);
          GH.showObjects(['test']);
          expect(featureWithStyle.getStyle()).to.equal(style.style);
        });
      });

      describe('features hidden by layer featureVisibility', () => {
        it('should not set show to true for cesium 3D tileset features', () => {
          const tileFeature = createDummyCesium3DTileFeature();
          tileFeature[hidden] = true;
          GH.addFeature('test', tileFeature);
          GH.showObjects(['test']);
          expect(tileFeature.show).to.be.false;
        });

        it('should maintain the empty style for ol.Features', () => {
          const featureWithoutStyle = new Feature();
          featureWithoutStyle[hidden] = true;

          GH.addFeature('test', featureWithoutStyle);
          GH.showObjects(['test']);
          expect(featureWithoutStyle.getStyle()).to.be.an.instanceof(Style);
        });
      });

      describe('features highlighted features by layer featureVisibility', () => {
        it('should set the highlight style on ol.Features', () => {
          const featureWithoutStyle = new Feature();
          const highlightStyle = new VectorStyleItem({});
          featureWithoutStyle[highlighted] = highlightStyle;
          GH.addFeature('test', featureWithoutStyle);
          GH.showObjects(['test']);
          expect(featureWithoutStyle.getStyle()).to.equal(highlightStyle.style);
        });
      });
    });
  });
});
