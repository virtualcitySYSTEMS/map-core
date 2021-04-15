import WMTS from '../../../../src/vcs/vcm/layer/wmts.js';

describe('vcs.vcm.layer.WMTS', () => {
  describe('getting config objects', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const config = (new WMTS({})).getConfigObject();
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
          numberOfLevelZeroTilesY: 2,
          numberOfLevelZeroTilesX: 2,
          format: 'png',
          layer: 'layer',
          style: 'style',
          tileMatrixPrefix: 'tileMatrixPrefix',
          tileMatrixSetID: 'tileMatrixSetID',
          openlayersOptions: { test: 'test' },
          matrixIds: ['1', '2'],
          tileSize: [512, 512],
        };
        configuredLayer = new WMTS(inputConfig);
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

      it('should configure matrixIds', () => {
        expect(outputConfig).to.have.property('matrixIds')
          .and.to.have.members(inputConfig.matrixIds);
      });

      it('should configure numberOfLevelZeroTilesY', () => {
        expect(outputConfig).to.have.property('numberOfLevelZeroTilesY', inputConfig.numberOfLevelZeroTilesY);
      });

      it('should configure numberOfLevelZeroTilesX', () => {
        expect(outputConfig).to.have.property('numberOfLevelZeroTilesX', inputConfig.numberOfLevelZeroTilesX);
      });

      it('should configure layer', () => {
        expect(outputConfig).to.have.property('layer', inputConfig.layer);
      });

      it('should configure style', () => {
        expect(outputConfig).to.have.property('style', inputConfig.style);
      });

      it('should configure tileMatrixPrefix', () => {
        expect(outputConfig).to.have.property('tileMatrixPrefix', inputConfig.tileMatrixPrefix);
      });

      it('should configure tileMatrixSetID', () => {
        expect(outputConfig).to.have.property('tileMatrixSetID', inputConfig.tileMatrixSetID);
      });

      it('should configure openlayersOptions', () => {
        expect(outputConfig).to.have.property('openlayersOptions')
          .and.to.have.keys('test');
      });
    });
  });
});
