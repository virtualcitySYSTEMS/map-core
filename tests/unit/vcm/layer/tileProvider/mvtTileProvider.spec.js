import nock from 'nock';
import fs from 'fs';
import Feature from 'ol/Feature.js';
import MVTTileProvider from '../../../../../src/vcs/vcm/layer/tileProvider/mvtTileProvider.js';

describe('vcs.vcm.layer.tileProvider.MVTTileProvider', () => {
  /** @type {import("@vcmap/core").MVTTileProvider} */
  let tileProvider;

  before(() => {
    tileProvider = new MVTTileProvider({
      url: 'http://localhost/layer/getFeatures?x={x}&y={y}&level={z}',
      tileCacheSize: 10,
      baseLevels: [0],
      idProperty: 'idProp',
    });
  });

  after(() => {
    tileProvider.destroy();
    nock.cleanAll();
  });

  describe('loader', () => {
    let scope;
    let loaded;

    before(async () => {
      scope = nock('http://localhost')
        .get('/layer/getFeatures')
        .query({ x: 17, y: 10, level: 5 })
        .reply(200, fs.createReadStream('./tests/data/tile.pbf'));
      loaded = await tileProvider.loader(17, 10, 5);
    });

    after(async () => {
      await tileProvider.clearCache();
      scope.done();
    });

    it('should load response data', () => {
      expect(loaded).to.have.length(9);
    });

    it('should create features', () => {
      expect(loaded[0]).to.be.instanceOf(Feature);
    });

    it('should apply id Property as featureId', () => {
      expect(loaded[0].getId()).to.equal('9da902d4-2d74-4798-b6b4-795a50e7f6cf');
    });

    it('should transform local coordinates from southWest Corner to mercator', () => {
      expect(loaded[0].getGeometry().getFirstCoordinate())
        .to.have.members([1488993.3109952325, 6894008.455096615]);
    });
  });
});
