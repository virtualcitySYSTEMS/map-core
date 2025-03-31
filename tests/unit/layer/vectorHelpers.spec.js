import Feature from 'ol/Feature.js';
import VectorLayer from '../../../src/layer/vectorLayer.js';
import { setOpenlayersMap } from '../helpers/openlayersHelpers.js';
import VcsApp from '../../../src/vcsApp.js';
import VectorStyleItem from '../../../src/style/vectorStyleItem.js';
import {
  updateGlobalHider,
  updateFeatureVisibility,
  synchronizeFeatureVisibilityWithSource,
  fvLastUpdated,
  globalHiderLastUpdated,
} from '../../../src/layer/vectorHelpers.js';
import GlobalHider from '../../../src/layer/globalHider.js';

function setupVectorLayer() {
  const vectorLayer = new VectorLayer({});
  vectorLayer.setGlobalHider(new GlobalHider());
  const ids = vectorLayer.addFeatures([
    new Feature(),
    new Feature(),
    new Feature(),
  ]);
  const highlightStyle = new VectorStyleItem({});
  vectorLayer.featureVisibility.hideObjects([ids[1], ids[2]]);
  vectorLayer.featureVisibility.highlight({
    [ids[0]]: highlightStyle,
    [ids[2]]: highlightStyle,
  });

  return {
    vectorLayer,
    highlightStyle,
    highlightFeatureId: ids[0],
    hiddenFeatureId: ids[1],
    hiddenHighlightedFeatureId: ids[2],
  };
}

