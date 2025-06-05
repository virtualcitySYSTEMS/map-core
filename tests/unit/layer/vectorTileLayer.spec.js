import Feature from 'ol/Feature.js';
import Style from 'ol/style/Style.js';
import Point from 'ol/geom/Point.js';
import VectorTileLayer from '../../../src/layer/vectorTileLayer.js';
import URLTemplateTileProvider from '../../../src/layer/tileProvider/urlTemplateTileProvider.js';
import TileProviderFeatureProvider from '../../../src/featureProvider/tileProviderFeatureProvider.js';
import { vcsLayerName } from '../../../src/layer/layerSymbols.js';
import GlobalHider from '../../../src/layer/globalHider.js';
import VectorStyleItem from '../../../src/style/vectorStyleItem.js';

describe('VectorTileLayer', () => {
  describe('initialization', () => {
    let vectorTile;

    before(async () => {
      vectorTile = new VectorTileLayer({
        tileProvider: {
          type: 'URLTemplateTileProvider',
          url: 'myURL',
          baseLevels: [0],
        },
      });
      vectorTile.setGlobalHider(new GlobalHider());
      await vectorTile.initialize();
    });

    after(() => {
      vectorTile.destroy();
    });

    it('should create TileProvider', () => {
      expect(vectorTile.tileProvider).to.be.instanceOf(URLTemplateTileProvider);
    });

    it('should create FeatureProvider', () => {
      expect(vectorTile.featureProvider).to.be.instanceOf(
        TileProviderFeatureProvider,
      );
    });
  });

  describe('featureVisibility', () => {
    let sandbox;

    let featureWithId;
    let hiddenFeature;
    let globallyHiddenFeature;
    let featureWithoutId;
    let featureWithStyle;
    let highlightedFeature;

    /** @type {import("@vcmap/core").VectorTileLayer} */
    let vectorTile;

    before(() => {
      sandbox = sinon.createSandbox();
      featureWithId = new Feature({ geometry: new Point([1, 1, 0]) });
      featureWithId.setId('featureWithId1');
      hiddenFeature = new Feature({ geometry: new Point([1, 1, 0]) });
      hiddenFeature.setId('hiddenFeature');
      globallyHiddenFeature = new Feature({ geometry: new Point([1, 1, 0]) });
      globallyHiddenFeature.setId('globallyHiddenFeature');
      highlightedFeature = new Feature({ geometry: new Point([1, 1, 0]) });
      highlightedFeature.setId('highlightedFeature');
      featureWithoutId = new Feature({ geometry: new Point([1, 2, 0]) });
      featureWithStyle = new Feature({ geometry: new Point([1, 3, 0]) });
      featureWithStyle.setStyle(new Style({}));
      featureWithStyle.setId('featureWithStyle');
    });

    afterEach(() => {
      sandbox.restore();
    });

    after(() => {
      vectorTile.destroy();
    });

    describe('on tileLoadEvent', () => {
      before(async () => {
        vectorTile = new VectorTileLayer({
          tileProvider: {
            type: 'URLTemplateTileProvider',
            url: 'myURL',
            baseLevels: [0],
          },
        });
        vectorTile.setGlobalHider(new GlobalHider());
        await vectorTile.initialize();
        vectorTile.featureVisibility.hideObjects(['hiddenFeature']);
        vectorTile.featureVisibility.highlight({
          highlightedFeature: new Style({}),
        });
        vectorTile.globalHider.hideObjects(['globallyHiddenFeature']);
        sandbox
          .stub(vectorTile.tileProvider, 'loader')
          .resolves([
            featureWithStyle,
            featureWithId,
            hiddenFeature,
            globallyHiddenFeature,
            featureWithoutId,
            highlightedFeature,
          ]);
        await vectorTile.tileProvider.getFeaturesForTile(0, 0, 0);
      });

      after(() => {
        vectorTile.globalHider.showObjects(['globallyHiddenFeature']);
        vectorTile.destroy();
      });

      it('should make sure all features have an ID', () => {
        const features = [];
        vectorTile.tileProvider.forEachFeature((feature) => {
          expect(feature.getId()).to.not.be.undefined;
          features.push(feature);
        });
        expect(features).to.have.lengthOf(6);
      });

      it('should set the vcsLayerName symbol on each feature', () => {
        vectorTile.tileProvider.forEachFeature((feature) => {
          expect(feature[vcsLayerName]).to.be.equal(vectorTile.name);
        });
      });

      it('should return empty style if hidden by featureVisibility', () => {
        expect(hiddenFeature.getStyleFunction()(hiddenFeature, 0)).to.be.empty;
      });

      it('should return empty style if hidden by globalHider', () => {
        expect(
          globallyHiddenFeature.getStyleFunction()(globallyHiddenFeature, 0),
        ).to.be.empty;
      });

      it('should return highlighted style for highlighted features', () => {
        expect(
          highlightedFeature.getStyleFunction()(highlightedFeature, 0),
        ).to.have.members([
          vectorTile.featureVisibility.highlightedObjects.highlightedFeature
            .style.style,
        ]);
      });

      it('should set Z Index on featureStyle if exists.', () => {
        const style = featureWithStyle.getStyleFunction()(
          featureWithStyle,
          0,
        )[0];
        expect(style.getZIndex()).to.not.be.undefined;
      });
    });

    describe('Change events', () => {
      before(async () => {
        vectorTile = new VectorTileLayer({
          tileProvider: {
            type: 'URLTemplateTileProvider',
            url: 'myURL',
            baseLevels: [0],
          },
        });
        vectorTile.setGlobalHider(new GlobalHider());
        await vectorTile.initialize();
        await vectorTile.activate();
        sandbox
          .stub(vectorTile.tileProvider, 'loader')
          .resolves([
            featureWithStyle,
            featureWithId,
            hiddenFeature,
            globallyHiddenFeature,
            featureWithoutId,
            highlightedFeature,
          ]);
        await vectorTile.tileProvider.getFeaturesForTile(0, 0, 0);
      });

      after(() => {
        vectorTile.destroy();
      });

      it('should return the highlighted style for feature', () => {
        let styles = featureWithStyle.getStyleFunction()(featureWithStyle, 0);
        expect(styles[0]).to.be.equal(featureWithStyle.getStyle());
        const highlightStyle = new Style({});
        vectorTile.featureVisibility.highlight({
          featureWithStyle: highlightStyle,
        });
        styles = featureWithStyle.getStyleFunction()(featureWithStyle, 0);
        expect(styles[0]).to.be.equal(highlightStyle);
        vectorTile.featureVisibility.clearHighlighting();
      });

      it('should reset highlighted state on unHighlight', () => {
        const highlightStyle = new Style({});
        vectorTile.featureVisibility.highlight({
          featureWithStyle: highlightStyle,
        });
        let style = featureWithStyle.getStyleFunction()(featureWithStyle, 0)[0];
        expect(style).to.be.equal(highlightStyle);
        vectorTile.featureVisibility.unHighlight(['featureWithStyle']);
        style = featureWithStyle.getStyleFunction()(featureWithStyle, 0)[0];
        expect(style).to.be.equal(featureWithStyle.getStyle());
      });

      it('should return empty style if feature is hidden', () => {
        let styles = hiddenFeature.getStyleFunction()(hiddenFeature, 0);
        expect(styles[0]).to.be.equal(vectorTile.style.style);
        vectorTile.featureVisibility.hideObjects(['hiddenFeature']);
        styles = hiddenFeature.getStyleFunction()(hiddenFeature, 0);
        expect(styles).to.be.empty;
      });

      it('should reset hidden state on show', () => {
        vectorTile.featureVisibility.hideObjects(['hiddenFeature']);
        let styles = hiddenFeature.getStyleFunction()(hiddenFeature, 0);
        expect(styles).to.be.empty;
        vectorTile.featureVisibility.clearHiddenObjects();
        styles = hiddenFeature.getStyleFunction()(hiddenFeature, 0);
        expect(styles[0]).to.be.equal(vectorTile.style.style);
      });

      it('should not update featureVisibility if layer is deactivated', () => {
        vectorTile.deactivate();
        vectorTile.featureVisibility.hideObjects(['hiddenFeature']);
        const styles = hiddenFeature.getStyleFunction()(hiddenFeature, 0);
        expect(styles).to.not.be.empty;
      });

      it('should update featureVisibility if layer is activated', async () => {
        vectorTile.deactivate();
        vectorTile.featureVisibility.hideObjects(['hiddenFeature']);
        let styles = hiddenFeature.getStyleFunction()(hiddenFeature, 0);
        expect(styles).to.not.be.empty;
        await vectorTile.activate();
        styles = hiddenFeature.getStyleFunction()(hiddenFeature, 0);
        expect(styles).to.be.empty;
      });
    });
    describe('on disabled tileProvider featureTracking', () => {
      before(async () => {
        hiddenFeature = new Feature({ geometry: new Point([1, 1, 0]) });
        hiddenFeature.setId('hiddenFeature');
        vectorTile = new VectorTileLayer({
          tileProvider: {
            type: 'URLTemplateTileProvider',
            url: 'myURL',
            trackFeaturesToTiles: false,
            baseLevels: [0],
          },
        });
        vectorTile.setGlobalHider(new GlobalHider());
        await vectorTile.initialize();
        await vectorTile.activate();
        sandbox
          .stub(vectorTile.tileProvider, 'loader')
          .resolves([hiddenFeature]);
        await vectorTile.tileProvider.getFeaturesForTile(0, 0, 0);
      });

      after(() => {
        vectorTile.destroy();
      });

      it('should not hide feature if hidden', async () => {
        vectorTile.featureVisibility.hideObjects(['hiddenFeature']);
        const styles = hiddenFeature.getStyleFunction()(hiddenFeature, 0);
        expect(styles).to.not.be.empty;
      });
    });
  });

  describe('setting globalHider', () => {
    let sandbox;
    /** @type {import("@vcmap/core").VectorTileLayer} */
    let vectorTile;

    before(() => {
      sandbox = sinon.createSandbox();
      vectorTile = new VectorTileLayer({
        tileProvider: {
          type: 'URLTemplateTileProvider',
          url: 'myURL',
          baseLevels: [0],
        },
      });
    });

    after(() => {
      sandbox.restore();
      vectorTile.globalHider.showObjects(['globallyHiddenFeature']);
      vectorTile.destroy();
    });

    it('should update featureVisibility listeners', () => {
      const updateTilesSpy = sandbox.spy(vectorTile, '_updateTiles');
      vectorTile.setGlobalHider(new GlobalHider());
      vectorTile.globalHider.hideObjects(['globallyHiddenFeature']);
      expect(updateTilesSpy).to.have.been.called;
    });
  });

  describe('getConfigObject', () => {
    let configObject;
    let options;
    let vectorTile;
    let highlightStyle;

    before(() => {
      highlightStyle = new VectorStyleItem({
        fill: { color: 'rgba(255, 0, 0, 0.5)' },
      });
      options = {
        minLevel: 12,
        maxLevel: 13,
        debug: true,
        highlightStyle,
        vectorProperties: { heightAboveGround: 12 },
        tileProvider: {
          type: 'URLTemplateTileProvider',
          url: 'myURL',
          name: 'myUrlTileProvider',
        },
      };
      vectorTile = new VectorTileLayer(options);
      configObject = vectorTile.toJSON();
    });

    after(() => {
      vectorTile.destroy();
    });

    it('should export maxLevel', () => {
      expect(configObject.maxLevel).to.be.equal(13);
    });

    it('should export minLevel', () => {
      expect(configObject.minLevel).to.be.equal(12);
    });

    it('should export debug state', () => {
      expect(configObject.debug).to.be.equal(true);
    });

    it('should export highlightStyle', () => {
      expect(configObject.highlightStyle).to.be.deep.equal(
        highlightStyle.toJSON(),
      );
    });

    it('should export vectorProperties Options', () => {
      expect(configObject.vectorProperties).to.be.deep.equal(
        options.vectorProperties,
      );
    });

    it('should export tileProvider Options', () => {
      expect(configObject.tileProvider).to.be.deep.equal(options.tileProvider);
    });

    it('should not export default Options', () => {
      const defaultVectorTile = new VectorTileLayer({});
      expect(defaultVectorTile.toJSON()).to.have.keys([
        'name',
        'type',
        'tileProvider',
      ]);
    });
  });
});
