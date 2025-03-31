import type {
  Cartesian3,
  CatmullRomSpline,
  LinearSpline,
  QuaternionSpline,
  Scene,
} from '@vcmap-cesium/engine';
import { HeadingPitchRoll } from '@vcmap-cesium/engine';
import { getLogger } from '@vcsuite/logger';
import { check } from '@vcsuite/check';
import CesiumMap from '../../map/cesiumMap.js';
import { getSplineAndTimesForInstance } from './flightHelpers.js';
import FlightInstance from './flightInstance.js';
import VcsEvent from '../../vcsEvent.js';
import VcsApp from '../../vcsApp.js';

export type FlightPlayerClock = {
  readonly startTime: number;
  readonly endTime: number;
  readonly currentTime: number;
  readonly times: number[];
  currentSystemTime: undefined | number;
  readonly changed: VcsEvent<FlightPlayerClock>;
  setCurrentTime(this: FlightPlayerClock, time: number): number;
  reset(this: FlightPlayerClock): void;
  setTimes(this: FlightPlayerClock, times: number[]): void;
  destroy(this: FlightPlayerClock): void;
};

export type FlightPlayerState = 'playing' | 'paused' | 'stopped';

export type FlightPlayer = {
  readonly flightInstanceName: string;
  readonly clock: FlightPlayerClock;
  readonly state: FlightPlayerState;
  readonly stateChanged: VcsEvent<FlightPlayerState>;
  readonly destroyed: VcsEvent<void>;
  play(): void;
  stop(): void;
  pause(): void;
  /**
   * jumps to the given time
   * @param time time in seconds
   */
  goToTime(time: number): void;
  forward(): void;
  backward(): void;
  destroy(): void;
};

function createFlightPlayerClock(): FlightPlayerClock {
  let currentTime = 0;
  let startTime = 0;
  let endTime = 0;
  let times: number[] = [];

  return {
    get startTime(): number {
      return startTime;
    },
    get endTime(): number {
      return endTime;
    },
    get currentTime(): number {
      return currentTime;
    },
    get times(): number[] {
      return times;
    },
    currentSystemTime: undefined,
    changed: new VcsEvent<FlightPlayerClock>(),
    setCurrentTime(time: number): number {
      currentTime = time;
      this.changed.raiseEvent(this);
      return this.currentTime;
    },
    reset(): void {
      currentTime = 0;
      startTime = 0;
      endTime = 0;
      times = [];
      this.changed.raiseEvent(this);
    },
    setTimes(newTimes: number[]): void {
      times = newTimes.slice();
      endTime = times[times.length - 1];
      this.changed.raiseEvent(this);
    },
    destroy(): void {
      this.changed.destroy();
    },
  };
}

