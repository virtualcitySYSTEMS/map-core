import TMS from '../../../../src/vcs/vcm/layer/tms.js';

describe('vcs.vcm.layer.TMS', () => {
  describe('getting config objects', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const config = (new TMS({})).getConfigObject();
        expect(config).to.have.all.keys('name', 'type');
      });
    });

    describe('of a configured layer', () => {
      let inputConfig;
      let outputConfig;
      let configuredLayer;

      before(() => {
        inputConfig = {
          tilingSchema: 'geographic',
          format: 'png',
          tileSize: [512, 512],
        };
        configuredLayer = new TMS(inputConfig);
        outputConfig = configuredLayer.getConfigObject();
      });

      after(() => {
        configuredLayer.dispose();
      });

      it('should configure tilingSchema', () => {
        expect(outputConfig).to.have.property('tilingSchema', inputConfig.tilingSchema);
      });

      it('should configure format', () => {
        expect(outputConfig).to.have.property('format', inputConfig.format);
      });

      it('should configure tileSize', () => {
        expect(outputConfig).to.have.property('tileSize')
          .and.to.have.members(inputConfig.tileSize);
      });
    });
  });
});
