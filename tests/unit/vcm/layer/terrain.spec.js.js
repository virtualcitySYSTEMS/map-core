import Terrain from '../../../../src/vcs/vcm/layer/terrain.js';

describe('vcs.vcm.layer.Terrain', () => {
  describe('getting config objects', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const config = (new Terrain({})).getConfigObject();
        expect(config).to.have.all.keys('name', 'type');
      });
    });

    describe('of a configured layer', () => {
      let inputConfig;
      let outputConfig;
      let configuredLayer;

      before(() => {
        inputConfig = {
          requestVertexNormals: false,
          requestWaterMask: true,
        };
        configuredLayer = new Terrain(inputConfig);
        outputConfig = configuredLayer.getConfigObject();
      });

      after(() => {
        configuredLayer.dispose();
      });

      it('should configure requestVertexNormals', () => {
        expect(outputConfig).to.have.property('requestVertexNormals', inputConfig.requestVertexNormals);
      });

      it('should configure requestWaterMask', () => {
        expect(outputConfig).to.have.property('requestWaterMask', inputConfig.requestWaterMask);
      });
    });
  });
});