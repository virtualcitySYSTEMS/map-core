import { Cartographic, Ellipsoid } from '@vcmap-cesium/engine';
import nock from 'nock';
import { setCesiumMap } from '../helpers/cesiumHelpers.js';
import VcsApp from '../../../src/vcsApp.js';
import CameraLimiter, {
  CameraLimiterMode,
} from '../../../src/map/cameraLimiter.js';
import { setTerrainServer } from '../helpers/terrain/terrainData.js';
import Projection from '../../../src/util/projection.js';
import { mercatorCoordinates } from '../helpers/obliqueHelpers.js';

describe('maps.CameraLimiter', () => {
  let sandbox;
  let app;
  let scope;
  let sampleTerrain;
  let sampleTerrainMostDetailed;
  let camera;

  before(async () => {
    sandbox = sinon.createSandbox();
    app = new VcsApp();
    const map = await setCesiumMap(app);
    ({ camera } = map.getScene());
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(() => {
    app.destroy();
    nock.cleanAll();
  });

  describe('DISTANCE mode', () => {
    /** @type {import("@vcmap/core").CameraLimiter} */
    let cameraLimiter;

    before(() => {
      scope = nock('http://localhost');
      setTerrainServer(scope);
    });

    beforeEach(() => {
      cameraLimiter = new CameraLimiter({
        mode: CameraLimiterMode.DISTANCE,
        terrainUrl: 'http://localhost/terrain/',
      });
      const position = Projection.mercatorToWgs84(mercatorCoordinates);
      const cameraCartographic = Cartographic.fromDegrees(...position);
      Cartographic.toCartesian(
        cameraCartographic,
        Ellipsoid.WGS84,
        camera.position,
      );
      sampleTerrain = sandbox.spy(cameraLimiter, '_limitWithLevel');
      sampleTerrainMostDetailed = sandbox.spy(
        cameraLimiter,
        '_limitMostDetailed',
      );
    });

    it('should clamp the height, if the terrain provider is null', async () => {
      cameraLimiter.limit = 1300;
      cameraLimiter.terrainUrl = null;
      await cameraLimiter.limitCamera(camera);
      expect(Cartographic.fromCartesian(camera.position))
        .to.have.property('height')
        .and.to.be.closeTo(1300, 0.00001);
      expect(sampleTerrain).to.not.have.been.called;
      expect(sampleTerrainMostDetailed).to.not.have.been.called;
    });

    it('should update cameraLimiter terrainHeight based on the most detailed terrain', async () => {
      cameraLimiter.level = null;
      await cameraLimiter.limitCamera(camera);
      expect(sampleTerrainMostDetailed).to.have.been.called;
      expect(sampleTerrain).to.not.have.been.called;
    });

    it('should update cameraLimiter terrainHeight based on a specified level of terrain', async () => {
      await cameraLimiter.limitCamera(camera);
      expect(sampleTerrain).to.have.been.called;
      expect(sampleTerrainMostDetailed).to.not.have.been.called;
    });

    it('should call limitCamera only, if camera position changed', async () => {
      await cameraLimiter.limitCamera(camera);
      expect(sampleTerrain).to.have.been.calledOnce;
      await cameraLimiter.limitCamera(camera);
      expect(sampleTerrain).to.have.been.calledOnce;
    });

    it('should clamp the camera height based on last updated terrainHeight', async () => {
      cameraLimiter._terrainHeight = 2100;
      await cameraLimiter.limitCamera(camera);
      expect(Cartographic.fromCartesian(camera.position))
        .to.have.property('height')
        .and.to.be.closeTo(2300, 0.00001);
    });
  });

  describe('HEIGHT mode', () => {
    it('should clamp the camera height', async () => {
      const cameraLimiter = new CameraLimiter({});
      const cameraCartographic = new Cartographic(0, 0, 100);
      Cartographic.toCartesian(
        cameraCartographic,
        Ellipsoid.WGS84,
        camera.position,
      );
      await cameraLimiter.limitCamera(camera);
      expect(Cartographic.fromCartesian(camera.position))
        .to.have.property('height')
        .and.to.be.closeTo(200, 0.00001);
    });
  });

  describe('configuring the camera limiter', () => {
    describe('of an unconfigured limiter', () => {
      it('should return an empty object', () => {
        const config = new CameraLimiter({}).toJSON();
        expect(config).to.be.empty;
      });
    });

    describe('of a configured limiter', () => {
      let inputConfig;
      let outputConfig;

      before(() => {
        inputConfig = {
          mode: CameraLimiterMode.DISTANCE,
          terrainUrl: 'http://localhost/terrain/',
          level: null,
          limit: 1000,
        };
        outputConfig = new CameraLimiter(inputConfig).toJSON();
      });

      it('should configure mode', () => {
        expect(outputConfig).to.have.property('mode', inputConfig.mode);
      });

      it('should configure terrainUrl', () => {
        expect(outputConfig).to.have.property(
          'terrainUrl',
          inputConfig.terrainUrl,
        );
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
