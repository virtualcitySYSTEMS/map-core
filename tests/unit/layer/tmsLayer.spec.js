import TMSLayer from '../../../src/layer/tmsLayer.js';

describe('TMSLayer', () => {
  describe('getting config objects', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const config = (new TMSLayer({})).toJSON();
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
        configuredLayer = new TMSLayer(inputConfig);
        outputConfig = configuredLayer.toJSON();
      });

      after(() => {
        configuredLayer.destroy();
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
