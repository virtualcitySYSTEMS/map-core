import SingleImage from '../../../../src/vcs/vcm/layer/singleImage.js';
import Extent from '../../../../src/vcs/vcm/util/extent.js';

describe('vcs.vcm.layer.SingleImage', () => {
  describe('constructing a single image layer', () => {
    it('should create a global extent, if the extent is invalid', () => {
      const layer = new SingleImage({ extent: { coordinates: [1, 2, 3], epsg: 3123 } });
      expect(layer.extent.extent).to.have.ordered.members([-180, -90, 180, 90]);
      expect(layer.extent.projection).to.have.property('epsg', 'EPSG:4326');
      layer.destroy();
    });
  });

  describe('setting the extent', () => {
    let layer;

    before(() => {
      layer = new SingleImage({});
    });

    after(() => {
      layer.destroy();
    });

    it('should set a valid extent', () => {
      const extent = new Extent({
        epsg: 4326,
        coordinates: [0, 0, 180, 90],
      });
      layer.setExtent(extent);
      expect(layer).to.have.property('extent', extent);
    });

    it('should throw an error if passing in an invalid extent', () => {
      const extent = new Extent({
        epsg: 4326,
        coordinates: [0, 0],
      });
      expect(layer.setExtent.bind(layer, extent)).to.throw;
    });
  });

  describe('getting a config', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const defaultLayer = new SingleImage({});
        const config = defaultLayer.toJSON();
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
        outputConfig = configuredLayer.toJSON();
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
