import { expect } from 'chai';
import sinon, { type SinonSandbox } from 'sinon';
import { type Size } from 'ol/size.js';
import type { WMSOptions } from '../../../src/layer/wmsLayer.js';
import WMSLayer from '../../../src/layer/wmsLayer.js';
import UrlIdAttributeProvider from '../../../src/featureProvider/urlIdAttributeProvider.js';
import {
  CompositeFeatureProvider,
  WMSFeatureProvider,
} from '../../../index.js';

describe('WMSLayer', () => {
  let sandbox: SinonSandbox;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  describe('handling of layers', () => {
    it('should configure the layers from the config', () => {
      const layer = new WMSLayer({ layers: 'one,two' });
      expect(layer.parameters.LAYERS).to.equal('one,two');
      layer.destroy();
    });

    it('should return an array of layers', () => {
      const layer = new WMSLayer({ layers: 'one,two' });
      expect(layer.getLayers()).to.have.members(['one', 'two']);
      layer.destroy();
    });

    describe('setting of layers', () => {
      let layer: WMSLayer;

      beforeEach(() => {
        layer = new WMSLayer({});
      });

      it('should set a string layer', async () => {
        await layer.setLayers('one');
        expect(layer.parameters.LAYERS).to.equal('one');
      });

      it('should set an array layer', async () => {
        await layer.setLayers(['one', 'two']);
        expect(layer.parameters.LAYERS).to.equal('one,two');
      });

      describe('when initialized', () => {
        it('should force a redraw', async () => {
          await layer.initialize();
          const redraw = sandbox.spy(layer, 'forceRedraw');
          await layer.setLayers(['one', 'two']);
          expect(redraw).to.have.been.called;
        });
      });
    });
  });

  describe('feature provider & feature info', () => {
    describe('with an attribute provider', () => {
      let configObject: WMSOptions;
      let options: WMSOptions;
      let layer: WMSLayer;

      before(async () => {
        options = {
          featureProvider: new UrlIdAttributeProvider({
            urlTemplate: '/{id}.json',
          }),
          featureInfo: {},
        };
        layer = new WMSLayer(options);
        await layer.initialize();
        configObject = layer.toJSON();
      });

      it('should create a composite feature provider', () => {
        expect(layer.featureProvider).to.be.instanceOf(
          CompositeFeatureProvider,
        );
      });

      it('should configure the attribute provider and feature info', () => {
        expect(configObject)
          .to.have.property('featureProvider')
          .that.deep.equals(
            (options.featureProvider as UrlIdAttributeProvider).toJSON(),
          );

        expect(configObject).to.have.property('featureInfo');
      });
    });

    describe('with feature provider', () => {
      let configObject: WMSOptions;
      let options: WMSOptions;
      let layer: WMSLayer;
      let featureProvider: WMSFeatureProvider;

      before(async () => {
        featureProvider = new WMSFeatureProvider({
          url: '/wms',
          parameters: {},
        });

        options = {
          featureProvider,
          featureInfo: {},
        };
        layer = new WMSLayer(options);
        await layer.initialize();
        configObject = layer.toJSON();
      });

      after(() => {
        layer.destroy();
      });

      it('should overwrite the feature provider', () => {
        expect(layer.featureProvider).to.not.equal(featureProvider);
        expect(layer.featureProvider).to.be.instanceOf(WMSFeatureProvider);
      });

      it('should create a composite feature provider', () => {
        expect(configObject).to.not.have.property('featureProvider');
        expect(configObject).to.have.property('featureInfo');
      });
    });
  });

  describe('getting config objects', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const layer = new WMSLayer({});
        const config = layer.toJSON();
        expect(config).to.have.all.keys('name', 'type');
        layer.destroy();
      });
    });

    describe('of a configured layer', () => {
      let inputConfig: WMSOptions;
      let outputConfig: WMSOptions;
      let configuredLayer: WMSLayer;

      before(() => {
        inputConfig = {
          layers: 'one,two',
          version: '1.3.0',
          parameters: {
            TEST: 'true',
          },
          highResolution: true,
          tileSize: [512, 512],
          featureInfo: {
            type: 'WMSFeatureProvider',
            responseType: 'application/json',
          },
          singleImage2d: true,
        };
        configuredLayer = new WMSLayer(inputConfig);
        outputConfig = configuredLayer.toJSON();
      });

      after(() => {
        configuredLayer.destroy();
      });

      it('should configure layers', () => {
        expect(outputConfig).to.have.property('layers', inputConfig.layers);
      });

      it('should configure version', () => {
        expect(outputConfig).to.have.property('version', inputConfig.version);
      });

      it('should configure highResolution', () => {
        expect(outputConfig).to.have.property(
          'highResolution',
          inputConfig.highResolution,
        );
      });

      it('should configure singleImage2d', () => {
        expect(outputConfig).to.have.property(
          'singleImage2d',
          inputConfig.singleImage2d,
        );
      });

      it('should configure parameters', () => {
        expect(outputConfig)
          .to.have.property('parameters')
          .and.to.have.property('TEST', 'true');
      });

      it('should configure tileSize', () => {
        expect(outputConfig)
          .to.have.property('tileSize')
          .and.to.have.members(inputConfig.tileSize as Size);
      });

      it('should configure feature info', () => {
        expect(outputConfig)
          .to.have.property('featureInfo')
          .and.to.eql(inputConfig.featureInfo);
      });
    });

    describe('when overloading the feature info provider', () => {
      let inputConfig: WMSOptions;
      let outputConfig: WMSOptions;
      let configuredLayer: WMSLayer;

      before(async () => {
        inputConfig = {
          url: '/wms',
          featureInfo: {
            responseType: 'application/json',
            url: '/wms2',
            tileSize: [512, 512],
          },
        };
        configuredLayer = new WMSLayer(inputConfig);
        await configuredLayer.initialize();
        outputConfig = configuredLayer.toJSON();
      });

      after(() => {
        configuredLayer.destroy();
      });

      it('should configure feature info', () => {
        expect(outputConfig)
          .to.have.property('featureInfo')
          .and.to.eql(inputConfig.featureInfo);
      });
    });
  });
});
