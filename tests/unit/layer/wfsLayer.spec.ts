import { expect } from 'chai';
import type { WFSOptions } from '../../../src/layer/wfsLayer.js';
import WFSLayer from '../../../src/layer/wfsLayer.js';

describe('WFSLayer', () => {
  describe('getting config objects', () => {
    describe('of a configured layer', () => {
      let inputConfig: WFSOptions;
      let outputConfig: WFSOptions;
      let configuredLayer: WFSLayer;

      before(() => {
        inputConfig = {
          featureType: ['fType'],
          version: '2.0.0',
          getFeatureOptions: {
            TEST: 'true',
          },
          featureNS: 'fNS',
          featurePrefix: 'fPrefix',
        };
        configuredLayer = new WFSLayer(inputConfig);
        outputConfig = configuredLayer.toJSON();
      });

      after(() => {
        configuredLayer.destroy();
      });

      it('should configure version', () => {
        expect(outputConfig).to.have.property('version', inputConfig.version);
      });

      it('should configure featureType', () => {
        expect(outputConfig)
          .to.have.property('featureType')
          .and.to.have.members(inputConfig.featureType as string[]);
      });

      it('should configure featureNS', () => {
        expect(outputConfig).to.have.property(
          'featureNS',
          inputConfig.featureNS,
        );
      });

      it('should configure featurePrefix', () => {
        expect(outputConfig).to.have.property(
          'featurePrefix',
          inputConfig.featurePrefix,
        );
      });

      it('should configure getFeatureOptions', () => {
        expect(outputConfig)
          .to.have.property('getFeatureOptions')
          .and.to.eql(inputConfig.getFeatureOptions);
      });
    });
  });
});
