import { expect } from 'chai';
import type { COGLayerOptions } from '../../../src/layer/cogLayer.js';
import COGLayer from '../../../src/layer/cogLayer.js';

describe('COGLayer', () => {
  describe('configuration', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const config = new COGLayer({}).toJSON();
        expect(config).to.have.all.keys('name', 'type');
      });
    });

    describe('of a configured layer', () => {
      let inputConfig: COGLayerOptions;
      let outputConfig: COGLayerOptions;
      let configuredLayer: COGLayer;

      before(() => {
        inputConfig = {
          url: 'http://localhost/test.tiff',
          convertToRGB: false,
          normalize: true,
          interpolate: false,
        };
        configuredLayer = new COGLayer(inputConfig);
        outputConfig = configuredLayer.toJSON();
      });

      after(() => {
        configuredLayer.destroy();
      });

      it('should configure url', () => {
        expect(outputConfig).to.have.property('url', inputConfig.url);
      });

      it('should configure convertToRGB', () => {
        expect(outputConfig).to.have.property('convertToRGB', false);
      });

      it('should configure normalize', () => {
        expect(outputConfig).to.have.property('normalize', true);
      });

      it('should configure interpolate', () => {
        expect(outputConfig).to.have.property('interpolate', false);
      });
    });
  });
});
