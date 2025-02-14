import { parseNumber } from '@vcsuite/parsers';
import {
  Cartesian3,
  HeadingPitchRoll,
  Math as CesiumMath,
  Scene,
} from '@vcmap-cesium/engine';
import CesiumMap from '../cesiumMap.js';
import {
  lookTwoDof,
  moveFiveDOF,
  getScaledRotation,
  getScaledTranslation,
  getEnuVector,
} from './cameraHelper.js';
import NavigationImpl, { NavigationImplOptions } from './navigationImpl.js';
import { Movement } from './navigation.js';

const translationScratch = new Cartesian3();
const rotationScratch = new HeadingPitchRoll();

export type CesiumNavigationOptions = NavigationImplOptions & {
  /**
   * threshold to trigger a camera movement
   */
  moveThreshold?: number;
};

class CesiumNavigation extends NavigationImpl<CesiumMap> {
  static get className(): string {
    return 'CesiumNavigation';
  }

  static getDefaultOptions(): CesiumNavigationOptions {
    return {
      ...NavigationImpl.getDefaultOptions(),
      /**
       * defines the threshold for translation or rotation to trigger a camera movement
       */
      moveThreshold: CesiumMath.EPSILON2,
    };
  }

  moveThreshold: number;

  private readonly _scene: Scene | undefined;

  constructor(map: CesiumMap, options?: CesiumNavigationOptions) {
    const defaultOptions = CesiumNavigation.getDefaultOptions();
    super(map, { ...defaultOptions, ...options });

    this.moveThreshold = parseNumber(
      options?.moveThreshold,
      defaultOptions.moveThreshold,
    );

    this._scene = map.getScene();
  }

  update(movement: Movement): void {
    if (this._scene) {
      const geodeticUp = getEnuVector(this._scene);
      const thresholdSquared = this.moveThreshold * this.moveThreshold;
      const { forward, right, up, tiltDown, rollRight, turnRight } =
        movement.input;

      if (
        tiltDown * tiltDown + rollRight * rollRight + turnRight * turnRight >
        thresholdSquared
      ) {
        const rotation = getScaledRotation(
          this._scene,
          movement.input,
          this.baseRotSpeed,
          rotationScratch,
        );
        lookTwoDof(this._scene.camera, rotation, geodeticUp);
      }

      if (forward * forward + right * right + up * up > thresholdSquared) {
        const translation = getScaledTranslation(
          this._scene,
          movement.input,
          this.baseTranSpeed,
          translationScratch,
        );
        moveFiveDOF(this._scene.camera, translation, geodeticUp);
      }
    }
  }

  toJSON(): CesiumNavigationOptions {
    const defaultOptions = CesiumNavigation.getDefaultOptions();
    const config: CesiumNavigationOptions = super.toJSON();
    if (this.moveThreshold !== defaultOptions.moveThreshold) {
      config.moveThreshold = this.moveThreshold;
    }
    return config;
  }
}

export default CesiumNavigation;
