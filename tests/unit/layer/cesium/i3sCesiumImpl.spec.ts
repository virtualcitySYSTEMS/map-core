import type {
  Cesium3DTile,
  Cesium3DTileset,
  Cesium3DTileFeature,
  Cesium3DTileContent,
  I3SLayer as CesiumI3SLayer,
} from '@vcmap-cesium/engine';
import {
  Cesium3DTileColorBlendMode,
  SplitDirection,
  I3SDataProvider,
  Rectangle,
  Event as CesiumEvent,
} from '@vcmap-cesium/engine';
import type { SinonFakeTimers, SinonSandbox } from 'sinon';
import sinon from 'sinon';
import { expect } from 'chai';
import I3SLayer from '../../../../src/layer/i3sLayer.js';
import DeclarativeStyleItem from '../../../../src/style/declarativeStyleItem.js';
import VcsApp from '../../../../src/vcsApp.js';
import getDummyCesium3DTileset from './getDummyCesium3DTileset.js';
import {
  setCesiumMap,
  createDummyCesium3DTileFeature,
} from '../../helpers/cesiumHelpers.js';
import VectorStyleItem from '../../../../src/style/vectorStyleItem.js';
import {
  cesiumTilesetLastUpdated,
  updateFeatureOverride,
} from '../../../../src/layer/cesium/cesiumTilesetCesiumImpl.js';
import { vcsLayerName } from '../../../../src/layer/layerSymbols.js';
import GlobalHider from '../../../../src/layer/globalHider.js';
import { timeout } from '../../helpers/helpers.js';
import TestAttributeProvider from '../../featureProvider/testAttributeProvider.js';
import type VcsMap from '../../../../src/map/vcsMap.js';
import type I3SCesiumImpl from '../../../../src/layer/cesium/i3sCesiumImpl.js';

