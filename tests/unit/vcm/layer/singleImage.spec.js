import SingleImage from '../../../../src/vcs/vcm/layer/singleImage.js';

describe('vcs.vcm.layer.SingleImage', () => {
  describe('getting a config', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const defaultLayer = new SingleImage({});
        const config = defaultLayer.getConfigObject();
        expect(config).to.have.all.keys('name', 'type');
        defaultLayer.destroy();
      });
    });

    describe('of a configured layer', () => {
      let inputConfig;
      let outputConfig;
      let configuredLayer;

      before(() => {
        inputConfig = {
          credit: 'test',
        };
        configuredLayer = new SingleImage(inputConfig);
        outputConfig = configuredLayer.getConfigObject();
      });

      after(() => {
        configuredLayer.dispose();
      });

      it('should set credit', () => {
        expect(outputConfig).to.have.property('credit', inputConfig.credit);
      });
    });
  });
});
