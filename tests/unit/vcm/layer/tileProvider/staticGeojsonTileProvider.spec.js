import nock from 'nock';
import Feature from 'ol/Feature.js';
import StaticGeojsonTileProvider from '../../../../../src/vcs/vcm/layer/tileProvider/staticGeojsonTileProvider.js';
import importJSON from '../../../helpers/importJSON.js';

const testGeoJSON = await importJSON('./tests/data/testGeoJSON.json');

describe('vcs.vcm.layer.tileProvider.StaticGeojsonTileProvider', () => {
  /** @type {import("@vcmap/core").StaticGeojsonTileProvider} */
  let tileProvider;

  before(() => {
    tileProvider = new StaticGeojsonTileProvider({
      url: 'http://myStaticGeojsonTileProvider/tile.json',
      tileCacheSize: 10,
      baseLevels: [10],
    });
  });

  after(() => {
    tileProvider.destroy();
    nock.cleanAll();
  });

  describe('constructor', () => {
    it('should set baseLevels to 0', () => {
      expect(tileProvider.baseLevels).to.have.members([0]);
    });
  });

  describe('loader', () => {
    let scope;
    let loaded;

    before(() => {
      scope = nock('http://myStaticGeojsonTileProvider')
        .get('/tile.json')
        .reply(200, testGeoJSON.featureCollection);
    });

    after(() => {
      scope.done();
    });

    it('should return parsed features', async () => {
      loaded = await tileProvider.loader(1, 2, 3);
      expect(loaded).to.have.lengthOf(2);
      expect(loaded[0]).to.be.instanceOf(Feature);
    });
  });
});
