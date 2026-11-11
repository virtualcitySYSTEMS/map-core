import PointCloudLayer from '../../../src/layer/pointCloudLayer.js';
import VectorStyleItem from '../../../src/style/vectorStyleItem.js';
import { createTilesetServer } from '../helpers/cesiumHelpers.js';
import { getPanoramaMap } from '../helpers/panoramaHelpers.js';

describe('PointCloudLayer', () => {
  let sandbox;
  /** @type {import("@vcmap/core").PointCloudLayer} */
  let PCL;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  beforeEach(() => {
    PCL = new PointCloudLayer({});
  });

  afterEach(() => {
    PCL.destroy();
    sandbox.restore();
  });

  describe('rendering a depth pass', () => {
    let map;
    let layer;

    beforeEach(() => {
      createTilesetServer(sandbox);
      map = getPanoramaMap();
      layer = new PointCloudLayer({
        url: 'http://test.com/tileset.json',
        renderDepthPass: true,
      });
      map.layerCollection.add(layer);
    });

    afterEach(() => {
      layer.destroy();
      map.destroy();
    });

    it('should add the tileset of an inactive layer to the depth pass, without activating the layer', async () => {
      await layer.mapActivated(map);
      expect(map.depthPass).to.have.property('size', 1);
      expect(layer.active).to.be.false;
    });
  });

  describe('isSupported', () => {
    let map;

    beforeEach(() => {
      map = getPanoramaMap({ layerTypes: ['PanoramaDatasetLayer'] });
    });

    afterEach(() => {
      map.destroy();
    });

    it('should support a panorama map not listing point clouds, if rendering a depth pass', () => {
      const layer = new PointCloudLayer({ renderDepthPass: true });
      expect(layer.isSupported(map)).to.be.true;
      layer.destroy();
    });

    it('should not support a panorama map not listing point clouds, if not rendering a depth pass', () => {
      expect(PCL.isSupported(map)).to.be.false;
    });
  });

  describe('setStyle', () => {
    it('should not set a vector style item', () => {
      const style = new VectorStyleItem({});
      PCL.setStyle(style);
      expect(PCL.style).to.not.equal(style);
    });
  });

  describe('clearStyle', () => {
    beforeEach(async () => {
      await PCL.initialize();
    });

    it('should set no pointSize, if no default was specified', () => {
      PCL.pointSize = 3;
      PCL.clearStyle();
      expect(PCL.pointSize).to.be.undefined;
    });

    it('should set the default point size, which is the given pointsize in the constructor', () => {
      PCL.defaultPointSize = 3;
      PCL.pointSize = undefined;
      PCL.clearStyle();
      expect(PCL.pointSize).to.equal(3);
    });
  });

  describe('getting config objects', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const config = PCL.toJSON();
        expect(config).to.have.all.keys('name', 'type');
      });
    });

    describe('of a configured layer', () => {
      let inputConfig;
      let outputConfig;
      let configuredLayer;

      before(() => {
        inputConfig = {
          pointSize: 3,
        };
        configuredLayer = new PointCloudLayer(inputConfig);
        outputConfig = configuredLayer.toJSON();
      });

      after(() => {
        configuredLayer.destroy();
      });

      it('should configure pointSize', () => {
        expect(outputConfig).to.have.property(
          'pointSize',
          inputConfig.pointSize,
        );
      });
    });
  });
});
