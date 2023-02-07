import { JulianDate, DataSourceClock } from '@vcmap-cesium/engine';
import CzmlLayer from '../../../src/layer/czmlLayer.js';
import { vcsLayerName } from '../../../src/layer/layerSymbols.js';
import importJSON from '../helpers/importJSON.js';

const dynamicPoint = await importJSON('./tests/data/dynamicPointCzml.json');

describe('CzmlLayer', () => {
  describe('loading of data', () => {
    let sandbox;
    let layer;

    before(async () => {
      sandbox = sinon.createSandbox();
      const server = sandbox.useFakeServer();
      server.autoRespond = true;
      server.respondImmediately = true;
      server.respondWith('/dynamicPoint.czml', (res) => {
        res.respond(200, { 'Content-Type': 'application/json' }, JSON.stringify(dynamicPoint));
      });
      layer = new CzmlLayer({
        url: '/dynamicPoint.czml',
      });
      await layer.initialize();
    });

    after(() => {
      layer.destroy();
      sandbox.restore();
    });

    it('should load all the entities in the czml', () => {
      expect(layer.entities.values).to.have.lengthOf(1);
    });

    it('should set the layer name on all entities', () => {
      expect(layer.entities.values[0]).to.have.property(vcsLayerName, layer.name);
    });

    it('should set the clock from the czml', () => {
      const currentTime = JulianDate.fromIso8601('2012-08-04T16:00:00Z');
      expect(layer.clock).to.be.instanceOf(DataSourceClock);
      expect(layer.clock.currentTime).to.eql(currentTime);
    });
  });

  describe('getting a config', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const configuredLayer = new CzmlLayer({});
        const config = configuredLayer.toJSON();
        expect(config).to.have.all.keys('name', 'type');
        configuredLayer.destroy();
      });
    });

    describe('of a configured layer', () => {
      let inputConfig;
      let outputConfig;
      let configuredLayer;

      before(() => {
        inputConfig = {
          sourceUri: 'http://localhost',
        };
        configuredLayer = new CzmlLayer(inputConfig);
        outputConfig = configuredLayer.toJSON();
      });

      after(() => {
        configuredLayer.destroy();
      });

      it('should configure sourceUri', () => {
        expect(outputConfig).to.have.property('sourceUri', inputConfig.sourceUri);
      });
    });
  });
});
