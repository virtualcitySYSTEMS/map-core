import {
  Cesium3DTilesVoxelProvider,
  VoxelPrimitive,
  type CustomShader,
  type Matrix4,
} from '@vcmap-cesium/engine';
import LayerImplementation from '../layerImplementation.js';
import { allowPicking, vcsLayerName } from '../layerSymbols.js';
import { getResourceOrUrl } from './resourceHelper.js';
import type BaseCesiumMap from '../../map/baseCesiumMap.js';
import type { VoxelLayerImplementationOptions } from '../voxelLayer.js';

/**
 * Cesium implementation for {@link VoxelLayer}.
 */
class VoxelCesiumImpl extends LayerImplementation<BaseCesiumMap> {
  static get className(): string {
    return 'VoxelCesiumImpl';
  }

  readonly modelMatrix: Matrix4 | undefined;

  readonly allowPicking: boolean;

  screenSpaceError: number;

  private _customShader: CustomShader | undefined;

  voxelPrimitive: VoxelPrimitive | undefined;

  private _initializedPromise: Promise<void> | undefined;

  constructor(map: BaseCesiumMap, options: VoxelLayerImplementationOptions) {
    super(map, options);

    this.modelMatrix = options.modelMatrix;
    this.allowPicking = options.allowPicking;
    this.screenSpaceError = options.screenSpaceError;
    this._customShader = options.customShader;
  }

  get customShader(): CustomShader | undefined {
    return this._customShader;
  }

  async initialize(): Promise<void> {
    if (!this._initializedPromise) {
      this._initializedPromise = (async (): Promise<void> => {
        const provider = await Cesium3DTilesVoxelProvider.fromUrl(
          getResourceOrUrl(this.url!, this.headers),
        );
        const voxelPrimitive = new VoxelPrimitive({
          provider,
          modelMatrix: this.modelMatrix,
          customShader: this._customShader,
        });
        voxelPrimitive.screenSpaceError = this.screenSpaceError;
        voxelPrimitive.show = false;

        if (this.isDestroyed) {
          voxelPrimitive.destroy();
          return;
        }

        voxelPrimitive[vcsLayerName] = this.name;
        voxelPrimitive[allowPicking] = this.allowPicking;
        this.voxelPrimitive = voxelPrimitive;
        this.map.addPrimitiveCollection(voxelPrimitive);
        await super.initialize();
      })();
    }

    await this._initializedPromise;
  }

  updateCustomShader(shader?: CustomShader): void {
    this._customShader = shader;
    if (this.voxelPrimitive) {
      this.voxelPrimitive.customShader = shader as CustomShader;
    }
  }

  updateScreenSpaceError(value: number): void {
    this.screenSpaceError = value;
    if (this.voxelPrimitive) {
      this.voxelPrimitive.screenSpaceError = value;
    }
  }

  async activate(): Promise<void> {
    if (this.voxelPrimitive) {
      this.voxelPrimitive.disableUpdate = false;
    }
    await super.activate();
    if (this.active && this.voxelPrimitive) {
      this.voxelPrimitive.show = true;
    }
  }

  deactivate(): void {
    super.deactivate();
    if (this.voxelPrimitive) {
      this.voxelPrimitive.show = false;
      this.voxelPrimitive.disableUpdate = true;
    }
  }

  destroy(): void {
    if (this.voxelPrimitive) {
      if (this.map.initialized) {
        const toRemove = this.voxelPrimitive;
        this.map.removePrimitiveCollection(toRemove);
      } else {
        this.voxelPrimitive.destroy();
      }
      this.voxelPrimitive = undefined;
    }

    super.destroy();
  }
}

export default VoxelCesiumImpl;
