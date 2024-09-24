import VcsApp from '../../../../src/vcsApp.js';
import { setOpenlayersMap } from '../../helpers/openlayersHelpers.js';
import VectorTileLayer from '../../../../src/layer/vectorTileLayer.js';
import VectorTileOpenlayersImpl from '../../../../src/layer/openlayers/vectorTileOpenlayersImpl.js';

describe('VectorTileOpenlayersImpl', () => {
  let sandbox;
  let app;
  let openlayers;
  let vectorTile;
  /** @type {import("@vcmap/core").VectorTileOpenlayersImpl} */
  let vectorTileOpenlayers;

  let olLayerChangedSpy;

  before(async () => {
    sandbox = sinon.createSandbox();
    app = new VcsApp();
    openlayers = await setOpenlayersMap(app);
    vectorTile = new VectorTileLayer({
      tileProvider: {
        type: 'URLTemplateTileProvider',
        url: 'myURL',
        baseLevels: [0],
      },
    });
    await vectorTile.initialize();
  });

  beforeEach(async () => {
    vectorTileOpenlayers = new VectorTileOpenlayersImpl(
      openlayers,
      vectorTile.getImplementationOptions(),
    );
    await vectorTileOpenlayers.initialize();
    olLayerChangedSpy = sandbox.spy(vectorTileOpenlayers.olLayer, 'changed');
  });

  afterEach(() => {
    vectorTileOpenlayers.destroy();
    sandbox.restore();
  });

  after(() => {
    app.destroy();
  });

  describe('updateTiles', () => {
    it('should do nothing if no tileID is given', async () => {
      vectorTileOpenlayers.updateTiles([]);
      expect(olLayerChangedSpy).to.not.have.been.called;
    });

    it('should do call source changed if tiles have been updated', async () => {
      vectorTileOpenlayers.updateTiles(['1']);
      expect(olLayerChangedSpy).to.have.been.called;
    });

    it('should collect requests from the same  thread and only call sourceChanged once', async () => {
      vectorTileOpenlayers.updateTiles(['1']);
      vectorTileOpenlayers.updateTiles(['2']);
      expect(olLayerChangedSpy).to.have.been.calledTwice;
    });

    it('should invalidate tiles on the source tileCache', async () => {
      const tile1 = { release() {} };
      const tile2 = { release() {} };
      const tile3 = { release() {} };
      vectorTileOpenlayers.olLayer.getRenderer().getTileCache().set('1', tile1);
      vectorTileOpenlayers.olLayer.getRenderer().getTileCache().set('2', tile2);
      vectorTileOpenlayers.olLayer.getRenderer().getTileCache().set('3', tile3);

      vectorTileOpenlayers.updateTiles(['1', '2']);
      vectorTileOpenlayers.updateTiles(['3']);
      expect(olLayerChangedSpy).to.have.been.calledTwice;
    });
  });

  describe('updateStyle', () => {
    it('should call olLayer changed', () => {
      vectorTileOpenlayers.updateStyle();
      expect(olLayerChangedSpy).to.have.been.calledOnce;
    });
  });
});
