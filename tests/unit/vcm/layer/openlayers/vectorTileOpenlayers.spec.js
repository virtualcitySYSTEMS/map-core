import VcsApp from '../../../../../src/vcs/vcm/vcsApp.js';
import { setOpenlayersMap } from '../../../helpers/openlayersHelpers.js';
import VectorTile from '../../../../../src/vcs/vcm/layer/vectorTile.js';
import VectorTileOpenlayers from '../../../../../src/vcs/vcm/layer/openlayers/vectorTileOpenlayers.js';
import { timeout } from '../../../helpers/helpers.js';

describe('vcs.vcm.layer.openlayers.VectorTileOpenlayers', () => {
  let sandbox;
  let app;
  let openlayers;
  let vectorTile;
  /** @type {import("@vcmap/core").VectorTileOpenlayers} */
  let vectorTileOpenlayers;

  let sourceChangedSpy;
  let sourceRefreshSpy;

  before(async () => {
    sandbox = sinon.createSandbox();
    app = new VcsApp();
    openlayers = await setOpenlayersMap(app);
    vectorTile = new VectorTile({
      tileProvider: {
        type: 'vcs.vcm.layer.tileProvider.URLTemplateTileProvider',
        url: 'myURL',
        baseLevels: [0],
      },
    });
    await vectorTile.initialize();
  });

  beforeEach(async () => {
    vectorTileOpenlayers = new VectorTileOpenlayers(openlayers, vectorTile.getImplementationOptions());
    await vectorTileOpenlayers.initialize();
    sourceChangedSpy = sandbox.spy(vectorTileOpenlayers.source, 'changed');
    sourceRefreshSpy = sandbox.spy(vectorTileOpenlayers.source, 'refresh');
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
      await timeout(0);
      expect(sourceChangedSpy).to.not.have.been.called;
    });

    it('should do call source changed if tiles have been updated', async () => {
      vectorTileOpenlayers.updateTiles(['1']);
      await timeout(0);
      expect(sourceChangedSpy).to.have.been.called;
    });

    it('should collect requests from the same  thread and only call sourceChanged once', async () => {
      vectorTileOpenlayers.updateTiles(['1']);
      vectorTileOpenlayers.updateTiles(['2']);
      await timeout(0);
      expect(sourceChangedSpy).to.have.been.calledOnce;
    });

    it('should invalidate tiles on the source tileCache', async () => {
      const tile1 = {};
      const tile2 = {};
      const tile3 = {};
      vectorTileOpenlayers.source.tileCache.set('1', tile1);
      vectorTileOpenlayers.source.tileCache.set('2', tile2);
      vectorTileOpenlayers.source.tileCache.set('3', tile3);

      vectorTileOpenlayers.updateTiles(['1', '2']);
      vectorTileOpenlayers.updateTiles(['3']);
      await timeout(0);
      expect(tile1.key).to.be.false;
      expect(tile2.key).to.be.false;
      expect(tile3.key).to.be.false;
    });
  });

  describe('updateStyle', () => {
    it('should refresh the source', () => {
      vectorTileOpenlayers.updateStyle();
      expect(sourceRefreshSpy).to.have.been.calledOnce;
    });

    it('should cancel updateTiles calls', async () => {
      vectorTileOpenlayers.updateTiles(['1']);
      vectorTileOpenlayers.updateStyle();
      expect(sourceRefreshSpy).to.have.been.calledOnce;
      await timeout(0);
      expect(sourceChangedSpy).to.have.been.calledOnce; // refresh also calls changed
    });
  });
});
