import WMTSLayer from '../../../src/layer/wmtsLayer.js';

describe('WMTSLayer', () => {
  describe('getting config objects', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const config = new WMTSLayer({}).toJSON();
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
          wmtsStyle: 'style',
          tileMatrixPrefix: 'tileMatrixPrefix',
          tileMatrixSetID: 'tileMatrixSetID',
          openlayersOptions: { test: 'test' },
          matrixIds: ['1', '2'],
          tileSize: [512, 512],
        };
        configuredLayer = new WMTSLayer(inputConfig);
        outputConfig = configuredLayer.toJSON();
      });

      after(() => {
        configuredLayer.destroy();
      });

      it('should configure tilingSchema', () => {
        expect(outputConfig).to.have.property(
          'tilingSchema',
          inputConfig.tilingSchema,
        );
      });

      it('should configure format', () => {
        expect(outputConfig).to.have.property('format', inputConfig.format);
      });

      it('should configure tileSize', () => {
        expect(outputConfig)
          .to.have.property('tileSize')
          .and.to.have.members(inputConfig.tileSize);
      });

      it('should configure matrixIds', () => {
        expect(outputConfig)
          .to.have.property('matrixIds')
          .and.to.have.members(inputConfig.matrixIds);
      });

      it('should configure numberOfLevelZeroTilesY', () => {
        expect(outputConfig).to.have.property(
          'numberOfLevelZeroTilesY',
          inputConfig.numberOfLevelZeroTilesY,
        );
      });

      it('should configure numberOfLevelZeroTilesX', () => {
        expect(outputConfig).to.have.property(
          'numberOfLevelZeroTilesX',
          inputConfig.numberOfLevelZeroTilesX,
        );
      });

      it('should configure layer', () => {
        expect(outputConfig).to.have.property('layer', inputConfig.layer);
      });

      it('should configure wmtsStyle', () => {
        expect(outputConfig).to.have.property(
          'wmtsStyle',
          inputConfig.wmtsStyle,
        );
      });

      it('should configure tileMatrixPrefix', () => {
        expect(outputConfig).to.have.property(
          'tileMatrixPrefix',
          inputConfig.tileMatrixPrefix,
        );
      });

      it('should configure tileMatrixSetID', () => {
        expect(outputConfig).to.have.property(
          'tileMatrixSetID',
          inputConfig.tileMatrixSetID,
        );
      });

      it('should configure openlayersOptions', () => {
        expect(outputConfig)
          .to.have.property('openlayersOptions')
          .and.to.have.keys('test');
      });
    });
  });
});
