import { getLogger } from '@vcsuite/logger';
import VcsMap from '../vcsMap.js';
import CesiumMap from '../cesiumMap.js';
import OpenlayersMap from '../openlayersMap.js';
import ObliqueMap from '../obliqueMap.js';
import VcsEvent from '../../vcsEvent.js';
import NavigationImpl from './navigationImpl.js';
import Controller from './controller/controller.js';
import CesiumNavigation from './cesiumNavigation.js';
import OpenlayersNavigation from './openlayersNavigation.js';
import ObliqueNavigation from './obliqueNavigation.js';
import { createEasing, type NavigationEasing } from './easingHelper.js';
import {
  ControllerInput,
  getZeroInput,
  isNonZeroInput,
  inputEquals,
} from './controller/controllerInput.js';

export type Movement = {
  time: number;
  duration: number;
  input: ControllerInput;
};

export function getZeroMovement(): Movement {
  return {
    time: 0,
    duration: 0,
    input: getZeroInput(),
  };
}

export function isNonZeroMovement(movement: Movement): boolean {
  return isNonZeroInput(movement.input);
}

function getDefaultNavigationImplForMap(
  map: VcsMap,
): NavigationImpl<VcsMap> | undefined {
  if (map instanceof CesiumMap) {
    return new CesiumNavigation(map);
  } else if (map instanceof OpenlayersMap) {
    return new OpenlayersNavigation(map);
  } else if (map instanceof ObliqueMap) {
    return new ObliqueNavigation(map);
  }
  return undefined;
}

/**
 * Manages the active navigation and the controllers.
 */
class Navigation {
  private _defaultNavigationImpls: Map<
    VcsMap,
    NavigationImpl<VcsMap> | undefined
  > = new Map();

  private _customNavigationImpls: Map<
    VcsMap,
    { impl: NavigationImpl<VcsMap>; cb: () => void }
  > = new Map();

  private _currentNavigation: NavigationImpl<VcsMap> | undefined = undefined;

  public currentNavigationChanged: VcsEvent<
    NavigationImpl<VcsMap> | undefined
  > = new VcsEvent();

  private _controller: Map<string, Controller> = new Map();

  private _movement: Movement = getZeroMovement();

  private _easing: NavigationEasing | undefined;

  easingDuration = 1000;

  private _animationFrameId: number | undefined = undefined;

  private _activeMap: VcsMap | undefined = undefined;

  get currentNavigation(): NavigationImpl<VcsMap> | undefined {
    return this._currentNavigation;
  }

  get movement(): Movement {
    return this._movement;
  }

  private _startInputLoop(): void {
    if (!this._animationFrameId) {
      const loop = (time: number): void => {
        let currentInput = getZeroInput();
        for (const controller of this.getControllers()) {
          const controllerInput = controller.getInputs();
          if (controllerInput !== null) {
            currentInput = controllerInput;
            break;
          }
        }
        this.applyInput(time, currentInput);
        this.updateNavigation();
        this._animationFrameId = requestAnimationFrame(loop);
      };
      loop(performance.now());
    }
  }

  private _stopInputLoop(): void {
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = undefined;
    }
  }

  getNavigationImplForMap(map: VcsMap): NavigationImpl<VcsMap> | undefined {
    if (this._customNavigationImpls.has(map)) {
      return this._customNavigationImpls.get(map)!.impl;
    }
    if (!this._defaultNavigationImpls.has(map)) {
      this._defaultNavigationImpls.set(
        map,
        getDefaultNavigationImplForMap(map),
      );
    }
    return this._defaultNavigationImpls.get(map);
  }

  /**
   * Allows to override the default navigation behaviour for a map by providing a custom NavigationImpl
   * Provided callback is called, when the custom NavigationImpl is forcefully removed.
   * Returns a function, which you can call to remove the custom navigation.
   * @param map
   * @param impl
   * @param cb
   */
  setNavigationImplForMap<M extends VcsMap>(
    map: M,
    impl: NavigationImpl<M>,
    cb: () => void,
  ): () => void {
    if (this._customNavigationImpls.has(map)) {
      this._customNavigationImpls.get(map)!.cb();
    }

    this._customNavigationImpls.set(map, { impl, cb });
    if (map.active) {
      this._currentNavigation = impl;
      this.currentNavigationChanged.raiseEvent(impl);
    }

    return (): void => {
      if (this._customNavigationImpls.get(map)?.impl === impl) {
        this.resetNavigationImplForMap(map);
      }
    };
  }

  /**
   * Removes custom implementations and resets the original default NavigationImpl for the map
   * @param map
   */
  resetNavigationImplForMap<M extends VcsMap>(map: M): void {
    if (this._customNavigationImpls.has(map)) {
      const { cb } = this._customNavigationImpls.get(map)!;
      cb();
      this._customNavigationImpls.delete(map);
      if (map.active) {
        const activeImpl = this.getNavigationImplForMap(map);
        this._currentNavigation = activeImpl;
        this.currentNavigationChanged.raiseEvent(activeImpl);
      }
    }
  }

  mapActivated(map: VcsMap): void {
    const impl = this.getNavigationImplForMap(map);
    if (impl) {
      this._currentNavigation = impl;
      this.currentNavigationChanged.raiseEvent(impl);
    }
    this._activeMap = map;
  }

  addController(controller: Controller): void {
    if (this._controller.has(controller.id)) {
      getLogger().warning(`Controller with id ${controller.id} already exists`);
    } else {
      this._controller.set(controller.id, controller);
      this._startInputLoop();
    }
  }

  removeController(controllerId: string): void {
    const controller = this._controller.get(controllerId);
    if (controller) {
      this._controller.delete(controllerId);
      if (this._controller.size < 1) {
        this._stopInputLoop();
      }
    }
  }

  getController(id: string): Controller | undefined {
    return this._controller.get(id);
  }

  getControllers(): Controller[] {
    return [...this._controller.values()];
  }

  /**
   * Derives movement from controller input and applies it using an easing function.
   * If input changes, a new easing will be created to adjust the movement over the easing duration until the target input movement is reached.
   * If a previous easing exists, the target will be updated and eased to for the rest of the easing duration.
   * If no or zero input is applied, the movement is gradually reduced over the easing duration.
   * @param time
   * @param input
   */
  applyInput(time: number, input?: ControllerInput): void {
    if (!inputEquals(input, this._movement.input)) {
      if (!this._easing) {
        this._easing = createEasing(
          time,
          this.easingDuration,
          this._movement.input,
          input,
        );
      } else if (!inputEquals(input, this._easing.target)) {
        this._easing = createEasing(
          this._easing.startTime,
          this.easingDuration,
          this._movement.input,
          input,
        );
      }
    }
    if (this._easing) {
      const { movement, finished } = this._easing.getMovementAtTime(time);
      this._movement = movement;
      if (finished) {
        this._easing = undefined;
      }
    }
  }

  updateNavigation(): void {
    if (
      !this._activeMap?.movementKeyEventsDisabled &&
      this._currentNavigation &&
      isNonZeroMovement(this.movement)
    ) {
      this._currentNavigation.update(this._movement);
    }
  }

  destroy(): void {
    this._stopInputLoop();
    this._controller.forEach((c) => c.destroy());
    this._controller.clear();
    this._customNavigationImpls.forEach(({ cb }) => cb());
    this._customNavigationImpls.clear();
    this._defaultNavigationImpls.clear();
    this._currentNavigation = undefined;
  }
}

export default Navigation;
