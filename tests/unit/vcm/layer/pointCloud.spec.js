import PointCloud from '../../../../src/vcs/vcm/layer/pointCloud.js';
import VectorStyleItem from '../../../../src/vcs/vcm/util/style/vectorStyleItem.js';

describe('vcs.vcm.layer.PointCloud', () => {
  let sandbox;
  /** @type {vcs.vcm.layer.PointCloud} */
  let PCL;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  beforeEach(() => {
    PCL = new PointCloud({});
  });

  afterEach(() => {
    PCL.destroy();
    sandbox.restore();
  });

  describe('setStyle', () => {
    it('should not set a vector style item', () => {
      const style = new VectorStyleItem({});
      PCL.setStyle(style);
      expect(PCL.style).to.not.equal(style);
    });
  });

  describe('clearStyle', () => {
    beforeEach(async () => { await PCL.initialize(); });

    it('should set no pointSize, if no default was specified', () => {
      PCL.pointSize = 3;
      PCL.clearStyle();
      expect(PCL.pointSize).to.be.null;
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
        const config = PCL.getConfigObject();
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
        configuredLayer = new PointCloud(inputConfig);
        outputConfig = configuredLayer.getConfigObject();
      });

      after(() => {
        configuredLayer.destroy();
      });

      it('should configure pointSize', () => {
        expect(outputConfig).to.have.property('pointSize', inputConfig.pointSize);
      });
    });
  });
});
