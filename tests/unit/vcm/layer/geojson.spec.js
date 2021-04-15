import Feature from 'ol/Feature.js';
import GeoJSON, { featureFromOptions } from '../../../../src/vcs/vcm/layer/geojson.js';
import testGeoJSON from './testGeoJSON.json';
import resetFramework from '../../helpers/resetFramework.js';
import { setOpenlayersMap } from '../../helpers/openlayers.js';
import { getFramework } from '../../helpers/framework.js';

describe('vcs.vcm.layer.GeoJSON', () => {
  let sandbox;

  before(async () => {
    await setOpenlayersMap(getFramework());
    sandbox = sinon.createSandbox();
  });

  after(() => {
    resetFramework();
  });

  describe('fetching data for a layer', () => {
    let geojsonLayer;

    before(async () => {
      const server = sandbox.useFakeServer();
      server.autoRespond = true;
      server.respondImmediately = true;
      server.respondWith(/test.json/, (res) => {
        res.respond(200, { 'Content-Type': 'application/json' }, JSON.stringify(testGeoJSON.featureCollection));
      });

      geojsonLayer = new GeoJSON({
        url: 'http://localhost/test.json',
        features: [JSON.parse(JSON.stringify(testGeoJSON.featureWithStyle))],
      });

      await geojsonLayer.fetchData();
    });

    after(() => {
      sandbox.restore();
      geojsonLayer.destroy();
    });

    it('should load data from the url', () => {
      const features = geojsonLayer.getFeatures();
      const foo = features.find(f => f.get('name') === 'foo');
      const bar = features.find(f => f.get('name') === 'bar');
      expect(foo).to.be.an.instanceof(Feature);
      expect(bar).to.be.an.instanceof(Feature);
    });

    it('should load features passed in as features config', () => {
      const [configFeature] = geojsonLayer.getFeaturesById(['test']);
      expect(configFeature).to.be.an.instanceof(Feature);
    });

    it('should add the featureFromOptions symbol to config features', () => {
      const [configFeature] = geojsonLayer.getFeaturesById(['test']);
      expect(configFeature).to.have.property(featureFromOptions);
    });
  });

  describe('reloading data', () => {
    let geojsonLayer;
    let originalFoo;
    let originalConfig;

    before(async () => {
      const server = sandbox.useFakeServer();
      server.autoRespond = true;
      server.respondImmediately = true;
      server.respondWith(/test.json/, (res) => {
        res.respond(200, { 'Content-Type': 'application/json' }, JSON.stringify(testGeoJSON.featureCollection));
      });

      geojsonLayer = new GeoJSON({
        url: 'http://localhost/test.json',
        features: [JSON.parse(JSON.stringify(testGeoJSON.featureWithStyle))],
      });

      await geojsonLayer.fetchData();
      originalFoo = geojsonLayer.getFeatures().find(f => f.get('name') === 'foo');
      [originalConfig] = geojsonLayer.getFeaturesById(['test']);
      await geojsonLayer.reload();
    });

    after(() => {
      sandbox.restore();
      geojsonLayer.destroy();
    });

    it('should reload data from the url', () => {
      const features = geojsonLayer.getFeatures();
      const foo = features.find(f => f.get('name') === 'foo');
      expect(foo).to.be.an.instanceof(Feature);
      expect(foo).to.not.equal(originalFoo);
    });

    it('should maintain features passed in as features config', () => {
      const [configFeature] = geojsonLayer.getFeaturesById(['test']);
      expect(configFeature).to.be.an.instanceof(Feature);
      expect(configFeature).to.equal(originalConfig);
    });
  });

  describe('getting a config', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const config = new GeoJSON({}).getConfigObject();
        expect(config).to.have.all.keys('name', 'type');
      });
    });

    describe('of a configured layer', () => {
      let inputConfig;
      let outputConfig;
      let configuredLayer;

      before(() => {
        inputConfig = {
          url: 'http://localhost/test.json',
          features: [JSON.parse(JSON.stringify(testGeoJSON.featureWithStyle))],
        };
        configuredLayer = new GeoJSON(inputConfig);
        outputConfig = configuredLayer.getConfigObject();
      });

      after(() => {
        configuredLayer.dispose();
      });

      it('should configure url', () => {
        expect(outputConfig).to.have.property('url', inputConfig.url);
      });

      it('should configure feature', () => {
        expect(outputConfig).to.have.property('features')
          .and.to.have.members(inputConfig.features);
      });
    });

    describe('after initializing features from the config', () => {
      it('should recreate the configured feature', async () => {
        const feature = JSON.parse(JSON.stringify(testGeoJSON.featureWithStyle));
        const layer = new GeoJSON({
          features: [feature],
        });
        await layer.initialize();
        const config = layer.getConfigObject();
        expect(config).to.have.property('features')
          .and.to.have.lengthOf(1);

        expect(config.features[0]).to.have.property('id', 'test');
      });
    });
  });
});
