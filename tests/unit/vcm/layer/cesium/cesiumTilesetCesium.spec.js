import Cesium3DTileset from '@vcmap/cesium/Source/Scene/Cesium3DTileset.js';
import Cesium3DTileColorBlendMode from '@vcmap/cesium/Source/Scene/Cesium3DTileColorBlendMode.js';
import ImagerySplitDirection from '@vcmap/cesium/Source/Scene/ImagerySplitDirection.js';
import Composite3DTileContent from '@vcmap/cesium/Source/Scene/Composite3DTileContent.js';
import Cesium3DTile from '@vcmap/cesium/Source/Scene/Cesium3DTile.js';
import BoundingSphere from '@vcmap/cesium/Source/Core/BoundingSphere.js';
import Matrix4 from '@vcmap/cesium/Source/Core/Matrix4.js';
import Cartesian3 from '@vcmap/cesium/Source/Core/Cartesian3.js';
import CesiumMath from '@vcmap/cesium/Source/Core/Math.js';
import CesiumTileset from '../../../../../src/vcs/vcm/layer/cesiumTileset.js';
import DeclarativeStyleItem from '../../../../../src/vcs/vcm/util/style/declarativeStyleItem.js';
import { getFramework } from '../../../helpers/framework.js';
import getDummyCesium3DTileset from './getDummyCesium3DTileset.js';
import { createTilesetServer, setCesiumMap, createDummyCesium3DTileFeature } from '../../../helpers/cesiumHelpers.js';
import VectorStyleItem from '../../../../../src/vcs/vcm/util/style/vectorStyleItem.js';
import resetFramework from '../../../helpers/resetFramework.js';
import { cesiumTilesetLastUpdated } from '../../../../../src/vcs/vcm/layer/cesium/cesiumTilesetCesium.js';
import { vcsLayerName } from '../../../../../src/vcs/vcm/layer/layerSymbols.js';

