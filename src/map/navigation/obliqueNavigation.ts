import { getLogger } from '@vcsuite/logger';
import { parseNumber } from '@vcsuite/parsers';
import type ObliqueMap from '../obliqueMap.js';
import type { Movement } from './navigation.js';
import type { NavigationImplOptions } from './navigationImpl.js';
import NavigationImpl from './navigationImpl.js';
import { moveView } from './viewHelper.js';

export type ObliqueNavigationOptions = NavigationImplOptions & {
  rotatingThreshold?: number;
  rotatingTimeout?: number;
};

class ObliqueNavigation extends NavigationImpl<ObliqueMap> {
  static get className(): string {
    return 'ObliqueNavigation';
  }

  static getDefaultOptions(): ObliqueNavigationOptions {
    return {
      ...NavigationImpl.getDefaultOptions(),
      /**
       * threshold for a rotation input to trigger a change in image direction
       */
      rotatingThreshold: 0.25,
      /**
       * timeout in ms to wait until next rotation
       */
      rotatingTimeout: 1000,
    };
  }

  rotatingThreshold: number;

  rotatingTimeout: number;

  /**
   * flag preventing continuous rotation causing undesired change in image direction
   * @private
   */
  private _rotating: boolean;

  constructor(map: ObliqueMap, options?: ObliqueNavigationOptions) {
    const defaultOptions = ObliqueNavigation.getDefaultOptions();
    super(map, { ...defaultOptions, ...options });

    this.rotatingThreshold = parseNumber(
      options?.rotatingThreshold,
      defaultOptions.rotatingThreshold,
    );
    this.rotatingTimeout = parseNumber(
      options?.rotatingTimeout,
      defaultOptions.rotatingTimeout,
    );
    this._rotating = false;
  }

  update(movement: Movement): void {
    moveView(this._map, movement.input, this.baseTranSpeed);
    if (Math.abs(movement.input.turnRight) > this.rotatingThreshold) {
      this._rotate(Math.sign(movement.input.turnRight)).catch((e: unknown) => {
        getLogger('ObliqueNavigation').error(String(e));
      });
    }
  }

  /**
   * Rotate by 90 degrees clockwise or counterclockwise.
   * @param sign
   */
  protected async _rotate(sign: number): Promise<void> {
    if (!this._rotating) {
      this._rotating = true;
      const viewpoint = await this._map.getViewpoint();
      if (viewpoint) {
        let heading = viewpoint.heading + sign * 90;
        if (heading > 360) {
          heading -= 360;
        } else if (heading < 0) {
          heading += 360;
        }
        viewpoint.heading = heading;
        await this._map.gotoViewpoint(viewpoint);
        // delay to prevent multiple rotations per input
        setTimeout(() => {
          this._rotating = false;
        }, this.rotatingTimeout);
      }
    }
  }

  toJSON(): ObliqueNavigationOptions {
    const config: ObliqueNavigationOptions = super.toJSON();
    const defaultOptions = ObliqueNavigation.getDefaultOptions();
    if (this.rotatingThreshold !== defaultOptions.rotatingThreshold) {
      config.rotatingThreshold = this.rotatingThreshold;
    }
    if (this.rotatingTimeout !== defaultOptions.rotatingTimeout) {
      config.rotatingTimeout = this.rotatingTimeout;
    }
    return config;
  }
}

export default ObliqueNavigation;