describe('I3SCesiumImpl', () => {
  let sandbox: SinonSandbox;
  let i3sLayer: I3SLayer;
  let cesiumMap: VcsMap;
  let i3sCesiumImpl: I3SCesiumImpl;
  let highlightStyle: VectorStyleItem;
  let app: VcsApp;
  let i3sDataProvider: I3SDataProvider;
  let makeStyleDirtyStub: sinon.SinonStub;

  before(async () => {
    sandbox = sinon.createSandbox();
    app = new VcsApp();
    cesiumMap = await setCesiumMap(app);
    highlightStyle = new VectorStyleItem({ fill: { color: [0, 255, 0, 1] } });
  });

  beforeEach(() => {
    const tileset = getDummyCesium3DTileset() as Cesium3DTileset;
    tileset.tileLoad = new CesiumEvent();
    makeStyleDirtyStub = sandbox.stub(tileset, 'makeStyleDirty');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    tileset.extras._3DTILESDIFFUSE = true;
    i3sDataProvider = {
      destroy: sandbox.spy(),
      show: false,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      layers: [{ tileset } as CesiumI3SLayer],
    } as unknown as I3SDataProvider;
    sandbox.stub(I3SDataProvider, 'fromUrl').resolves(i3sDataProvider);

    i3sLayer = new I3SLayer({
      url: 'http://test.com/layer',
    });
    i3sLayer.setGlobalHider(new GlobalHider());
    [i3sCesiumImpl] = i3sLayer.getImplementationsForMap(cesiumMap);
  });

  afterEach(() => {
    i3sLayer.destroy();
    sandbox.restore();
  });

  after(() => {
    app.destroy();
  });

  describe('updating split direction', () => {
    it('should set the split direction on the i3sDataProvider layers', async () => {
      await i3sCesiumImpl.initialize();
      i3sCesiumImpl.updateSplitDirection(SplitDirection.LEFT);
      expect(i3sDataProvider.layers[0].tileset).to.have.property(
        'splitDirection',
        SplitDirection.LEFT,
      );
    });
  });

  describe('initialize', () => {
    it('creates a new I3SDataProvider, adding vcsLayerName', async () => {
      await i3sCesiumImpl.initialize();
      expect(i3sCesiumImpl.data).to.equal(i3sDataProvider);
      expect(i3sCesiumImpl.data).to.have.property(
        vcsLayerName,
        i3sCesiumImpl.name,
      );
    });

    it('adds an unload event listener, which removed the lastUpdated symbol', async () => {
      const test = {
        [cesiumTilesetLastUpdated]: true,
        content: {
          [cesiumTilesetLastUpdated]: true,
          [updateFeatureOverride]: (): void => {},
        },
      };
      await i3sCesiumImpl.initialize();
      i3sDataProvider.layers[0].tileset?.tileUnload.raiseEvent(test);
      expect(test).to.not.have.property(cesiumTilesetLastUpdated);
      expect(test.content).to.not.have.property(cesiumTilesetLastUpdated);
      expect(test.content).to.not.have.property(updateFeatureOverride);
    });

    it('should set the style and the color blend mode', async () => {
      i3sCesiumImpl.style = new DeclarativeStyleItem({
        declarativeStyle: { show: false },
        colorBlendMode: Cesium3DTileColorBlendMode.REPLACE,
      });
      await i3sCesiumImpl.initialize();
      expect(i3sDataProvider.layers[0].tileset?.style).to.equal(
        i3sCesiumImpl.style.cesiumStyle,
      );
      expect(i3sDataProvider.layers[0].tileset?.colorBlendMode).to.equal(
        Cesium3DTileColorBlendMode.REPLACE,
      );
    });

    it('should add an changed handler to the style', async () => {
      await i3sCesiumImpl.initialize();
      i3sLayer.style.styleChanged.raiseEvent();
      expect(makeStyleDirtyStub).to.have.been.called;
    });

    it('should update the split direction on initialize', async () => {
      i3sCesiumImpl.splitDirection = SplitDirection.LEFT;
      await i3sCesiumImpl.initialize();
      expect(i3sDataProvider.layers[0].tileset?.splitDirection).to.equal(
        i3sCesiumImpl.splitDirection,
      );
    });

    it('should not show the i3sDataProvider', async () => {
      await i3sCesiumImpl.initialize();
      expect(i3sCesiumImpl.data?.show).to.be.false;
    });
  });

  describe('activate', () => {
    it('should set the show property on the data provider to true', async () => {
      await i3sCesiumImpl.activate();
      expect(i3sCesiumImpl.data).to.have.property('show', true);
    });
  });

  describe('deactivate', () => {
    it('should set the show property on the data provider to false', async () => {
      await i3sCesiumImpl.activate();
      i3sCesiumImpl.deactivate();
      expect(i3sCesiumImpl.data).to.have.property('show', false);
    });
  });

  describe('updateStyle', () => {
    let styleItem: DeclarativeStyleItem;

    before(() => {
      styleItem = new DeclarativeStyleItem({
        declarativeStyle: { show: false },
      });
    });

    beforeEach(async () => {
      await i3sCesiumImpl.initialize();
    });

    it('should set style on the cesium tileset', () => {
      i3sCesiumImpl.updateStyle(styleItem);
      expect(i3sDataProvider.layers[0].tileset)
        .to.have.property('style')
        .and.to.have.property('style')
        .and.to.have.property('show', 'false');
    });

    it('should attach an event listener to style changed, setting the style dirty and update timers', () => {
      const now = Date.now();
      sandbox.useFakeTimers(now);
      i3sCesiumImpl.updateStyle(styleItem);
      styleItem.styleChanged.raiseEvent();
      expect(makeStyleDirtyStub).to.have.been.called;
    });

    it('should always remove a previous style changed handler', () => {
      const style2 = new DeclarativeStyleItem({
        declarativeStyle: { show: false },
      });
      i3sCesiumImpl.updateStyle(styleItem);
      styleItem.styleChanged.raiseEvent();
      expect(makeStyleDirtyStub).to.have.been.called;
      makeStyleDirtyStub.resetHistory();

      i3sCesiumImpl.updateStyle(style2);
      style2.styleChanged.raiseEvent();
      expect(makeStyleDirtyStub).to.have.been.called;
    });

    it('should set style.colorBlendMode to the cesium 3DTileset.colorBlendMode', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      i3sDataProvider.layers[0].tileset!.extras._3DTILESDIFFUSE = true;
      const colorBlendStyle = new DeclarativeStyleItem({
        declarativeStyle: { show: false },
        colorBlendMode: Cesium3DTileColorBlendMode.REPLACE,
      });
      i3sCesiumImpl.updateStyle(colorBlendStyle);
      expect(i3sDataProvider.layers[0].tileset?.colorBlendMode).to.equal(
        Cesium3DTileColorBlendMode.REPLACE,
      );
    });

    it('should not set style.colorBlendMode to the cesium 3DTileset.colorBlendMode if the _3DTILESDIFFUSE is set', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      i3sDataProvider.layers[0].tileset!.extras._3DTILESDIFFUSE = false;
      const colorBlendStyle = new DeclarativeStyleItem({
        declarativeStyle: { show: false },
        colorBlendMode: Cesium3DTileColorBlendMode.REPLACE,
      });
      i3sCesiumImpl.updateStyle(colorBlendStyle);
      expect(i3sDataProvider.layers[0].tileset?.colorBlendMode).to.equal(
        Cesium3DTileColorBlendMode.HIGHLIGHT,
      );
    });
  });

  describe('applyStyle', () => {
    beforeEach(async () => {
      await i3sCesiumImpl.initialize();
    });

    it('should call styleContent for cesium3DTile', () => {
      const tile = {
        contentReady: true,
        content: {
          featuresLength: 0,
        },
      };
      i3sCesiumImpl.applyStyle(tile as Cesium3DTile);
      expect(tile.content).to.have.property(cesiumTilesetLastUpdated);
    });
  });

  describe('styleContent', () => {
    let clock: SinonFakeTimers;
    let now: number;
    let feature: Cesium3DTileFeature;
    let content: Partial<Cesium3DTileContent>;

    beforeEach(async () => {
      now = Date.now();
      clock = sandbox.useFakeTimers(now);
      feature = createDummyCesium3DTileFeature({ id: 'test' });

      content = {
        featuresLength: 1,
        getFeature(): Cesium3DTileFeature {
          return feature;
        },
      };
      await i3sCesiumImpl.initialize();
    });

    it('should set the last updated, if the content does not already have TilesetLayer.lastUpdated', () => {
      i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
      expect(content).to.have.property(cesiumTilesetLastUpdated, now);
    });

    it('should update the content, if the contents last updated is older the featureVisibility.lastUpdated', () => {
      content = { [cesiumTilesetLastUpdated]: now };
      clock.tick(1);
      i3sCesiumImpl.featureVisibility.lastUpdated = now + 1;
      i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
      expect(content).to.have.property(cesiumTilesetLastUpdated, now + 1);
    });

    it('should update the content, if the content last updated is older then the globalHider.lastUpdated', () => {
      content = { [cesiumTilesetLastUpdated]: now };
      clock.tick(1);
      i3sCesiumImpl.globalHider!.lastUpdated = now + 1;
      i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
      expect(content).to.have.property(cesiumTilesetLastUpdated, now + 1);
    });

    it('should update the content, if the contents last update is older then the _styleLastUpated', () => {
      content = { [cesiumTilesetLastUpdated]: now };
      clock.tick(1);
      i3sCesiumImpl.updateStyle(new DeclarativeStyleItem({}));
      i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
      expect(content).to.have.property(cesiumTilesetLastUpdated, now + 1);
    });

    describe('hide objects - FV', () => {
      beforeEach(() => {
        i3sCesiumImpl.featureVisibility.hideObjects(['test']);
      });

      it('should set a hidden objects show to false', () => {
        i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
        expect(feature).to.have.property('show', false);
      });

      it('should add the feature to the set', () => {
        i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
        i3sCesiumImpl.featureVisibility.hasHiddenFeature('test', feature);
      });

      it('should re-hide the feature when calling the update feature override', () => {
        i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
        feature.show = true;
        i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
        expect(feature).to.have.property('show', false);
      });
    });

    describe('hide objects - GH', () => {
      beforeEach(() => {
        i3sCesiumImpl.globalHider?.hideObjects(['test']);
      });

      afterEach(() => {
        i3sCesiumImpl.globalHider?.showObjects(['test']);
      });

      it('should set a hidden objects show to false', () => {
        i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
        expect(feature).to.have.property('show', false);
      });

      it('should add the feature to the set', () => {
        i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
        expect(i3sLayer.globalHider?.hasFeature('test', feature)).to.be.true;
      });

      it('should re-hide the feature when calling the update feature override', () => {
        i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
        feature.show = true;
        i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
        expect(feature).to.have.property('show', false);
      });
    });

    describe('unhide objects - FV', () => {
      beforeEach(() => {
        i3sCesiumImpl.featureVisibility.hideObjects(['test']);
        i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
      });

      it('should set a previously hidden objects show to true when unhiding', () => {
        i3sCesiumImpl.featureVisibility.showObjects(['test']);
        i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
        expect(feature).to.have.property('show', true);
      });

      it('should remove the feature from the hidden set', () => {
        i3sCesiumImpl.featureVisibility.showObjects(['test']);
        i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
        expect(
          i3sCesiumImpl.featureVisibility.hasHiddenFeature('test', feature),
        ).to.not.be.true;
      });
    });

    describe('unhide objects - GH', () => {
      beforeEach(() => {
        i3sCesiumImpl.globalHider?.hideObjects(['test']);
        i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
      });

      it('should set a previously hidden objects show to true when unhiding', () => {
        i3sCesiumImpl.globalHider?.showObjects(['test']);
        i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
        expect(feature).to.have.property('show', true);
      });

      it('should remove the feature from the global hider set', () => {
        i3sCesiumImpl.globalHider?.showObjects(['test']);
        i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
        expect(i3sLayer.globalHider?.hasFeature('test', feature)).to.be.false;
      });
    });

    describe('unhighlight objects', () => {
      beforeEach(async () => {
        await i3sCesiumImpl.initialize();
        i3sCesiumImpl.featureVisibility.highlight({
          test: highlightStyle,
        });
        i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
      });

      it('should call makeStyleDirty when unhighlighting', () => {
        i3sCesiumImpl.featureVisibility.unHighlight(['test']);
        expect(makeStyleDirtyStub).to.have.been.called;
      });

      it('should remove the feature from the highlighted set', () => {
        i3sCesiumImpl.featureVisibility.unHighlight(['test']);
        i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
        expect(
          i3sCesiumImpl.featureVisibility.hasHighlightFeature('test', feature),
        ).to.not.be.true;
      });
    });

    describe('combined hide and highlight', () => {
      it('should prioritize hiding over highlighting', () => {
        i3sCesiumImpl.featureVisibility.hideObjects(['test']);
        i3sCesiumImpl.featureVisibility.highlight({
          test: highlightStyle,
        });
        i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
        expect(feature).to.have.property('show', false);
      });

      it('should highlight when global hider hides but feature visibility shows', () => {
        i3sCesiumImpl.globalHider?.hideObjects(['test']);
        i3sCesiumImpl.featureVisibility.highlight({
          test: highlightStyle,
        });
        i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
        expect(feature).to.have.property('show', false);
      });

      it('should remain hidden when unhighlighting a hidden feature', () => {
        i3sCesiumImpl.featureVisibility.hideObjects(['test']);
        i3sCesiumImpl.featureVisibility.highlight({
          test: highlightStyle,
        });
        i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
        expect(feature).to.have.property('show', false);

        i3sCesiumImpl.featureVisibility.unHighlight(['test']);
        i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
        expect(feature).to.have.property('show', false);
      });

      it('should remain highlighted when unhiding a highlighted feature', () => {
        i3sCesiumImpl.featureVisibility.hideObjects(['test']);
        i3sCesiumImpl.featureVisibility.highlight({
          test: highlightStyle,
        });
        i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
        expect(feature).to.have.property('show', false);

        i3sCesiumImpl.featureVisibility.showObjects(['test']);
        i3sCesiumImpl.styleContent(content as Cesium3DTileContent);
        expect(feature).to.have.property('show', true);
        expect(feature.color).to.equal(highlightStyle.cesiumFillColor);
      });
    });
  });

  describe('augmenting feature on load', () => {
    let feature: Cesium3DTileFeature;
    let content: Partial<Cesium3DTileContent>;

    beforeEach(async () => {
      feature = createDummyCesium3DTileFeature({ id: 'test' }, i3sLayer);
      content = {
        featuresLength: 1,
        getFeature(): Cesium3DTileFeature {
          return feature;
        },
      };
      i3sCesiumImpl.attributeProvider = new TestAttributeProvider(42);
      await i3sCesiumImpl.initialize();
    });

    it('should add attributes from the attribute provider to the feature', async () => {
      i3sDataProvider.layers[0].tileset?.tileLoad.raiseEvent({
        content,
        contentBoundingVolume: {
          rectangle: new Rectangle(),
        },
      });
      await timeout(0);
      expect(feature.getAttributes()).to.have.property('testAttribute', 42);
    });
  });
});
