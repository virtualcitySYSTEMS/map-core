import {
  Cesium3DTileset,
  Cesium3DTileColorBlendMode,
  SplitDirection,
  Composite3DTileContent,
  Cesium3DTile,
  BoundingSphere,
  Matrix4,
  Cartesian3,
  Math as CesiumMath,
  Resource,
  Color,
  CustomShader,
} from '@vcmap-cesium/engine';
import CesiumTilesetLayer from '../../../../src/layer/cesiumTilesetLayer.js';
import DeclarativeStyleItem from '../../../../src/style/declarativeStyleItem.js';
import VcsApp from '../../../../src/vcsApp.js';
import getDummyCesium3DTileset from './getDummyCesium3DTileset.js';
import {
  createTilesetServer,
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

describe('CesiumTilesetCesiumImpl', () => {
  let sandbox;
  /** @type {import("@vcmap/core").CesiumTilesetLayer} */
  let cesiumTileset;
  /** @type {import("@vcmap/core").CesiumMap} */
  let cesiumMap;
  /** @type {import("@vcmap/core").CesiumTilesetCesiumImpl} */
  let cesiumTilesetCesium;
  let highlightStyle;
  let app;

  before(async () => {
    sandbox = sinon.createSandbox();
    app = new VcsApp();
    cesiumMap = await setCesiumMap(app);
    highlightStyle = new VectorStyleItem({ fill: { color: [0, 255, 0, 1] } });
  });

  beforeEach(() => {
    createTilesetServer(sandbox);
    cesiumTileset = new CesiumTilesetLayer({
      url: 'http://test.com/tileset.json',
    });
    cesiumTileset.setGlobalHider(new GlobalHider());
    [cesiumTilesetCesium] = cesiumTileset.getImplementationsForMap(cesiumMap);
  });

  afterEach(() => {
    cesiumTileset.destroy();
    sandbox.restore();
  });

  after(() => {
    app.destroy();
  });

  describe('updating split direction', () => {
    it('should set the split direction on the cesium3DTileset', async () => {
      await cesiumTilesetCesium.activate();
      cesiumTilesetCesium.updateSplitDirection(SplitDirection.LEFT);
      expect(cesiumTilesetCesium.cesium3DTileset).to.have.property(
        'splitDirection',
        SplitDirection.LEFT,
      );
    });
  });

  describe('initialize', () => {
    it('should try again with a prefixed tileset.json, if the url could not be loaded', async () => {
      cesiumTileset = new CesiumTilesetLayer({
        url: 'http://test.com/',
      });
      [cesiumTilesetCesium] = cesiumTileset.getImplementationsForMap(cesiumMap);
      await cesiumTilesetCesium.initialize();
      expect(cesiumTilesetCesium.cesium3DTileset).to.exist;
    });

    it('creates a new cesium 3DTileset, adding vcsLayerName', async () => {
      await cesiumTilesetCesium.initialize();
      expect(cesiumTilesetCesium)
        .to.have.property('cesium3DTileset')
        .and.to.be.an.instanceof(Cesium3DTileset);
      expect(cesiumTilesetCesium.cesium3DTileset).to.have.property(
        vcsLayerName,
        cesiumTilesetCesium.name,
      );
    });

    it('adds an unload event listener, which removed the lastUpdated symbol', async () => {
      const test = {
        [cesiumTilesetLastUpdated]: true,
        content: {
          [cesiumTilesetLastUpdated]: true,
          [updateFeatureOverride]: () => {},
        },
      };
      await cesiumTilesetCesium.initialize();
      cesiumTilesetCesium.cesium3DTileset.tileUnload.raiseEvent(test);
      expect(test).to.not.have.property(cesiumTilesetLastUpdated);
      expect(test.content).to.not.have.property(cesiumTilesetLastUpdated);
      expect(test.content).to.not.have.property(updateFeatureOverride);
    });

    it('should set the style and the color blend mode', async () => {
      cesiumTilesetCesium.style = new DeclarativeStyleItem({
        declarativeStyle: { show: false },
        colorBlendMode: Cesium3DTileColorBlendMode.REPLACE,
      });
      await cesiumTilesetCesium.initialize();
      expect(cesiumTilesetCesium.cesium3DTileset.style).to.equal(
        cesiumTilesetCesium.style.cesiumStyle,
      );
      expect(cesiumTilesetCesium.cesium3DTileset.colorBlendMode).to.equal(
        Cesium3DTileColorBlendMode.REPLACE,
      );
    });

    it('should add an changed handler to the style', async () => {
      await cesiumTilesetCesium.initialize();
      const makeStyleDirty = sandbox.spy(
        cesiumTilesetCesium.cesium3DTileset,
        'makeStyleDirty',
      );
      cesiumTileset.style.styleChanged.raiseEvent();
      expect(makeStyleDirty).to.have.been.called;
    });

    it('should update the split direction on initialize', async () => {
      cesiumTilesetCesium.splitDirection = SplitDirection.LEFT;
      await cesiumTilesetCesium.initialize();
      expect(cesiumTilesetCesium.cesium3DTileset.splitDirection).to.equal(
        cesiumTilesetCesium.splitDirection,
      );
    });

    it('should not show the cesium3DTiles', async () => {
      await cesiumTilesetCesium.initialize();
      expect(cesiumTilesetCesium.cesium3DTileset.show).to.be.false;
    });

    describe('setting of model matrix', () => {
      let matrix;

      before(() => {
        matrix = Matrix4.fromUniformScale(3);
      });

      it('should set a model matrix', async () => {
        cesiumTilesetCesium.modelMatrix = matrix;
        await cesiumTilesetCesium.initialize();
        expect(
          Matrix4.equals(
            cesiumTilesetCesium.cesium3DTileset.modelMatrix,
            matrix,
          ),
        ).to.be.true;
      });

      it('should calculate an offset', async () => {
        cesiumTilesetCesium.offset = [0, 0, 20];
        await cesiumTilesetCesium.initialize();
        const expectedTransformation = Matrix4.fromTranslation(
          new Cartesian3(
            11.842489861883223,
            2.8160056717460975,
            15.869012127630413,
          ),
        );
        const isEqual = Matrix4.equalsEpsilon(
          cesiumTilesetCesium.cesium3DTileset.modelMatrix,
          expectedTransformation,
          CesiumMath.EPSILON6,
        );
        expect(isEqual).to.be.true;
      });

      it('should set the model matrix over the offset', async () => {
        cesiumTilesetCesium.offset = [0, 0, 20];
        cesiumTilesetCesium.modelMatrix = matrix;
        await cesiumTilesetCesium.initialize();
        expect(
          Matrix4.equals(
            cesiumTilesetCesium.cesium3DTileset.modelMatrix,
            matrix,
          ),
        ).to.be.true;
      });
    });
  });

  describe('activate', () => {
    it('should set the show property on the tilset to true', async () => {
      await cesiumTilesetCesium.activate();
      expect(cesiumTilesetCesium)
        .to.have.property('cesium3DTileset')
        .and.to.have.property('show', true);
    });
  });

  describe('deactivate', () => {
    it('should set the show property on the tilset to true', async () => {
      await cesiumTilesetCesium.activate();
      cesiumTilesetCesium.deactivate();
      expect(cesiumTilesetCesium)
        .to.have.property('cesium3DTileset')
        .and.to.have.property('show', false);
    });
  });

  describe('updateStyle', () => {
    let styleItem;

    before(() => {
      styleItem = new DeclarativeStyleItem({
        declarativeStyle: { show: false },
      });
    });

    beforeEach(async () => {
      await cesiumTilesetCesium.initialize();
    });

    it('should set style on the cesium tileset', () => {
      cesiumTilesetCesium.updateStyle(styleItem);
      expect(cesiumTilesetCesium)
        .to.have.property('cesium3DTileset')
        .and.to.have.property('style')
        .and.to.have.property('style')
        .and.to.have.property('show', 'false');
    });

    it('should attach an event listener to style changed, setting the style dirty and update timers', () => {
      const now = Date.now();
      sandbox.useFakeTimers(now);
      cesiumTilesetCesium.updateStyle(styleItem);
      const makeStyleDirty = sandbox.spy(
        cesiumTilesetCesium.cesium3DTileset,
        'makeStyleDirty',
      );
      styleItem.styleChanged.raiseEvent();

      expect(cesiumTilesetCesium).to.have.property('_styleLastUpdated', now);
      expect(makeStyleDirty).to.have.been.called;
    });

    it('should always remove a previous style changed handler', () => {
      const remover = sandbox.spy();
      cesiumTilesetCesium._onStyleChangeRemover = remover;
      cesiumTilesetCesium.updateStyle(styleItem);
      expect(remover).to.have.been.called;
    });

    it('should set style.colorBlendMode to the cesium 3DTileset.colorBlendMode', () => {
      cesiumTilesetCesium.cesium3DTileset = getDummyCesium3DTileset();
      cesiumTilesetCesium.cesium3DTileset.extras._3DTILESDIFFUSE = true;
      const colorBlendStyle = new DeclarativeStyleItem({
        declarativeStyle: { show: false },
        colorBlendMode: Cesium3DTileColorBlendMode.REPLACE,
      });
      cesiumTilesetCesium.updateStyle(colorBlendStyle);
      expect(cesiumTilesetCesium.cesium3DTileset.colorBlendMode).to.equal(
        Cesium3DTileColorBlendMode.REPLACE,
      );
    });

    it('should not set style.colorBlendMode to the cesium 3DTileset.colorBlendMode if the _3DTILESDIFFUSE is set', () => {
      cesiumTilesetCesium.cesium3DTileset = getDummyCesium3DTileset();
      cesiumTilesetCesium.cesium3DTileset.extras._3DTILESDIFFUSE = false;
      const colorBlendStyle = new DeclarativeStyleItem({
        declarativeStyle: { show: false },
        colorBlendMode: Cesium3DTileColorBlendMode.REPLACE,
      });
      cesiumTilesetCesium.updateStyle(colorBlendStyle);
      expect(cesiumTilesetCesium.cesium3DTileset.colorBlendMode).to.equal(
        Cesium3DTileColorBlendMode.HIGHLIGHT,
      );
    });
  });

  describe('updating the modelMatrix', () => {
    let matrix;

    before(() => {
      matrix = Matrix4.fromUniformScale(3);
    });

    beforeEach(async () => {
      await cesiumTilesetCesium.initialize();
    });

    it('should set the model matrix', () => {
      cesiumTilesetCesium.updateModelMatrix(matrix);
      expect(cesiumTilesetCesium.modelMatrix).to.equal(matrix);
    });

    it('should set the model matrix on the cesium3DTileset', () => {
      cesiumTilesetCesium.updateModelMatrix(matrix);
      expect(
        Matrix4.equals(cesiumTilesetCesium.cesium3DTileset.modelMatrix, matrix),
      ).to.be.true;
    });

    describe('with undefined', () => {
      beforeEach(() => {
        cesiumTilesetCesium.updateModelMatrix(matrix);
      });

      it('should unset the model matrix', () => {
        cesiumTilesetCesium.updateModelMatrix();
        expect(cesiumTilesetCesium.modelMatrix).to.be.undefined;
      });

      it('should set the identity model matrix on the cesium3DTileset', () => {
        cesiumTilesetCesium.updateModelMatrix();
        expect(
          Matrix4.equals(
            cesiumTilesetCesium.cesium3DTileset.modelMatrix,
            Matrix4.IDENTITY,
          ),
        ).to.be.true;
      });

      it('should set an offset, if one is defined', () => {
        cesiumTilesetCesium.offset = [0, 0, 20];
        cesiumTilesetCesium.updateModelMatrix();
        const expectedTransformation = Matrix4.fromTranslation(
          new Cartesian3(
            11.842489861883223,
            2.8160056717460975,
            15.869012127630413,
          ),
        );
        const isEqual = Matrix4.equalsEpsilon(
          cesiumTilesetCesium.cesium3DTileset.modelMatrix,
          expectedTransformation,
          CesiumMath.EPSILON6,
        );
        expect(isEqual).to.be.true;
      });
    });
  });

  describe('updating the offset', () => {
    let offset;

    before(() => {
      offset = [0, 0, 20];
    });

    beforeEach(async () => {
      await cesiumTilesetCesium.initialize();
    });

    it('should set the offset', () => {
      cesiumTilesetCesium.updateOffset(offset);
      expect(cesiumTilesetCesium.offset).to.equal(offset);
    });

    it('should set the model matrix on the cesium3DTileset', () => {
      const expectedTransformation = Matrix4.fromTranslation(
        new Cartesian3(
          11.842489861883223,
          2.8160056717460975,
          15.869012127630413,
        ),
      );
      cesiumTilesetCesium.updateOffset(offset);
      const isEqual = Matrix4.equalsEpsilon(
        cesiumTilesetCesium.cesium3DTileset.modelMatrix,
        expectedTransformation,
        CesiumMath.EPSILON6,
      );
      expect(isEqual).to.be.true;
    });

    it('should not overwrite a set modelMatrix', () => {
      const matrix = Matrix4.fromUniformScale(3);
      cesiumTilesetCesium.updateModelMatrix(matrix);
      cesiumTilesetCesium.updateOffset(offset);
      expect(
        Matrix4.equals(cesiumTilesetCesium.cesium3DTileset.modelMatrix, matrix),
      ).to.be.true;
    });

    describe('with undefined', () => {
      beforeEach(() => {
        cesiumTilesetCesium.updateOffset(offset);
      });

      it('should unset the model matrix', () => {
        cesiumTilesetCesium.updateOffset();
        expect(cesiumTilesetCesium.offset).to.be.undefined;
      });

      it('should set the identity model matrix on the cesium3DTileset', () => {
        cesiumTilesetCesium.updateOffset();
        expect(
          Matrix4.equals(
            cesiumTilesetCesium.cesium3DTileset.modelMatrix,
            Matrix4.IDENTITY,
          ),
        ).to.be.true;
      });
    });
  });

  describe('updating the custom shader', () => {
    let customShader;

    before(() => {
      customShader = new CustomShader({});
    });

    beforeEach(async () => {
      await cesiumTilesetCesium.initialize();
    });

    it('should set the customShader', () => {
      cesiumTilesetCesium.updateCustomShader(customShader);
      expect(cesiumTilesetCesium.customShader).to.equal(customShader);
    });

    it('should set the customShader on the cesium3DTileset', () => {
      cesiumTilesetCesium.updateCustomShader(customShader);
      expect(cesiumTilesetCesium.cesium3DTileset.customShader).to.equal(
        customShader,
      );
    });

    describe('with undefined', () => {
      beforeEach(() => {
        cesiumTilesetCesium.updateCustomShader(customShader);
      });

      it('should unset the customShader', () => {
        cesiumTilesetCesium.updateCustomShader();
        expect(cesiumTilesetCesium.customShader).to.be.undefined;
      });

      it('should unset the custom shader on the tileset', () => {
        cesiumTilesetCesium.updateCustomShader();
        expect(cesiumTilesetCesium.cesium3DTileset.customShader).to.be
          .undefined;
      });
    });
  });

  describe('applyStyle', () => {
    let header;
    let styleContent;

    before(() => {
      header = {
        boundingVolume: { sphere: new BoundingSphere() },
        geometricError: 24.4140625,
      };
    });

    beforeEach(async () => {
      await cesiumTilesetCesium.initialize();
      styleContent = sandbox.spy(cesiumTilesetCesium, 'styleContent');
    });

    it('should call styleContent for cesium3DTile', () => {
      const tile = new Cesium3DTile(
        cesiumTilesetCesium.cesium3DTileset,
        null,
        header,
      );
      cesiumTilesetCesium.applyStyle(tile);
      expect(styleContent).to.have.been.calledWithExactly(tile.content);
    });

    it('should call style content for each content of Composite3dTileContent', () => {
      const arrayBuffer = new ArrayBuffer(32);
      const view = new DataView(arrayBuffer);
      view.setUint32(Uint32Array.BYTES_PER_ELEMENT, 1, true);

      const content = new Composite3DTileContent(
        cesiumTilesetCesium.cesium3DTileset,
        null,
        new Resource('http://localhost/test'),
        arrayBuffer,
      );
      const innerContent = [{}, {}];
      content._contents = innerContent;
      cesiumTilesetCesium.applyStyle({ contentReady: true, content });
      expect(styleContent).to.have.been.calledTwice;
      expect(styleContent).to.have.been.calledWith(innerContent[0]);
      expect(styleContent).to.have.been.calledWith(innerContent[1]);
    });
  });

  describe('styleContent', () => {
    let clock;
    let now;
    let feature;
    let content;

    beforeEach(() => {
      now = Date.now();
      clock = sandbox.useFakeTimers(now);
      feature = createDummyCesium3DTileFeature({ id: 'test' });

      content = {
        featuresLength: 1,
        getFeature() {
          return feature;
        },
      };
    });

    it('should set the last updated, if the content does not already have TilesetLayer.lastUpdated', () => {
      cesiumTilesetCesium.styleContent(content);
      expect(content).to.have.property(cesiumTilesetLastUpdated, now);
    });

    it('should update the content, if the contents last updated is older the featureVisibility.lastUpdated', () => {
      content = { [cesiumTilesetLastUpdated]: now };
      clock.tick(1);
      cesiumTilesetCesium.featureVisibility.lastUpdated = now + 1;
      cesiumTilesetCesium.styleContent(content);
      expect(content).to.have.property(cesiumTilesetLastUpdated, now + 1);
    });

    it('should update the content, if the content last updated is older then the globalHider.lastUpdated', () => {
      content = { [cesiumTilesetLastUpdated]: now };
      clock.tick(1);
      cesiumTilesetCesium.globalHider.lastUpdated = now + 1;
      cesiumTilesetCesium.styleContent(content);
      expect(content).to.have.property(cesiumTilesetLastUpdated, now + 1);
    });

    it('should update the content, if the contents last update is older then the _styleLastUpated', () => {
      content = { [cesiumTilesetLastUpdated]: now };
      clock.tick(1);
      cesiumTilesetCesium._styleLastUpdated = now + 1;
      cesiumTilesetCesium.styleContent(content);
      expect(content).to.have.property(cesiumTilesetLastUpdated, now + 1);
    });

    describe('hide objects - FV', () => {
      beforeEach(() => {
        cesiumTilesetCesium.featureVisibility.hideObjects(['test']);
      });

      it('should set a hidden objects show to false', () => {
        cesiumTilesetCesium.styleContent(content);
        expect(feature).to.have.property('show', false);
      });

      it('should add the feature to the set', () => {
        cesiumTilesetCesium.styleContent(content);
        cesiumTilesetCesium.featureVisibility.hasHiddenFeature('test', feature);
      });

      it('should re-hide the feature when calling the update feature override', () => {
        cesiumTilesetCesium.styleContent(content);
        feature.show = true;
        cesiumTilesetCesium.styleContent(content);
        expect(feature).to.have.property('show', false);
      });
    });

    describe('hide objects - GH', () => {
      beforeEach(() => {
        cesiumTilesetCesium.globalHider.hideObjects(['test']);
      });

      afterEach(() => {
        cesiumTilesetCesium.globalHider.showObjects(['test']);
      });

      it('should set a hidden objects show to false', () => {
        cesiumTilesetCesium.styleContent(content);
        expect(feature).to.have.property('show', false);
      });

      it('should add the feature to the set', () => {
        cesiumTilesetCesium.styleContent(content);
        expect(cesiumTileset.globalHider.hasFeature('test', feature)).to.be
          .true;
      });

      it('should re-hide the feature when calling the update feature override', () => {
        cesiumTilesetCesium.styleContent(content);
        feature.show = true;
        cesiumTilesetCesium.styleContent(content);
        expect(feature).to.have.property('show', false);
      });
    });

    describe('highlight objects', () => {
      it('sets the features color to the highlighted styles color', () => {
        cesiumTilesetCesium.featureVisibility.highlight({
          test: highlightStyle,
        });
        cesiumTilesetCesium.styleContent(content);
        expect(feature.color).to.equal(highlightStyle.cesiumFillColor);
      });

      it('should add the feature to the set', () => {
        cesiumTilesetCesium.featureVisibility.highlight({
          test: highlightStyle,
        });
        cesiumTilesetCesium.styleContent(content);
        cesiumTilesetCesium.featureVisibility.hasHighlightFeature(
          'test',
          feature,
        );
      });

      it('should re-hide the feature when calling the update feature override', () => {
        cesiumTilesetCesium.featureVisibility.highlight({
          test: highlightStyle,
        });
        cesiumTilesetCesium.styleContent(content);
        feature.color = Color.GREEN;
        cesiumTilesetCesium.styleContent(content);
        expect(feature.color).to.equal(highlightStyle.cesiumFillColor);
      });
    });

    it('should use a combination of url and batchId, if no id is present', () => {
      cesiumTilesetCesium.featureVisibility.hiddenObjects.test0 = new Set();
      feature.getProperty = () => false;
      content.url = 'test';
      cesiumTilesetCesium.styleContent(content);
      expect(
        cesiumTilesetCesium.featureVisibility.hiddenObjects.test0,
      ).to.have.property('size', 1);
    });
  });
});
