import { expect } from 'chai';
import {
  JulianDate,
  Math as CesiumMath,
  Cartesian3,
} from '@vcmap-cesium/engine';
import sinon from 'sinon';
import {
  startRotation,
  calculateRotation,
  rotationMapControlSymbol,
} from '../../../src/util/rotation.js';
import VcsApp from '../../../src/vcsApp.js';
import Viewpoint from '../../../src/util/viewpoint.js';
import { setCesiumMap } from '../helpers/cesiumHelpers.js';
import { CesiumMap } from '../../../index.js';

describe('rotation', () => {
  let app: VcsApp;
  let mockPickPosition: sinon.SinonStub;
  const viewpoint = new Viewpoint({
    groundPosition: [13.43080593131163, 52.51123474050636, 35.229622864799836],
    heading: 337.52854532052663,
    pitch: -41.10601490149314,
  });

  beforeEach(async () => {
    app = new VcsApp();
    const map = await setCesiumMap(app);
    const scene = map.getScene()!;
    mockPickPosition = sinon
      .stub(scene, 'pickPosition')
      .returns(new Cartesian3(1, 1, 1));
  });

  afterEach(() => {
    app.destroy();
    mockPickPosition.restore();
  });

  describe('startRotation', () => {
    it('should return a function', async () => {
      const stopRotation = await startRotation(app, viewpoint);
      expect(stopRotation).to.be.a('function');
      stopRotation();
    });

    it('should calculate the correct rotation', () => {
      const rotationSpeed = 45;
      const timeLastTick = JulianDate.now();
      expect(app.maps.activeMap).to.be.an.instanceOf(CesiumMap);

      const result = calculateRotation(
        0,
        app.maps.activeMap as CesiumMap,
        rotationSpeed,
        timeLastTick,
      );

      expect(result).to.be.closeTo(
        CesiumMath.TWO_PI / (rotationSpeed * 60),
        0.001,
      );
    });
  });
  describe('startRotation and stopRotation request exclusiveMapControl', () => {
    it('should raise exclusiveMapControlsChanged event with id "rotation" on startRotation', async () => {
      const spy = sinon.spy(app.maps.exclusiveMapControlsChanged, 'raiseEvent');

      await startRotation(app, viewpoint);

      expect(spy.calledOnce).to.be.true;
      expect(spy.firstCall.args[0]).to.deep.equal({
        options: {
          apiCalls: true,
          keyEvents: true,
          pointerEvents: true,
        },
        id: rotationMapControlSymbol,
      });

      spy.restore();
    });

    it('should raise exclusiveMapControlsChanged event without id "rotation" on stopRotation', async () => {
      const spy = sinon.spy(app.maps.exclusiveMapControlsChanged, 'raiseEvent');

      const stopRotationFn = await startRotation(app, viewpoint);
      expect(stopRotationFn).to.be.a('function');

      stopRotationFn();

      expect(spy.calledTwice).to.be.true;
      expect(spy.secondCall.args[0]).to.deep.equal({
        options: {
          apiCalls: false,
          keyEvents: false,
          pointerEvents: false,
        },
      });

      spy.restore();
    });
  });
});