export async function createFlightPlayer(
  instance: FlightInstance,
  app: VcsApp,
): Promise<FlightPlayer> {
  check(instance, FlightInstance);
  check(app, VcsApp);

  let cesiumMap: CesiumMap =
    app.maps.activeMap instanceof CesiumMap
      ? app.maps.activeMap
      : (app.maps.getByType(CesiumMap.className)[0] as CesiumMap);
  if (!cesiumMap) {
    throw new Error('Cannot start a flight player without a cesium map');
  }
  await instance.initialize();

  const clock: FlightPlayerClock = createFlightPlayerClock();

  let playerState: FlightPlayerState = 'stopped';

  const stateChanged = new VcsEvent<FlightPlayerState>();

  const setState = (state: FlightPlayerState): void => {
    playerState = state;
    stateChanged.raiseEvent(playerState);
  };

  let destinationSpline: CatmullRomSpline | LinearSpline | undefined;

  let quaternionSpline: QuaternionSpline | undefined;

  let postRenderListener: (() => void) | undefined;

  let resetMapControls: (() => void) | undefined;

  let backedBeforeTimeout: number | undefined;

  const stop = (): void => {
    if (playerState !== 'stopped') {
      if (postRenderListener) {
        postRenderListener();
        postRenderListener = undefined;
      }

      if (resetMapControls) {
        resetMapControls();
        resetMapControls = undefined;
      }

      setState('stopped');

      clock.currentSystemTime = undefined;
      clock.setCurrentTime(0);
    }
  };

  const updateSplines = (): void => {
    if (!instance.isValid()) {
      stop();
      clock.reset();
    } else {
      const splines = getSplineAndTimesForInstance(instance);

      ({ destinationSpline, quaternionSpline } = splines);
      const { times } = splines;
      clock.setTimes(times);
    }
  };
  updateSplines();

  const listeners = [
    instance.anchorsChanged.addEventListener(updateSplines),
    instance.propertyChanged.addEventListener((property) => {
      if (property === 'interpolation' || property === 'loop') {
        updateSplines();
      }
    }),
    app.maps.mapActivated.addEventListener(() => {
      stop();
      if (app.maps.activeMap instanceof CesiumMap) {
        cesiumMap = app.maps.activeMap;
      }
    }),
  ];

  const getView = (
    time: number,
  ):
    | {
        destination: Cartesian3;
        orientation: HeadingPitchRoll;
      }
    | undefined => {
    if (destinationSpline && quaternionSpline) {
      return {
        destination: destinationSpline.evaluate(time) as Cartesian3,
        orientation: HeadingPitchRoll.fromQuaternion(
          quaternionSpline.evaluate(time),
        ),
      };
    } else {
      getLogger('FlightPlayer').error('cannot evaluate spline');
    }
    return undefined;
  };

  const cesiumPostRender = (scene: Scene): void => {
    const time = Date.now() / 1000;
    if (!clock.currentSystemTime) {
      clock.currentSystemTime = time;
    }
    const seconds = time - clock.currentSystemTime;
    clock.currentSystemTime = time;
    if (playerState === 'paused') {
      if (resetMapControls) {
        resetMapControls();
        resetMapControls = undefined;
      }
      return;
    }

    clock.setCurrentTime(clock.currentTime + seconds * instance.multiplier);
    if (clock.currentTime > clock.endTime) {
      if (instance.loop && clock.endTime > 0) {
        while (clock.currentTime > clock.endTime) {
          clock.setCurrentTime(clock.currentTime - clock.endTime);
        }
      } else {
        stop();
      }
    } else if (clock.currentTime < clock.startTime) {
      if (instance.loop) {
        clock.setCurrentTime(clock.endTime + clock.currentTime);
      } else {
        clock.setCurrentTime(clock.startTime);
        return;
      }
    }

    const view = getView(clock.currentTime);
    if (view) {
      scene.camera.setView(view);
    }

    if (playerState === 'playing' && !resetMapControls) {
      resetMapControls = app.maps.requestExclusiveMapControls(
        { apiCalls: true, keyEvents: true, pointerEvents: true },
        stop,
      );
    }
  };

  const play = (): void => {
    if (!instance.isValid()) {
      getLogger('FlightPlayer').error(
        `cannot play invalid flight ${instance.name}`,
      );
      return;
    }
    if (playerState === 'playing') {
      return;
    }
    if (!(app.maps.activeMap instanceof CesiumMap)) {
      getLogger('FlightPlayer').warning(
        'cannot play without a cesium map active',
      );
      return;
    }
    if (playerState === 'paused') {
      setState('playing');
      return;
    }
    if (postRenderListener) {
      postRenderListener();
      postRenderListener = undefined;
    }

    if (resetMapControls) {
      resetMapControls();
      resetMapControls = undefined;
    }

    const scene = cesiumMap.getScene();
    if (!scene) {
      return;
    }
    postRenderListener = scene.postRender.addEventListener(cesiumPostRender);
    clock.currentSystemTime = undefined;

    setState('playing');
  };

  const goToTime = (time: number): void => {
    if (!instance.isValid()) {
      getLogger('FlightPlayer').error(
        `cannot goToTime of invalid flight ${instance.name}`,
      );
      return;
    }
    if (time > clock.endTime) {
      getLogger('FlightPlayer').warning(`time: ${time} out of range`);
      return;
    }
    clock.currentSystemTime = undefined;
    clock.setCurrentTime(time);
    if (playerState !== 'playing') {
      const view = getView(clock.currentTime);
      if (view) {
        cesiumMap.getScene()?.camera.setView(view);
      }
    }
  };
  const destroyed = new VcsEvent<void>();
  const destroy = (): void => {
    if (postRenderListener) {
      postRenderListener();
      postRenderListener = undefined;
    }

    if (resetMapControls) {
      resetMapControls();
      resetMapControls = undefined;
    }

    if (backedBeforeTimeout != null) {
      clearTimeout(backedBeforeTimeout);
    }

    listeners.forEach((cb) => {
      cb();
    });
    clock.destroy();
    stateChanged.destroy();
    destroyed.raiseEvent();
    destroyed.destroy();
  };

  listeners.push(
    app.flights.removed.addEventListener((flight) => {
      if (flight === instance) {
        destroy();
      }
    }),
    app.flights.added.addEventListener((flight) => {
      if (flight.name === instance.name) {
        destroy();
      }
    }),
  );

  return {
    get flightInstanceName(): string {
      return instance.name;
    },
    get clock(): FlightPlayerClock {
      return clock;
    },
    get state(): FlightPlayerState {
      return playerState;
    },
    get stateChanged(): VcsEvent<FlightPlayerState> {
      return stateChanged;
    },
    get destroyed(): VcsEvent<void> {
      return destroyed;
    },
    play,
    stop,
    pause(): void {
      if (playerState === 'playing') {
        setState('paused');
      }
    },
    goToTime,
    /**
     * forwards the currentTime to the next anchor
     */
    forward(): void {
      const seconds = clock.currentTime;
      const newTime =
        clock.times.find((t) => t > seconds) ||
        clock.times[clock.times.length - 1];
      goToTime(newTime);
    },
    /**
     * resets the currentTime to the previous anchor
     */
    backward(): void {
      const seconds = clock.currentTime;
      let index = clock.times.findIndex((t) => t >= seconds) - 1;
      if (backedBeforeTimeout != null) {
        index -= 1;
        clearTimeout(backedBeforeTimeout);
      }
      if (index < 0) {
        index = 0;
      }
      const newTime = clock.times[index];
      goToTime(newTime);
      backedBeforeTimeout = window.setTimeout(() => {
        backedBeforeTimeout = undefined;
      }, 700);
    },
    destroy,
  };
}
