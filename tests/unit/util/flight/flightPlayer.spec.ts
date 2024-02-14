import sinon from 'sinon';
import { expect } from 'chai';
import { Scene } from '@vcmap-cesium/engine';
import getDummyFlight from './getDummyFlightInstance.js';
import { getVcsEventSpy, setCesiumMap } from '../../helpers/cesiumHelpers.js';
import {
  FlightInstance,
  VcsApp,
  createFlightPlayer,
  FlightPlayer,
  CesiumMap,
} from '../../../../index.js';

function raisePostRender(cesiumMap: CesiumMap): void {
  const cesiumWidget = cesiumMap.getCesiumWidget()!;
  cesiumWidget.scene.postRender.raiseEvent(
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    cesiumWidget.scene,
    cesiumWidget.clock.currentTime,
  );
}

describe('FlightPlayer', () => {
  let sandbox: sinon.SinonSandbox;
  let FP: FlightPlayer;
  let flight: FlightInstance;
  let scene: Scene;
  let app: VcsApp;
  let cesiumMap: CesiumMap;

  before(async () => {
    app = new VcsApp();
    sandbox = sinon.createSandbox();
    cesiumMap = await setCesiumMap(app);
    scene = cesiumMap.getScene()!;
  });

  beforeEach(async () => {
    flight = getDummyFlight();
    FP = await createFlightPlayer(flight, app);
  });

  afterEach(() => {
    FP.destroy();
    flight.destroy();
    sandbox.restore();
  });

  after(() => {
    flight.destroy();
    app.destroy();
  });

  describe('play', () => {
    it('should not play invalid flight', async () => {
      const invalidFP = await createFlightPlayer(new FlightInstance({}), app);
      invalidFP.play();
      expect(FP.state).to.equal('stopped');
    });

    it('should set the state to playing', () => {
      FP.play();
      expect(FP.state).to.equal('playing');
    });

    it('should set the clocks current system time to null', () => {
      FP.clock.currentSystemTime = Date.now();
      FP.play();
      expect(FP.clock.currentSystemTime).to.be.undefined;
    });

    it('should emit stateChanged', () => {
      const spy = getVcsEventSpy(FP.stateChanged, sandbox);
      FP.play();
      expect(spy).to.have.been.calledOnceWith('playing');
    });

    it('should not emit stateChanged if already playing', () => {
      FP.play();
      const spy = getVcsEventSpy(FP.stateChanged, sandbox);
      FP.play();
      expect(spy).to.not.have.been.called;
    });
  });

  describe('cesiumPostRender', () => {
    let clock: sinon.SinonFakeTimers;
    let pastEnd: number;

    beforeEach(() => {
      clock = sandbox.useFakeTimers(10000);
      pastEnd = FP.clock.endTime + 10;
      FP.play();
    });

    it('should set the current system time to the seconds of day', () => {
      raisePostRender(cesiumMap);
      expect(FP.clock).to.have.property('currentSystemTime', 10);
      clock.tick(1000);
      raisePostRender(cesiumMap);
      expect(FP.clock).to.have.property('currentSystemTime', 11);
    });

    it('should add the difference of the last system time to now to the current time', () => {
      raisePostRender(cesiumMap);
      clock.tick(1000);
      raisePostRender(cesiumMap);
      expect(FP.clock).to.have.property('currentTime', 1);
    });

    it('should multiply the difference with the current multiplier', () => {
      raisePostRender(cesiumMap);
      flight.multiplier = 0.1;
      clock.tick(1000);
      raisePostRender(cesiumMap);
      expect(FP.clock).to.have.property('currentTime', flight.multiplier);
    });

    it('should disable inputs on the screenSpaceController', () => {
      raisePostRender(cesiumMap);
      expect(scene.screenSpaceCameraController.enableInputs).to.be.false;
    });

    it('should set the view on the camera', () => {
      const setView = sandbox.spy(scene.camera, 'setView');
      raisePostRender(cesiumMap);
      expect(setView).to.have.been.called;
    });

    describe('currentTime > endTime', () => {
      beforeEach(() => {
        FP.play();
        raisePostRender(cesiumMap);
      });

      it('should call stop and return', () => {
        const stateChanged = getVcsEventSpy(FP.stateChanged, sandbox);
        clock.tick(pastEnd * 1000);
        raisePostRender(cesiumMap);
        expect(stateChanged).to.have.been.calledOnceWith('stopped');
      });

      it('should subtract the end time from the current time and continue if repeating', () => {
        flight.loop = true;
        clock.tick(pastEnd * 1000);
        raisePostRender(cesiumMap);
        expect(FP.clock)
          .to.have.property('currentTime')
          .and.to.be.closeTo(4, 0.001);
      });
    });

    describe('currentTime < startTime', () => {
      beforeEach(() => {
        FP.play();
        raisePostRender(cesiumMap);
        FP.clock.currentTime = -1;
      });

      it('should set the start time as the current time', () => {
        raisePostRender(cesiumMap);
        expect(FP.clock).to.have.property('currentTime', FP.clock.startTime);
      });

      it('should double back, if repeat is true', () => {
        flight.loop = true;
        raisePostRender(cesiumMap);
        expect(FP.clock).to.have.property('currentTime', FP.clock.endTime - 1);
      });
    });

    describe('paused', () => {
      beforeEach(() => {
        FP.play();
        raisePostRender(cesiumMap);
        FP.pause();
      });

      it('should set the state to pauses', () => {
        expect(FP.state).to.equal('paused');
      });

      it('should emit stateChanged', () => {
        FP.play();
        const spy = getVcsEventSpy(FP.stateChanged, sandbox);
        FP.pause();
        expect(spy).to.have.been.calledOnceWith('paused');
      });

      it('should not emit stateChange if already paused', () => {
        const spy = getVcsEventSpy(FP.stateChanged, sandbox);
        FP.pause();
        expect(spy).to.not.have.been.called;
      });

      it('should not update currentTime', () => {
        clock.tick(1000);
        raisePostRender(cesiumMap);
        expect(FP.clock).to.have.property('currentTime', 0);
      });

      it('should enable input on the screen space controller', () => {
        clock.tick(1000);
        raisePostRender(cesiumMap);
        expect(scene.screenSpaceCameraController.enableInputs).to.be.true;
      });
    });
  });

  describe('manipulation the flights collection', () => {
    it('should destroy the player, when adding a flight with the same name to the app', () => {
      const spy = getVcsEventSpy(FP.destroyed, sandbox);
      app.flights.add(flight);
      expect(spy).to.have.been.called;
    });

    it('should destroy the player when removing the flight', async () => {
      FP.destroy();
      app.flights.add(flight);
      FP = await createFlightPlayer(flight, app);
      const spy = getVcsEventSpy(FP.destroyed, sandbox);
      app.flights.remove(flight);
      expect(spy).to.have.been.called;
    });
  });

  describe('stop', () => {
    beforeEach(() => {
      FP.play();
    });

    it('should enable input on the screenSpaceCamerController', () => {
      scene.screenSpaceCameraController.enableInputs = false;
      FP.stop();
      expect(scene.screenSpaceCameraController).to.have.property(
        'enableInputs',
        true,
      );
    });

    it('should change the state', () => {
      FP.stop();
      expect(FP.state).to.equal('stopped');
    });

    it('should emit state changed', () => {
      const stateChanged = getVcsEventSpy(FP.stateChanged, sandbox);
      FP.stop();
      expect(stateChanged).to.have.been.calledOnceWith('stopped');
    });

    it('should not emit state changed if already stopped', () => {
      FP.stop();
      const stateChanged = getVcsEventSpy(FP.stateChanged, sandbox);
      FP.stop();
      expect(stateChanged).to.not.have.been.called;
    });

    it('should reset the clock', () => {
      FP.clock.currentSystemTime = Date.now();
      FP.clock.currentTime = 10;
      FP.stop();
      expect(FP.clock).to.have.property('currentSystemTime', undefined);
      expect(FP.clock).to.have.property('currentTime', 0);
    });
  });

  describe('goToTime', () => {
    beforeEach(() => {
      FP.play();
    });

    it('should set the clocks currentTime to the time', () => {
      FP.goToTime(2);
      expect(FP.clock.currentTime).to.equal(2);
    });

    it('should set the current system time to null', () => {
      FP.goToTime(2);
      expect(FP.clock.currentSystemTime).to.be.undefined;
    });

    describe('setting view', () => {
      let setView: sinon.SinonSpy;

      beforeEach(() => {
        setView = sandbox.spy(scene.camera, 'setView');
      });

      it('should set the view if not playing', () => {
        FP.stop();
        FP.goToTime(2);
        expect(setView).to.have.been.called;
      });

      it('should set the view if playing and paused', () => {
        FP.pause();
        FP.goToTime(2);
        expect(setView).to.have.been.called;
      });

      it('should not set the view if playing', () => {
        FP.goToTime(2);
        expect(setView).to.not.have.been.called;
      });
    });
  });

  describe('forward', () => {
    it('should set the time to the next closest vp', () => {
      FP.forward();
      expect(FP.clock.currentTime).to.equal(FP.clock.times[1]);
    });

    it('should set the last, if no time is found', () => {
      FP.clock.currentTime = FP.clock.times[4];
      FP.forward();
      expect(FP.clock.currentTime).to.equal(FP.clock.times[4]);
    });
  });

  describe('backward', () => {
    it('should find the previous time', () => {
      FP.clock.currentTime = 10;
      FP.backward();
      expect(FP.clock.currentTime).to.equal(0);
    });

    it('should set a timeout, skipping back one more index', () => {
      sandbox.useFakeTimers(10);
      FP.clock.currentTime = FP.clock.times[4];
      FP.backward();
      FP.backward();
      expect(FP.clock.currentTime).to.equal(FP.clock.times[1]);
    });

    it('should not skip back twice, if the timeout has passed', () => {
      const clock = sandbox.useFakeTimers(10);
      FP.clock.currentTime = FP.clock.times[4];
      FP.backward();
      clock.tick(800);
      FP.backward();
      expect(FP.clock.currentTime).to.equal(FP.clock.times[2]);
    });
  });
});
