import type VcsMap from '../vcsMap.js';
import type { Movement } from './navigation.js';

export type NavigationImplOptions = {
  /**
   * base translation speed in m/s
   */
  baseTranSpeed?: number;
  /**
   * base rotation speed in rad/s
   */
  baseRotSpeed?: number;
};

class NavigationImpl<M extends VcsMap> {
  static get className(): string {
    return 'NavigationImpl';
  }

  static getDefaultOptions(): NavigationImplOptions {
    return {
      baseTranSpeed: 0.02, // 20 m/s
      baseRotSpeed: 0.02, // 20 rad/s
    };
  }

  protected _map: M;

  /**
   * base translation speed in m/s
   */
  baseTranSpeed: number;

  /**
   * base rotation speed in rad/s
   */
  baseRotSpeed: number;

  constructor(map: M, options?: NavigationImplOptions) {
    const defaultOptions = NavigationImpl.getDefaultOptions();
    this._map = map;
    this.baseTranSpeed =
      options?.baseTranSpeed || defaultOptions.baseTranSpeed!;
    this.baseRotSpeed = options?.baseRotSpeed || defaultOptions.baseRotSpeed!;
  }

  /**
   * Update the camera movement and rotation with easing applied.
   */
  // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-unused-vars
  update(_movement: Movement): void {}

  toJSON(): NavigationImplOptions {
    const defaultOptions = NavigationImpl.getDefaultOptions();
    const config: NavigationImplOptions = {};
    if (this.baseTranSpeed !== defaultOptions.baseTranSpeed) {
      config.baseTranSpeed = this.baseTranSpeed;
    }
    if (this.baseRotSpeed !== defaultOptions.baseRotSpeed) {
      config.baseRotSpeed = this.baseRotSpeed;
    }
    return config;
  }
}

export default NavigationImpl;
