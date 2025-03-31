import { Math as CesiumMath } from '@vcmap-cesium/engine';
import { v4 as uuidv4 } from 'uuid';
import type { ControllerInput } from './controllerInput.js';
import { checkThreshold, multiplyComponents } from './controllerInput.js';

export type ControllerOptions = {
  id: string;
  scales?: ControllerInput;
  inputThreshold?: number;
};

class Controller {
  static get className(): string {
    return 'Controller';
  }

  static getDefaultOptions(): ControllerOptions {
    return {
      id: '',
      scales: undefined,
      inputThreshold: CesiumMath.EPSILON1,
    };
  }

  readonly id: string;

  scales?: ControllerInput;

  inputThreshold: number;

  constructor(options: ControllerOptions) {
    const defaultOptions = Controller.getDefaultOptions();

    this.id = options.id || uuidv4();
    this.scales = options.scales || defaultOptions.scales;
    this.inputThreshold =
      options.inputThreshold || defaultOptions.inputThreshold!;
  }

  // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-unused-vars
  setMapTarget(_target: HTMLElement | null): void {}

  // eslint-disable-next-line class-methods-use-this
  getControllerInput(): ControllerInput | null {
    return null;
  }

  getInputs(): ControllerInput | null {
    const input = this.getControllerInput();
    if (input) {
      if (checkThreshold(input, this.inputThreshold)) {
        return this.scales
          ? multiplyComponents(input, this.scales, input)
          : input;
      }
    }
    return null;
  }

  toJSON(): ControllerOptions {
    const defaultOptions = Controller.getDefaultOptions();
    const config: ControllerOptions = {
      id: this.id,
    };
    if (this.scales) {
      config.scales = this.scales;
    }
    if (defaultOptions.inputThreshold !== this.inputThreshold) {
      config.inputThreshold = this.inputThreshold;
    }
    return config;
  }

  // eslint-disable-next-line class-methods-use-this
  destroy(): void {}
}

export default Controller;
