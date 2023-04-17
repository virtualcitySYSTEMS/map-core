import TerrainLayer from '../../../src/layer/terrainLayer.js';

describe('TerrainLayer', () => {
  describe('getting config objects', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const config = new TerrainLayer({}).toJSON();
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
        configuredLayer = new TerrainLayer(inputConfig);
        outputConfig = configuredLayer.toJSON();
      });

      after(() => {
        configuredLayer.destroy();
      });

      it('should configure requestVertexNormals', () => {
        expect(outputConfig).to.have.property(
          'requestVertexNormals',
          inputConfig.requestVertexNormals,
        );
      });

      it('should configure requestWaterMask', () => {
        expect(outputConfig).to.have.property(
          'requestWaterMask',
          inputConfig.requestWaterMask,
        );
      });
    });
  });
});
