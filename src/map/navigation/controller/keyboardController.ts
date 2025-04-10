import type { ControllerOptions } from './controller.js';
import Controller from './controller.js';
import type { ControllerInput } from './controllerInput.js';
import { getZeroInput, clearInput } from './controllerInput.js';

export enum DIRECTIONS {
  FORWARD = 0,
  BACKWARD = 1,
  LEFT = 2,
  RIGHT = 3,
  UP = 4,
  DOWN = 5,
  TILT_UP = 6,
  TILT_DOWN = 7,
  ROLL_RIGHT = 8,
  ROLL_LEFT = 9,
  TURN_LEFT = 10,
  TURN_RIGHT = 11,
}

export type KeyboardControllerOptions = ControllerOptions & {
  target: HTMLElement | null;
  keys?: Array<{
    key: string;
    direction: DIRECTIONS;
  }>;
};

class KeyboardController extends Controller {
  static get className(): string {
    return 'KeyboardController';
  }

  static getDefaultOptions(): KeyboardControllerOptions {
    return {
      ...Controller.getDefaultOptions(),
      scales: {
        forward: 1,
        right: 1,
        up: 1,
        tiltDown: 0.3,
        rollRight: 0.5,
        turnRight: 1,
      },
      inputThreshold: 0,
      target: null,
      keys: [
        { key: 'ArrowUp', direction: DIRECTIONS.FORWARD },
        { key: 'ArrowDown', direction: DIRECTIONS.BACKWARD },
        { key: 'ArrowLeft', direction: DIRECTIONS.LEFT },
        { key: 'ArrowRight', direction: DIRECTIONS.RIGHT },
        { key: 'x', direction: DIRECTIONS.UP },
        { key: 'y', direction: DIRECTIONS.DOWN },
        { key: 's', direction: DIRECTIONS.TILT_UP },
        { key: 'w', direction: DIRECTIONS.TILT_DOWN },
        { key: 'q', direction: DIRECTIONS.ROLL_LEFT },
        { key: 'e', direction: DIRECTIONS.ROLL_RIGHT },
        { key: 'a', direction: DIRECTIONS.TURN_LEFT },
        { key: 'd', direction: DIRECTIONS.TURN_RIGHT },
      ],
    };
  }

  private _target: HTMLElement | null;

  private _input: ControllerInput = getZeroInput();

  private readonly _keys: Map<string, DIRECTIONS>;

  private _keyState = new Map<DIRECTIONS, boolean>();

  // eslint-disable-next-line class-methods-use-this
  private _removeKeyListeners: () => void = () => {};

  // eslint-disable-next-line class-methods-use-this
  private _removeFocusListener: () => void = () => {};

  constructor(options: KeyboardControllerOptions) {
    const defaultOptions = KeyboardController.getDefaultOptions();
    super({ ...defaultOptions, ...options });

    this._target = options.target || defaultOptions.target;

    this._keys = new Map(
      (options.keys || defaultOptions.keys)!.map(({ key, direction }) => [
        key,
        direction,
      ]),
    );

    this._setupFocusListener();
  }

  private _setupFocusListener(): void {
    this._removeFocusListener();
    this._removeFocusListener = (): void => {};
    if (this._target) {
      if (!this._target.hasAttribute('tabindex')) {
        this._target.setAttribute('tabindex', '0');
      }

      const clicked = (): void => this._target?.focus();
      const focusin = (): void => {
        this._setupKeyListener();
      };
      const focusout = (): void => {
        this._removeKeyListeners();
        this._removeKeyListeners = (): void => {};
      };

      this._target.addEventListener('click', clicked);
      this._target.addEventListener('focusin', focusin);
      this._target.addEventListener('focusout', focusout);

      this._removeFocusListener = (): void => {
        this._target?.removeEventListener('click', clicked);
        this._target?.removeEventListener('focusin', focusin);
        this._target?.removeEventListener('focusout', focusout);
      };
    }
  }

  private _setupKeyListener(): void {
    if (this._target) {
      const keyDown = (event: KeyboardEvent): void => {
        const direction = this._keys.get(event.key);
        if (direction !== undefined) {
          this._keyState.set(direction, true);
        }
      };
      const keyUp = (event: KeyboardEvent): void => {
        const direction = this._keys.get(event.key);
        if (direction !== undefined) {
          this._keyState.set(direction, false);
        }
      };

      this._target.addEventListener('keydown', keyDown);
      this._target.addEventListener('keyup', keyUp);

      this._removeKeyListeners = (): void => {
        this._target?.removeEventListener('keydown', keyDown);
        this._target?.removeEventListener('keyup', keyUp);
      };
    }
  }

  setMapTarget(target: HTMLElement | null): void {
    this._target = target;
    this._setupFocusListener();
  }

  getControllerInput(): ControllerInput | null {
    clearInput(this._input);
    if (this._keyState.get(DIRECTIONS.FORWARD)) {
      this._input.forward = 1;
    }
    if (this._keyState.get(DIRECTIONS.BACKWARD)) {
      this._input.forward = -1;
    }
    if (this._keyState.get(DIRECTIONS.RIGHT)) {
      this._input.right = 1;
    }
    if (this._keyState.get(DIRECTIONS.LEFT)) {
      this._input.right = -1;
    }
    if (this._keyState.get(DIRECTIONS.UP)) {
      this._input.up = 1;
    }
    if (this._keyState.get(DIRECTIONS.DOWN)) {
      this._input.up = -1;
    }

    if (this._keyState.get(DIRECTIONS.TILT_DOWN)) {
      this._input.tiltDown = 1;
    }
    if (this._keyState.get(DIRECTIONS.TILT_UP)) {
      this._input.tiltDown = -1;
    }
    if (this._keyState.get(DIRECTIONS.ROLL_RIGHT)) {
      this._input.rollRight = 1;
    }
    if (this._keyState.get(DIRECTIONS.ROLL_LEFT)) {
      this._input.rollRight = -1;
    }
    if (this._keyState.get(DIRECTIONS.TURN_RIGHT)) {
      this._input.turnRight = 1;
    }
    if (this._keyState.get(DIRECTIONS.TURN_LEFT)) {
      this._input.turnRight = -1;
    }

    return this._input;
  }

  destroy(): void {
    this._keyState.clear();
    this._removeKeyListeners();
    this._removeFocusListener();
    super.destroy();
  }
}

export default KeyboardController;