describe('vcs.vcm.layer.cesium.CesiumTilesetCesium', () => {
  let sandbox;
  /** @type {vcs.vcm.layer.CesiumTileset} */
  let cesiumTileset;
  /** @type {vcs.vcm.maps.CesiumMap} */
  let cesiumMap;
  /** @type {vcs.vcm.layer.cesium.CesiumTilesetCesium} */
  let cesiumTilesetCesium;
  let highlightStyle;

  before(async () => {
    sandbox = sinon.createSandbox();
    cesiumMap = await setCesiumMap(getFramework());
    highlightStyle = new VectorStyleItem({ fill: { color: [0, 255, 0, 1] } });
  });

  beforeEach(() => {
    createTilesetServer(sandbox);
    cesiumTileset = new CesiumTileset({ url: 'http://test.com/tileset.json' });
    [cesiumTilesetCesium] = cesiumTileset.getImplementationsForMap(cesiumMap);
  });

  afterEach(() => {
    cesiumTileset.destroy();
    sandbox.restore();
  });

  after(() => {
    resetFramework();
  });

  describe('updating split direction', () => {
    it('should add this layer to the current split direction clippingObject', async () => {
      await cesiumTilesetCesium.activate();
      cesiumTilesetCesium.updateSplitDirection(ImagerySplitDirection.LEFT);
      const clippingObject = cesiumMap.splitScreen.getClippingObjectForDirection(cesiumTilesetCesium.splitDirection);
      expect(clippingObject.layerNames).to.include(cesiumTilesetCesium.name);
    });

    it('should remove itself from the previous split directions clippingObject', async () => {
      await cesiumTilesetCesium.activate();
      cesiumTilesetCesium.updateSplitDirection(ImagerySplitDirection.LEFT);
      const clippingObject = cesiumMap.splitScreen.getClippingObjectForDirection(cesiumTilesetCesium.splitDirection);
      clippingObject.addLayer(cesiumTilesetCesium.name);
      cesiumTilesetCesium.updateSplitDirection(ImagerySplitDirection.NONE);
      expect(clippingObject.layerNames).to.be.empty;
    });
  });

  describe('initialize', () => {
    it('creates a new cesium 3DTileset, adding vcsLayerName', async () => {
      await cesiumTilesetCesium.initialize();
      expect(cesiumTilesetCesium).to.have.property('cesium3DTileset').and.to.be.an.instanceof(Cesium3DTileset);
      expect(cesiumTilesetCesium.cesium3DTileset).to.have.property(vcsLayerName, cesiumTilesetCesium.name);
    });

    it('adds an unload event listener, which removed the lastUpdated symbol', async () => {
      const test = { [cesiumTilesetLastUpdated]: true };
      await cesiumTilesetCesium.initialize();
      cesiumTilesetCesium.cesium3DTileset.tileUnload.raiseEvent(test);
      expect(test).to.not.have.property(cesiumTilesetLastUpdated);
    });

    it('should set the style and the color blend mode', async () => {
      cesiumTilesetCesium.style = new DeclarativeStyleItem({
        declarativeStyle: { show: false },
        colorBlendMode: Cesium3DTileColorBlendMode.REPLACE,
      });
      await cesiumTilesetCesium.initialize();
      expect(cesiumTilesetCesium.cesium3DTileset.style).to.equal(cesiumTilesetCesium.style.cesiumStyle);
      expect(cesiumTilesetCesium.cesium3DTileset.colorBlendMode).to.equal(Cesium3DTileColorBlendMode.REPLACE);
    });

    it('should add an changed handler to the style', async () => {
      await cesiumTilesetCesium.initialize();
      const makeStyleDirty = sandbox.spy(cesiumTilesetCesium.cesium3DTileset, 'makeStyleDirty');
      cesiumTileset.style.styleChanged.raiseEvent();
      expect(makeStyleDirty).to.have.been.called;
    });

    it('should update the split direction on initialize', async () => {
      cesiumTilesetCesium.splitDirection = ImagerySplitDirection.LEFT;
      await cesiumTilesetCesium.initialize();
      const clippingObject = cesiumMap.splitScreen.getClippingObjectForDirection(cesiumTilesetCesium.splitDirection);
      expect(clippingObject.layerNames).to.include(cesiumTilesetCesium.name);
    });

    describe('setting of model matrix', () => {
      let matrix;

      before(() => {
        matrix = Matrix4.fromUniformScale(3);
      });

      it('should set a model matrix', async () => {
        cesiumTilesetCesium.modelMatrix = matrix;
        await cesiumTilesetCesium.initialize();
        expect(Matrix4.equals(cesiumTilesetCesium.cesium3DTileset.modelMatrix, matrix)).to.be.true;
      });

      it('should calculate an offset', async () => {
        cesiumTilesetCesium.offset = [0, 0, 20];
        await cesiumTilesetCesium.initialize();
        const expectedTransformation = Matrix4
          .fromTranslation(new Cartesian3(11.842489861883223, 2.8160056717460975, 15.869012127630413));
        const isEqual = Matrix4
          .equalsEpsilon(cesiumTilesetCesium.cesium3DTileset.modelMatrix, expectedTransformation, CesiumMath.EPSILON6);
        expect(isEqual).to.be.true;
      });

      it('should set the model matrix over the offset', async () => {
        cesiumTilesetCesium.offset = [0, 0, 20];
        cesiumTilesetCesium.modelMatrix = matrix;
        await cesiumTilesetCesium.initialize();
        expect(Matrix4.equals(cesiumTilesetCesium.cesium3DTileset.modelMatrix, matrix)).to.be.true;
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
      styleItem = new DeclarativeStyleItem({ declarativeStyle: { show: false } });
    });

    beforeEach(async () => {
      await cesiumTilesetCesium.initialize();
    });

    it('should set style on the cesium tileset', () => {
      cesiumTilesetCesium.updateStyle(styleItem);
      expect(cesiumTilesetCesium).to.have.property('cesium3DTileset')
        .and.to.have.property('style')
        .and.to.have.property('style')
        .and.to.have.property('show', 'false');
    });

    it('should attach an event listener to style changed, setting the style dirty and update timers', () => {
      const now = Date.now();
      sandbox.useFakeTimers(now);
      cesiumTilesetCesium.updateStyle(styleItem);
      const makeStyleDirty = sandbox.spy(cesiumTilesetCesium.cesium3DTileset, 'makeStyleDirty');
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
      sandbox.stub(Cesium3DTileset.prototype, 'readyPromise').returns(Promise.resolve());
      cesiumTilesetCesium.cesium3DTileset = getDummyCesium3DTileset();
      cesiumTilesetCesium.cesium3DTileset.extras._3DTILESDIFFUSE = true;
      const colorBlendStyle = new DeclarativeStyleItem({
        declarativeStyle: { show: false },
        colorBlendMode: Cesium3DTileColorBlendMode.REPLACE,
      });
      cesiumTilesetCesium.updateStyle(colorBlendStyle);
      return cesiumTilesetCesium.cesium3DTileset.readyPromise.then(() => {
        expect(cesiumTilesetCesium.cesium3DTileset.colorBlendMode).to.equal(Cesium3DTileColorBlendMode.REPLACE);
      });
    });

    it('should not set style.colorBlendMode to the cesium 3DTileset.colorBlendMode if the _3DTILESDIFFUSE is set', () => {
      sandbox.stub(Cesium3DTileset.prototype, 'readyPromise').returns(Promise.resolve());
      cesiumTilesetCesium.cesium3DTileset = getDummyCesium3DTileset();
      cesiumTilesetCesium.cesium3DTileset.extras._3DTILESDIFFUSE = false;
      const colorBlendStyle = new DeclarativeStyleItem({
        declarativeStyle: { show: false },
        colorBlendMode: Cesium3DTileColorBlendMode.REPLACE,
      });
      cesiumTilesetCesium.updateStyle(colorBlendStyle);
      return cesiumTilesetCesium.cesium3DTileset.readyPromise.then(() => {
        expect(cesiumTilesetCesium.cesium3DTileset.colorBlendMode).to.equal(Cesium3DTileColorBlendMode.HIGHLIGHT);
      });
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
      expect(Matrix4.equals(cesiumTilesetCesium.cesium3DTileset.modelMatrix, matrix)).to.be.true;
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
        expect(Matrix4.equals(cesiumTilesetCesium.cesium3DTileset.modelMatrix, Matrix4.IDENTITY)).to.be.true;
      });

      it('should set an offset, if one is defined', () => {
        cesiumTilesetCesium.offset = [0, 0, 20];
        cesiumTilesetCesium.updateModelMatrix();
        const expectedTransformation = Matrix4
          .fromTranslation(new Cartesian3(11.842489861883223, 2.8160056717460975, 15.869012127630413));
        const isEqual = Matrix4
          .equalsEpsilon(cesiumTilesetCesium.cesium3DTileset.modelMatrix, expectedTransformation, CesiumMath.EPSILON6);
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
      const expectedTransformation = Matrix4
        .fromTranslation(new Cartesian3(11.842489861883223, 2.8160056717460975, 15.869012127630413));
      cesiumTilesetCesium.updateOffset(offset);
      const isEqual = Matrix4
        .equalsEpsilon(cesiumTilesetCesium.cesium3DTileset.modelMatrix, expectedTransformation, CesiumMath.EPSILON6);
      expect(isEqual).to.be.true;
    });

    it('should not overwrite a set modelMatrix', () => {
      const matrix = Matrix4.fromUniformScale(3);
      cesiumTilesetCesium.updateModelMatrix(matrix);
      cesiumTilesetCesium.updateOffset(offset);
      expect(Matrix4.equals(cesiumTilesetCesium.cesium3DTileset.modelMatrix, matrix)).to.be.true;
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
        expect(Matrix4.equals(cesiumTilesetCesium.cesium3DTileset.modelMatrix, Matrix4.IDENTITY)).to.be.true;
      });
    });
  });

  describe('applyStyle', () => {
    let header;
    let styleContent;
    before(() => {
      header = { boundingVolume: { sphere: new BoundingSphere() }, geometricError: 24.4140625 };
    });

    beforeEach(async () => {
      await cesiumTilesetCesium.initialize();
      styleContent = sandbox.spy(cesiumTilesetCesium, 'styleContent');
    });

    it('should call styleContent for cesium3DTile', () => {
      const tile = new Cesium3DTile(cesiumTilesetCesium.cesium3DTileset, null, header);
      cesiumTilesetCesium.applyStyle(tile);
      expect(styleContent).to.have.been.calledWithExactly(tile.content);
    });

    it('should call style content for each content of Composite3dTileContent', () => {
      const arrayBuffer = new ArrayBuffer(32);
      const view = new DataView(arrayBuffer);
      view.setUint32(Uint32Array.BYTES_PER_ELEMENT, 1, true);

      const content = new Composite3DTileContent(cesiumTilesetCesium.cesium3DTileset, null, null, arrayBuffer);
      const innerContent = [{}, {}];
      content._contents = innerContent;
      cesiumTilesetCesium.applyStyle({ content });
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
        getFeature() { return feature; },
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
        expect(cesiumTileset.globalHider.hasFeature('test', feature)).to.be.true;
      });
    });

    describe('highlight objects', () => {
      it('sets the features color to the highlighted styles color', () => {
        cesiumTilesetCesium.featureVisibility.highlight({ test: highlightStyle });
        cesiumTilesetCesium.styleContent(content);
        expect(feature.color).to.equal(highlightStyle.cesiumFillColor);
      });

      it('should add the feature to the set', () => {
        cesiumTilesetCesium.featureVisibility.highlight({ test: highlightStyle });
        cesiumTilesetCesium.styleContent(content);
        cesiumTilesetCesium.featureVisibility.hasHighlightFeature('test', feature);
      });
    });

    it('should use a combination of url and batchId, if no id is present', () => {
      cesiumTilesetCesium.featureVisibility.hiddenObjects.test0 = new Set();
      feature.getProperty = () => false;
      content.url = 'test';
      cesiumTilesetCesium.styleContent(content);
      expect(cesiumTilesetCesium.featureVisibility.hiddenObjects.test0).to.have.property('size', 1);
    });
  });
});
