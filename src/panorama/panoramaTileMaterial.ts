import type {
  TextureMinificationFilter,
  Context,
  TextureMagnificationFilter,
} from '@vcmap-cesium/engine';
import {
  Material,
  Cartesian2,
  Cartesian3,
  Color,
  Texture,
  Sampler,
  PixelDatatype,
  PixelFormat,
} from '@vcmap-cesium/engine';
import {
  getNumberOfTiles,
  type TileCoordinate,
  type TileSize,
} from './panoramaTileCoordinate.js';
import source from './panoramaTileMaterialFS.shader.js';
import type {
  PanoramaResourceData,
  PanoramaResourceType,
} from './panoramaTileProvider.js';

/**
 * The overlay mode for panorama tiles.
 */
export enum PanoramaOverlayMode {
  None = 0,
  Intensity = 1,
  Depth = 2,
}

export type PanoramaTileMaterialUniforms = {
  u_rgb: HTMLCanvasElement | string;
  u_intensity: HTMLCanvasElement | string;
  u_depth: Texture | string;
  u_debug: HTMLCanvasElement | string;
  u_cursorPosition: Cartesian3;
  u_minUV: Cartesian2;
  u_maxUV: Cartesian2;
  u_opacity: number;
  u_overlay: PanoramaOverlayMode;
  u_overlayOpacity: number;
  u_overlayNaNColor: Color;
  u_showDebug: boolean;
  u_depthReady: boolean;
  u_cursorRadius: number;
  u_cursorRings: number;
  u_imageReady: boolean;
  u_intensityReady: boolean;
};

function createDebugCanvas(
  tileSize: TileSize,
  text: string,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = tileSize[0];
  canvas.height = tileSize[1];

  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = 'hotpink';
  ctx.lineWidth = 5;
  ctx.strokeRect(0, 0, tileSize[0], tileSize[1]);

  ctx.translate(tileSize[0], 0);
  ctx.scale(-1, 1); // Flip the context horizontally

  ctx.fillStyle = 'hotpink';
  ctx.font = '60px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, tileSize[0] / 2, tileSize[1] / 2);

  return canvas;
}

function getUniformForType(
  type: PanoramaResourceType,
): 'u_rgb' | 'u_intensity' | 'u_depth' {
  return `u_${type}`;
}

export function getDefaultPanoramaTileMaterialUniforms(): PanoramaTileMaterialUniforms {
  return {
    u_rgb: Material.DefaultImageId,
    u_intensity: Material.DefaultImageId,
    u_depth: Material.DefaultImageId,
    u_debug: Material.DefaultImageId,
    u_minUV: new Cartesian2(),
    u_maxUV: new Cartesian2(),
    u_opacity: 1,
    u_overlay: PanoramaOverlayMode.Intensity,
    u_overlayOpacity: 1,
    u_showDebug: false,
    u_cursorPosition: new Cartesian3(-1, -1, -1),
    u_imageReady: false,
    u_intensityReady: false,
    u_depthReady: false,
    u_cursorRadius: 0.01,
    u_cursorRings: 3,
    u_overlayNaNColor: Color.RED,
  };
}

export default class PanoramaTileMaterial extends Material {
  declare private _loadedImages: { id: string }[];

  /**
   * The uniforms used by the panorama tile material. These are not intended to be modified directly
   * but rather through the provided properties.
   */
  declare uniforms: PanoramaTileMaterialUniforms;

  declare private _minificationFilter: TextureMinificationFilter;

  declare private _magnificationFilter: TextureMagnificationFilter;

  private _depthData: Float32Array | undefined;

  constructor(
    public readonly tileCoordinate: TileCoordinate,
    private _tileSize: TileSize,
  ) {
    const [numx, numy] = getNumberOfTiles(tileCoordinate.level);
    const sizeX = 1 / numx;
    const sizeY = 1 / numy;

    const { x, y } = tileCoordinate;
    const minUV = new Cartesian2(x * sizeX, 1 - (y * sizeY + sizeY));
    const maxUV = new Cartesian2(x * sizeX + sizeX, 1 - y * sizeY);

    super({
      fabric: {
        type: 'TileImage',
        uniforms: {
          ...getDefaultPanoramaTileMaterialUniforms(),
          u_minUV: minUV,
          u_maxUV: maxUV,
        },
        source,
      },
      translucent: false,
    });
  }

  /**
   * Shows the debug overlay on the panorama tile.
   */
  get showDebug(): boolean {
    return this.uniforms.u_showDebug;
  }

  set showDebug(value: boolean) {
    this.uniforms.u_showDebug = value;
    if (value && this.uniforms.u_debug === Material.DefaultImageId) {
      this.uniforms.u_debug = createDebugCanvas(
        this._tileSize,
        this.tileCoordinate.key,
      );
    }
  }

