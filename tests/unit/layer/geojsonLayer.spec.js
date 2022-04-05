import nock from 'nock';
import Feature from 'ol/Feature.js';
import { ClassificationType } from '@vcmap/cesium';
import GeoJSONLayer, { featureFromOptions } from '../../../src/layer/geojsonLayer.js';
import { setOpenlayersMap } from '../helpers/openlayersHelpers.js';
import VcsApp from '../../../src/vcsApp.js';
import importJSON from '../helpers/importJSON.js';

const testGeoJSON = await importJSON('./tests/data/testGeoJSON.json');

describe('GeoJSONLayer', () => {
  let scope;
  let app;

  before(async () => {
    app = new VcsApp();
    await setOpenlayersMap(app);
  });

  after(() => {
    app.destroy();
    nock.cleanAll();
  });

  describe('fetching data for a layer', () => {
    let geojsonLayer;

    before(async () => {
      scope = nock('http://myGeoJsonProvider')
        .get('/test.json')
        .reply(200, JSON.stringify(testGeoJSON.featureCollection));

      geojsonLayer = new GeoJSONLayer({
        url: 'http://myGeoJsonProvider/test.json',
        features: [JSON.parse(JSON.stringify(testGeoJSON.featureWithStyle))],
      });

      await geojsonLayer.fetchData();
    });

    after(() => {
      scope.done();
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

  describe('vectorProperties handling', () => {
    let geojsonLayer;

    before(async () => {
      scope = nock('http://myGeoJsonProvider')
        .get('/test.json')
        .reply(200, JSON.stringify({
          type: 'FeatureCollection',
          vcsMeta: {
            classificationType: 'terrain',
            storeysAboveGround: 1,
            storeyHeightsAboveGround: [1],
            storeysBelowGround: 1,
            storeyHeightsBelowGround: [1],
          },
          features: [],
        }));

      geojsonLayer = new GeoJSONLayer({
        url: 'http://myGeoJsonProvider/test.json',
        vectorProperties: {
          classificationType: 'both',
          storeysBelowGround: 2,
          storeyHeightsBelowGround: [2],
        },
      });
      await geojsonLayer.fetchData();
    });

    after(() => {
      scope.done();
      geojsonLayer.destroy();
    });

    it('data vectorProperties should be evaluated', () => {
      expect(geojsonLayer.vectorProperties.storeysAboveGround).to.be.equal(1);
      expect(geojsonLayer.vectorProperties.storeyHeightsAboveGround).to.have.members([1]);
    });

    it('layer vectorProperties should have priority over data vectorProperties', () => {
      expect(geojsonLayer.vectorProperties.storeysBelowGround).to.be.equal(2);
      expect(geojsonLayer.vectorProperties.storeyHeightsBelowGround).to.have.members([2]);
      expect(geojsonLayer.vectorProperties.classificationType).to.be.equal(ClassificationType.BOTH);
    });
  });

  describe('reloading data', () => {
    let geojsonLayer;
    let originalFoo;
    let originalConfig;

    before(async () => {
      scope = nock('http://myGeoJsonProvider')
        .get('/test.json')
        .times(2)
        .reply(200, JSON.stringify(testGeoJSON.featureCollection));

      geojsonLayer = new GeoJSONLayer({
        url: 'http://myGeoJsonProvider/test.json',
        features: [JSON.parse(JSON.stringify(testGeoJSON.featureWithStyle))],
      });

      await geojsonLayer.fetchData();
      originalFoo = geojsonLayer.getFeatures().find(f => f.get('name') === 'foo');
      [originalConfig] = geojsonLayer.getFeaturesById(['test']);
      await geojsonLayer.reload();
    });

    after(() => {
      scope.done();
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
        const config = new GeoJSONLayer({}).toJSON();
        expect(config).to.have.all.keys('name', 'type');
      });
    });

    describe('of a configured layer', () => {
      let inputConfig;
      let outputConfig;
      let configuredLayer;

      before(() => {
        inputConfig = {
          url: 'http://myGeoJsonProvider/test.json',
          features: [JSON.parse(JSON.stringify(testGeoJSON.featureWithStyle))],
        };
        configuredLayer = new GeoJSONLayer(inputConfig);
        outputConfig = configuredLayer.toJSON();
      });

      after(() => {
        configuredLayer.destroy();
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
        const layer = new GeoJSONLayer({
          features: [feature],
        });
        await layer.initialize();
        const config = layer.toJSON();
        expect(config).to.have.property('features')
          .and.to.have.lengthOf(1);

        expect(config.features[0]).to.have.property('id', 'test');
      });
    });
  });
});
