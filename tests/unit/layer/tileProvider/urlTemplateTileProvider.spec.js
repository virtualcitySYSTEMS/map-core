import nock from 'nock';
import Feature from 'ol/Feature.js';
import URLTemplateTileProvider, { getURL } from '../../../../src/layer/tileProvider/urlTemplateTileProvider.js';
import { setCurrentLocale } from '../../../../src/util/locale.js';
import Projection from '../../../../src/util/projection.js';

describe('URLTemplateTileProvider', () => {
  let response;
  /** @type {import("@vcmap/core").URLTemplateTileProvider} */
  let tileProvider;
  const xyz = [1, 2, 3];

  before(async () => {
    response = {
      type: 'FeatureCollection',
      crs: {
        type: 'WGS84',
        properties: {
          name: 'EPSG:4326',
        },
      },
      features: [
        {
          type: 'Feature',
          id: 'test',
          geometry: {
            type: 'Point',
            coordinates: Projection.mercatorToWgs84([0.5, 0.5, 0]),
          },
        },
      ],
    };
    tileProvider = new URLTemplateTileProvider({
      url: 'http://myFeatureSource/layer/getFeatures?x={x}&y={y}&level={z}',
      tileCacheSize: 10,
      baseLevels: [10],
    });
  });

  after(() => {
    tileProvider.destroy();
    nock.cleanAll();
  });

  describe('loader', () => {
    let scope;
    let loaded;

    before(() => {
      scope = nock('http://myFeatureSource')
        .get('/layer/getFeatures')
        .query({ x: 1, y: 2, level: 3 })
        .reply(200, response);
    });

    after(() => {
      scope.done();
    });

    it('should load response data', async () => {
      loaded = await tileProvider.loader(...xyz);
      expect(loaded).to.have.length(1);
      expect(loaded[0]).to.be.instanceOf(Feature);
    });
  });

  describe('getUrl', () => {
    let url;

    it('should request data with url', async () => {
      url = getURL('myUrl', ...xyz, tileProvider.tilingScheme.tileXYToRectangle(...xyz));
      expect(url).to.contain('myUrl');
    });

    it('should replace tile coordinates placeholder in requested url', async () => {
      url = getURL('{x},{y},{z}', ...xyz, tileProvider.tilingScheme.tileXYToRectangle(...xyz));
      expect(url).to.contain('1,2,3');
    });

    it('should replace locale placeholder in requested url', async () => {
      setCurrentLocale('nl');
      url = getURL('{locale}', ...xyz, tileProvider.tilingScheme.tileXYToRectangle(...xyz));
      expect(url).to.contain('nl');
    });

    it('should replace extent placeholder in requested url', async () => {
      url = getURL('{minx},{miny},{maxx},{maxy}', ...xyz, tileProvider.tilingScheme.tileXYToRectangle(...xyz));
      expect(url).to.contain('-135,40.979898069620134,-90,66.51326044311185');
    });
  });

  describe('serialization', () => {
    describe('of a default tile provider', () => {
      it('should only return type and name', () => {
        const outputConfig = new URLTemplateTileProvider({}).toJSON();
        expect(outputConfig).to.have.all.keys(['type', 'name']);
      });
    });

    describe('of a configured tile provider', () => {
      let inputConfig;
      let outputConfig;

      before(() => {
        inputConfig = {
          url: 'myUrl',
        };
        outputConfig = new URLTemplateTileProvider(inputConfig).toJSON();
      });

      it('should configure url', () => {
        expect(outputConfig).to.have.property('url', inputConfig.url);
      });
    });
  });
});
