import SingleImageLayer from '../../../src/layer/singleImageLayer.js';
import Extent from '../../../src/util/extent.js';
import { wgs84Projection } from '../../../src/util/projection.js';

describe('SingleImageLayer', () => {
  describe('constructing a single image layer', () => {
    it('should create a global extent, if the extent is invalid', () => {
      const layer = new SingleImageLayer({ extent: { coordinates: [1, 2, 3], projection: { epsg: 3123 } } });
      expect(layer.extent.extent).to.have.ordered.members([-180, -90, 180, 90]);
      expect(layer.extent.projection).to.have.property('epsg', 'EPSG:4326');
      layer.destroy();
    });
  });

  describe('setting the extent', () => {
    let layer;

    before(() => {
      layer = new SingleImageLayer({});
    });

    after(() => {
      layer.destroy();
    });

    it('should set a valid extent', () => {
      const extent = new Extent({
        projection: wgs84Projection.toJSON(),
        coordinates: [0, 0, 180, 90],
      });
      layer.setExtent(extent);
      expect(layer).to.have.property('extent', extent);
    });

    it('should throw an error if passing in an invalid extent', () => {
      const extent = new Extent({
        projection: wgs84Projection.toJSON(),
        coordinates: [0, 0],
      });
      expect(layer.setExtent.bind(layer, extent)).to.throw;
    });
  });

  describe('getting a config', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const defaultLayer = new SingleImageLayer({});
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
        configuredLayer = new SingleImageLayer(inputConfig);
        outputConfig = configuredLayer.toJSON();
      });

      after(() => {
        configuredLayer.destroy();
      });

      it('should set credit', () => {
        expect(outputConfig).to.have.property('credit', inputConfig.credit);
      });
    });
  });
});