describe('VectorHelpers', () => {
  let openlayers;
  let sandbox;
  let app;

  before(async () => {
    sandbox = sinon.createSandbox();
    app = new VcsApp();
    openlayers = await setOpenlayersMap(app);
  });

  after(() => {
    app.destroy();
  });

  describe('updating feature visibility', () => {
    let setup;
    let impl;
    let now;

    before(() => {
      setup = setupVectorLayer();
      [impl] = setup.vectorLayer.createImplementationsForMap(openlayers);
      updateFeatureVisibility(impl.featureVisibility, impl.source);
      now = Date.now();
      sandbox.useFakeTimers(now);
    });

    after(() => {
      sandbox.restore();
      setup.vectorLayer.destroy();
    });

    it('should add highlighted features', () => {
      const feature = impl.source.getFeatureById(setup.highlightFeatureId);
      expect(
        impl.featureVisibility.hasHighlightFeature(
          setup.highlightFeatureId,
          feature,
        ),
      ).to.be.true;
    });

    it('should add highlighted features, even if they are hidden', () => {
      const feature = impl.source.getFeatureById(
        setup.hiddenHighlightedFeatureId,
      );
      expect(
        impl.featureVisibility.hasHighlightFeature(
          setup.hiddenHighlightedFeatureId,
          feature,
        ),
      ).to.be.true;
    });

    it('should add hidden features', () => {
      const feature = impl.source.getFeatureById(setup.hiddenFeatureId);
      expect(
        impl.featureVisibility.hasHiddenFeature(setup.hiddenFeatureId, feature),
      ).to.be.true;
    });

    it('should add hidden features, even if they are highlighted', () => {
      const feature = impl.source.getFeatureById(
        setup.hiddenHighlightedFeatureId,
      );
      expect(
        impl.featureVisibility.hasHiddenFeature(
          setup.hiddenHighlightedFeatureId,
          feature,
        ),
      ).to.be.true;
    });

    it('should set FV last updated to now', () => {
      expect(impl.source[fvLastUpdated]).to.equal(now);
    });
  });

  describe('updating global hider', () => {
    let setup;
    let impl;
    let now;

    before(() => {
      setup = setupVectorLayer();
      [impl] = setup.vectorLayer.createImplementationsForMap(openlayers);
      impl.hasFeatureUUID = true;
      impl.globalHider.hideObjects([
        setup.hiddenFeatureId,
        setup.hiddenHighlightedFeatureId,
      ]);
      updateGlobalHider(impl.globalHider, impl.source);
      now = Date.now();
      sandbox.useFakeTimers(now);
    });

    after(() => {
      sandbox.restore();
      setup.vectorLayer.destroy();
    });

    it('should add hidden features', () => {
      const feature = impl.source.getFeatureById(setup.hiddenFeatureId);
      expect(impl.globalHider.hasFeature(setup.hiddenFeatureId, feature)).to.be
        .true;
    });

    it('should add hidden features, even if they are highlighted', () => {
      const feature = impl.source.getFeatureById(
        setup.hiddenHighlightedFeatureId,
      );
      expect(
        impl.globalHider.hasFeature(setup.hiddenHighlightedFeatureId, feature),
      ).to.be.true;
    });

    it('should set FV last updated to now', () => {
      expect(impl.source[globalHiderLastUpdated]).to.equal(now);
    });
  });

  describe('synchronize implementations', () => {
    describe('setting up vcs listeners', () => {
      let setup;
      let impl;
      let listeners;
      let now;
      let clock;

      before(() => {
        setup = setupVectorLayer();
        [impl] = setup.vectorLayer.createImplementationsForMap(openlayers);
        listeners = synchronizeFeatureVisibilityWithSource(
          impl.featureVisibility,
          impl.source,
          impl.globalHider,
        );
        now = Date.now();
        clock = sandbox.useFakeTimers(now);
      });

      after(() => {
        sandbox.restore();
        listeners.forEach((cb) => {
          cb();
        });
        setup.vectorLayer.destroy();
      });

      it('should add a globalHider listener', () => {
        clock.tick(1);
        const feature = impl.source.getFeatureById(setup.hiddenFeatureId);
        impl.globalHider.hideObjects([setup.hiddenFeatureId]);
        expect(impl.globalHider.hasFeature(setup.hiddenFeatureId, feature)).to
          .be.true;
        expect(impl.source[globalHiderLastUpdated]).to.equal(Date.now());
      });

      it('should add a featureVisibility highlight listener', () => {
        clock.tick(1);
        const feature = impl.source.getFeatureById(setup.hiddenFeatureId);
        impl.featureVisibility.highlight({
          [setup.hiddenFeatureId]: setup.highlightStyle,
        });
        expect(
          impl.featureVisibility.hasHighlightFeature(
            setup.hiddenFeatureId,
            feature,
          ),
        ).to.be.true;
        expect(impl.source[fvLastUpdated]).to.equal(Date.now());
      });

      it('should add a featureVisibility hide listener', () => {
        clock.tick(1);
        const feature = impl.source.getFeatureById(setup.highlightFeatureId);
        impl.featureVisibility.hideObjects([setup.highlightFeatureId]);
        expect(
          impl.featureVisibility.hasHiddenFeature(
            setup.highlightFeatureId,
            feature,
          ),
        ).to.be.true;
        expect(impl.source[fvLastUpdated]).to.equal(Date.now());
      });
    });

    describe('checking for last updated', () => {
      let setup;
      let impl;

      beforeEach(() => {
        setup = setupVectorLayer();
        [impl] = setup.vectorLayer.createImplementationsForMap(openlayers);
      });

      afterEach(() => {
        setup.vectorLayer.destroy();
      });

      it('should update hidden and highlighted features', () => {
        const listeners = synchronizeFeatureVisibilityWithSource(
          impl.featureVisibility,
          impl.source,
          impl.globalHider,
        );
        const hiddenFeature = impl.source.getFeatureById(setup.hiddenFeatureId);
        expect(
          impl.featureVisibility.hasHiddenFeature(
            setup.hiddenFeatureId,
            hiddenFeature,
          ),
        ).to.be.true;
        listeners.forEach((cb) => {
          cb();
        });
      });

      it('should update globalHider', () => {
        impl.globalHider.hideObjects([setup.hiddenFeatureId]);
        const listeners = synchronizeFeatureVisibilityWithSource(
          impl.featureVisibility,
          impl.source,
          impl.globalHider,
        );
        const hiddenFeature = impl.source.getFeatureById(setup.hiddenFeatureId);
        expect(
          impl.globalHider.hasFeature(setup.hiddenFeatureId, hiddenFeature),
        ).to.be.true;
        listeners.forEach((cb) => {
          cb();
        });
      });
    });

    describe('setting up of ol source listeners', () => {
      let setup;
      let impl;
      let listeners;
      let now;
      let clock;

      before(() => {
        setup = setupVectorLayer();
        [impl] = setup.vectorLayer.createImplementationsForMap(openlayers);
        listeners = synchronizeFeatureVisibilityWithSource(
          impl.featureVisibility,
          impl.source,
          impl.globalHider,
        );
        now = Date.now();
        clock = sandbox.useFakeTimers(now);
      });

      after(() => {
        sandbox.restore();
        listeners.forEach((cb) => {
          cb();
        });
        setup.vectorLayer.destroy();
      });

      it('should add a listener, which adds hidden features', () => {
        clock.tick(1);
        const feature = new Feature({});
        const id = 'hidden';
        feature.setId(id);
        impl.featureVisibility.hideObjects([id]);
        setup.vectorLayer.addFeatures([feature]);
        expect(impl.featureVisibility.hasHiddenFeature(id, feature)).to.be.true;
        expect(impl.source[fvLastUpdated]).to.equal(Date.now());
      });

      it('should add a listener, which adds a highlighted features', () => {
        clock.tick(1);
        const feature = new Feature({});
        const id = 'highlighted';
        feature.setId(id);
        impl.featureVisibility.highlight({ [id]: setup.highlightStyle });
        setup.vectorLayer.addFeatures([feature]);
        expect(impl.featureVisibility.hasHighlightFeature(id, feature)).to.be
          .true;
        expect(impl.source[fvLastUpdated]).to.equal(Date.now());
      });

      it('should add a listener, which adds globally hidden features', () => {
        clock.tick(1);
        const feature = new Feature({});
        const id = 'globalHidden';
        feature.setId(id);
        impl.globalHider.hideObjects([id]);
        setup.vectorLayer.addFeatures([feature]);
        expect(impl.globalHider.hasFeature(id, feature)).to.be.true;
        expect(impl.source[globalHiderLastUpdated]).to.equal(Date.now());
      });
    });
  });
});