  /**
   * Display the overlay on the panorama tile.
   */
  get overlay(): PanoramaOverlayMode {
    return this.uniforms.u_overlay;
  }

  set overlay(value: PanoramaOverlayMode) {
    this.uniforms.u_overlay = value;
  }

  /**
   * The opacity of the overlay on the panorama tile.
   */
  get overlayOpacity(): number {
    return this.uniforms.u_overlayOpacity;
  }

  set overlayOpacity(value: number) {
    this.uniforms.u_overlayOpacity = value;
  }

  /**
   * The color used where overlay values are 0.
   */
  get overlayNaNColor(): Color {
    return this.uniforms.u_overlayNaNColor;
  }

  set overlayNaNColor(value: Color) {
    this.uniforms.u_overlayNaNColor = value;
  }

  /**
   * The global opacity of the panorama tile.
   */
  get opacity(): number {
    return this.uniforms.u_opacity;
  }

  set opacity(value: number) {
    this.uniforms.u_opacity = value;
  }

  /**
   * The position of the cursor in the panorama tile. Internal API to render the depth cursor.
   * (-1, -1, -1) means no data is available.
   * It should be a valid position in the panorama tiles cartesian coordinate system, scaled by the normalized depth.
   */
  get cursorPosition(): Cartesian3 {
    return this.uniforms.u_cursorPosition;
  }

  set cursorPosition(value: Cartesian3) {
    this.uniforms.u_cursorPosition = value;
  }

  get cursorRadius(): number {
    return this.uniforms.u_cursorRadius;
  }

  set cursorRadius(value: number) {
    this.uniforms.u_cursorRadius = value;
  }

  get cursorRings(): number {
    return this.uniforms.u_cursorRings;
  }

  set cursorRings(value: number) {
    this.uniforms.u_cursorRings = value;
  }

  /**
   * Sets the texture for the given panorama resource type.
   * @param type
   * @param data
   */
  setTexture<T extends PanoramaResourceType>(
    type: T,
    data: PanoramaResourceData<T>,
  ): void {
    if (this.hasTexture(type)) {
      throw new Error(`Texture for ${type} can only be set once!`);
    }

    const uniformType = getUniformForType(type);
    if (uniformType === 'u_depth') {
      this._depthData = data as Float32Array;
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = this._tileSize[0];
      canvas.height = this._tileSize[1];
      const context = canvas.getContext('2d');
      context!.drawImage(
        data as ImageBitmap,
        0,
        0,
        this._tileSize[0],
        this._tileSize[1],
      );
      this.uniforms[uniformType] = canvas;
    }
  }

  hasTexture(type: PanoramaResourceType): boolean {
    const uniform = getUniformForType(type);
    if (uniform === 'u_depth') {
      return this._depthData !== undefined;
    }
    return this.uniforms[uniform] !== Material.DefaultImageId;
  }

  /**
   * Returns the normalized depth value [0, 1] at the given pixel coordinates in the panorama tile.
   * @param x
   * @param y
   */
  getDepthAtPixel(x: number, y: number): number | undefined {
    if (!this._depthData) {
      return undefined;
    }

    const index = y * this._tileSize[0] + x;
    return this._depthData[index];
  }

  /**
   * Internal cesium API to update the material.
   * @param context
   */
  update(context: Context): void {
    const resolveImage =
      !this.uniforms.u_imageReady &&
      this._loadedImages?.some((i) => i.id === 'u_rgb');
    const resolveIntensity =
      !this.uniforms.u_intensityReady &&
      this._loadedImages?.find((i) => i.id === 'u_intensity');

    if (this.uniforms.u_depth === Material.DefaultImageId && this._depthData) {
      const sampler = new Sampler({
        minificationFilter: this._minificationFilter,
        magnificationFilter: this._magnificationFilter,
      });

      this.uniforms.u_depth = new Texture({
        context,
        pixelDatatype: PixelDatatype.FLOAT,
        pixelFormat: PixelFormat.RED,
        source: {
          arrayBufferView: this._depthData,
          width: this._tileSize[0],
          height: this._tileSize[1],
        },
        sampler,
      });
    } else if (
      !this.uniforms.u_depthReady &&
      this.uniforms.u_depth !== Material.DefaultImageId
    ) {
      this.uniforms.u_depthReady = true;
    }

    // @ts-expect-error is actually private
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super.update(context);

    if (resolveImage) {
      this.uniforms.u_imageReady = true;
    }

    if (resolveIntensity) {
      this.uniforms.u_intensityReady = true;
    }
  }
}
