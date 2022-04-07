import nock from 'nock';
import Feature from 'ol/Feature.js';
import StaticGeoJSONTileProvider from '../../../../src/layer/tileProvider/staticGeojsonTileProvider.js';
import importJSON from '../../helpers/importJSON.js';

const testGeoJSON = await importJSON('./tests/data/testGeoJSON.json');

describe('StaticGeoJSONTileProvider', () => {
  /** @type {import("@vcmap/core").StaticGeoJSONTileProvider} */
  let tileProvider;

  before(() => {
    tileProvider = new StaticGeoJSONTileProvider({
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

  describe('serialization', () => {
    describe('of a default tile provider', () => {
      it('should only return type and name', () => {
        const outputConfig = new StaticGeoJSONTileProvider({}).toJSON();
        expect(outputConfig).to.have.all.keys(['type', 'name']);
      });
    });

    describe('of a configured tile provider', () => {
      let inputConfig;
      let outputConfig;

      before(() => {
        inputConfig = {
          url: 'myUrl',
          baseLevels: [15],
        };
        outputConfig = new StaticGeoJSONTileProvider(inputConfig).toJSON();
      });

      it('should configure url', () => {
        expect(outputConfig).to.have.property('url', inputConfig.url);
      });

      it('should never configure baseLevels', () => {
        expect(outputConfig).to.not.have.property('baseLevels');
      });
    });
  });
});
