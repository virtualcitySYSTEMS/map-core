import Cartographic from 'cesium/Source/Core/Cartographic.js';
import Ellipsoid from 'cesium/Source/Core/Ellipsoid.js';
import { setCesiumMap } from '../../helpers/cesiumHelpers.js';
import { getFramework } from '../../helpers/framework.js';
import CameraLimiter, { Mode } from '../../../../src/vcs/vcm/maps/cameraLimiter.js';
import resetFramework from '../../helpers/resetFramework.js';

describe('vcs.vcm.maps.CameraLimiter', () => {
  let sandbox;
  let sampleTerrain;
  let sampleTerrainMostDetailed;
  let camera;

  before(async () => {
    sandbox = sinon.createSandbox();
    const map = await setCesiumMap(getFramework());
    ({ camera } = map.getScene());
  });

  beforeEach(() => {
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(() => {
    resetFramework();
  });

  describe('DISTANCE mode', () => {
    /** @type {vcs.vcm.maps.CameraLimiter} */
    let cameraLimiter;
    beforeEach(() => {
      cameraLimiter = new CameraLimiter({
        mode: Mode.DISTANCE,
        terrainUrl: 'http://localhost',
      });
      const cameraCartographic = new Cartographic(0, 0, 1200);
      Cartographic.toCartesian(cameraCartographic, Ellipsoid.WGS84, camera.position);
      sampleTerrain = sandbox.stub(cameraLimiter, '_limitWithLevel');
      sampleTerrainMostDetailed = sandbox.stub(cameraLimiter, '_limitMostDetailed');
    });

    it('should clamp the height, if the terrain provider is null', async () => {
      cameraLimiter.limit = 1300;
      cameraLimiter.terrainUrl = null;
      await cameraLimiter.limitCamera(camera);
      expect(Cartographic.fromCartesian(camera.position)).to.have.property('height')
        .and.to.be.closeTo(1300, 0.00001);
      expect(sampleTerrain).to.not.have.been.called;
      expect(sampleTerrainMostDetailed).to.not.have.been.called;
    });

    it('should limit the camera to have a height based on the most detailed terrain', async () => {
      sampleTerrainMostDetailed.returns(Promise.resolve([new Cartographic(0, 0, 1100)]));
      cameraLimiter.level = null;
      await cameraLimiter.limitCamera(camera);
      expect(Cartographic.fromCartesian(camera.position)).to.have.property('height')
        .and.to.be.closeTo(1300, 0.00001);
      expect(sampleTerrain).to.not.have.been.called;
    });

    it('should limit the camera to have a height based on a specified level of terrain', async () => {
      sampleTerrain.returns(Promise.resolve([new Cartographic(0, 0, 1100)]));
      await cameraLimiter.limitCamera(camera);
      expect(Cartographic.fromCartesian(camera.position)).to.have.property('height')
        .and.to.be.closeTo(1300, 0.00001);
      expect(sampleTerrainMostDetailed).to.not.have.been.called;
    });
  });

  describe('HEIGHT mode', () => {
    it('should lamp the camera height', async () => {
      const cameraLimiter = new CameraLimiter({});
      const cameraCartographic = new Cartographic(0, 0, 100);
      Cartographic.toCartesian(cameraCartographic, Ellipsoid.WGS84, camera.position);
      await cameraLimiter.limitCamera(camera);
      expect(Cartographic.fromCartesian(camera.position)).to.have.property('height')
        .and.to.be.closeTo(200, 0.00001);
    });
  });

  describe('configuring the camera limiter', () => {
    describe('of an unconfigured limiter', () => {
      it('should return an empty object', () => {
        const config = new CameraLimiter({}).getConfigObject();
        expect(config).to.be.empty;
      });
    });

    describe('of a configured limiter', () => {
      let inputConfig;
      let outputConfig;

      before(() => {
        inputConfig = {
          mode: Mode.DISTANCE,
          terrainUrl: 'http://localhost',
          level: null,
          limit: 1000,
        };
        outputConfig = new CameraLimiter(inputConfig).getConfigObject();
      });

      it('should configure mode', () => {
        expect(outputConfig).to.have.property('mode', inputConfig.mode);
      });

      it('should configure terrainUrl', () => {
        expect(outputConfig).to.have.property('terrainUrl', inputConfig.terrainUrl);
      });

      it('should configure level', () => {
        expect(outputConfig).to.have.property('level', inputConfig.level);
      });

      it('should configure limit', () => {
        expect(outputConfig).to.have.property('limit', inputConfig.limit);
      });
    });
  });
});
