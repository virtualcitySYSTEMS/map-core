import type { CustomShader, Matrix4 } from '@vcmap-cesium/engine';
import { parseInteger } from '@vcsuite/parsers';
import type { LayerImplementationOptions, LayerOptions } from './layer.js';
import Layer from './layer.js';
import CesiumMap from '../map/cesiumMap.js';
import PanoramaMap from '../map/panoramaMap.js';
import BaseCesiumMap from '../map/baseCesiumMap.js';
import type VcsMap from '../map/vcsMap.js';
import VoxelCesiumImpl from './cesium/voxelCesiumImpl.js';
import { layerClassRegistry } from '../classRegistry.js';
import Extent from '../util/extent.js';
import { mercatorProjection } from '../util/projection.js';
import { getExtentFromBoundingSphere } from '../util/geometryHelpers.js';

export type VoxelLayerOptions = LayerOptions & {
  screenSpaceError?: number;
  modelMatrix?: Matrix4;
  customShader?: CustomShader;
};

export type VoxelLayerImplementationOptions = LayerImplementationOptions & {
  allowPicking: boolean;
  screenSpaceError: number;
  modelMatrix?: Matrix4;
  customShader?: CustomShader;
};

/**
 * A Cesium layer for voxel data served as a 3D Tiles voxel tileset.
 * @description This is a beta feature. The API and behavior may change in future releases without prior notice.
 * @group Layer
 */
class VoxelLayer extends Layer<VoxelCesiumImpl> {
  static get className(): string {
    return 'VoxelLayer';
  }

  static getDefaultOptions(): VoxelLayerOptions {
    return {
      ...Layer.getDefaultOptions(),
      ignoreMapLayerTypes: true,
      screenSpaceError: 16,
      modelMatrix: undefined,
      customShader: undefined,
    };
  }

  protected _supportedMaps = [CesiumMap.className, PanoramaMap.className];

  readonly modelMatrix: Matrix4 | undefined;

  private _screenSpaceError: number;

  private _customShader: CustomShader | undefined;

  constructor(options: VoxelLayerOptions) {
    const defaultOptions = VoxelLayer.getDefaultOptions();
    super({ ...defaultOptions, ...options });

    this.modelMatrix = options.modelMatrix;
    this._screenSpaceError = parseInteger(
      options.screenSpaceError,
      defaultOptions.screenSpaceError,
    );
    this._customShader = options.customShader;
  }

  get customShader(): CustomShader | undefined {
    return this._customShader;
  }

  set customShader(shader: CustomShader | undefined) {
    if (this._customShader !== shader) {
      this._customShader = shader;
      this.getImplementations().forEach((impl) => {
        impl.updateCustomShader(shader);
      });
    }
  }

  get screenSpaceError(): number {
    return this._screenSpaceError;
  }

  set screenSpaceError(value: number) {
    if (this._screenSpaceError !== value) {
      this._screenSpaceError = value;
      this.getImplementations().forEach((impl) => {
        impl.updateScreenSpaceError(value);
      });
    }
  }

  getImplementationOptions(): VoxelLayerImplementationOptions {
    return {
      ...super.getImplementationOptions(),
      allowPicking: this.allowPicking,
      screenSpaceError: this.screenSpaceError,
      modelMatrix: this.modelMatrix,
      customShader: this.customShader,
    };
  }

  createImplementationsForMap(map: VcsMap): VoxelCesiumImpl[] {
    if (map instanceof BaseCesiumMap) {
      return [new VoxelCesiumImpl(map, this.getImplementationOptions())];
    }
    return [];
  }

  /**
   * Sets the screen space error of this layer.
   */
  setScreenSpaceError(value: number): void {
    this.screenSpaceError = value;
  }

  /**
   * Returns the configured extent or derives one from the loaded voxel primitive.
   */
  getZoomToExtent(): Extent | null {
    const metaExtent = super.getZoomToExtent();
    if (metaExtent) {
      return metaExtent;
    }

    const voxelPrimitive = this.getImplementations()[0]?.voxelPrimitive;
    if (voxelPrimitive) {
      const actualExtent = new Extent({
        projection: mercatorProjection.toJSON(),
        coordinates: getExtentFromBoundingSphere(voxelPrimitive.boundingSphere),
      });
      if (actualExtent.isValid()) {
        return actualExtent;
      }
    }

    return null;
  }

  toJSON(defaultOptions = VoxelLayer.getDefaultOptions()): VoxelLayerOptions {
    const config: VoxelLayerOptions = super.toJSON(defaultOptions);
    if (this.screenSpaceError !== defaultOptions.screenSpaceError) {
      config.screenSpaceError = this.screenSpaceError;
    }
    return config;
  }
}

layerClassRegistry.registerClass(VoxelLayer.className, VoxelLayer);
export default VoxelLayer;
