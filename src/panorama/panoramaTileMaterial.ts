import {
  Material,
  Cartesian2,
  Cartesian3,
  Texture,
  TextureMinificationFilter,
  Sampler,
  PixelDatatype,
  PixelFormat,
  Context,
  TextureMagnificationFilter,
} from '@vcmap-cesium/engine';
import { getLogger } from '@vcsuite/logger';
import {
  getNumberOfTiles,
  type TileCoordinate,
  type TileSize,
} from './tileCoordinate.js';
import source from './panoramaTileMaterialFS.shader.js';
import type {
  PanoramaResourceData,
  PanoramaResourceType,
} from './panoramaTileProvider.js';

export type PanoramaTileMaterialUniforms = {
  image: HTMLCanvasElement | string;
  intensity: HTMLCanvasElement | string;
  debug: HTMLCanvasElement | string;
  depth: Texture | string;
  cursorPosition: Cartesian3;
  minSt: Cartesian2;
  maxSt: Cartesian2;
  opacity: number;
  showIntensity: boolean;
  showDebug: boolean;
  showDepth: boolean;
  intensityOpacity: number;
  depthReady: boolean;
  cursorRadius: number;
  cursorRings: number;
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
): 'image' | 'intensity' | 'depth' {
  if (type === 'rgb') {
    return 'image';
  }
  return type;
}

export function getDefaultPanoramaTileMaterialUniforms(): PanoramaTileMaterialUniforms {
  return {
    image: Material.DefaultImageId,
    intensity: Material.DefaultImageId,
    depth: Material.DefaultImageId,
    debug: Material.DefaultImageId,
    minSt: new Cartesian2(),
    maxSt: new Cartesian2(),
    opacity: 0,
    intensityOpacity: 1,
    showIntensity: false,
    showDebug: false,
    showDepth: false,
    cursorPosition: new Cartesian3(-1, -1, -1),
    depthReady: false,
    cursorRadius: 0.01,
    cursorRings: 3,
  };
}

export default class PanoramaTileMaterial extends Material {
  private _opacity = 1;

  private _showIntensity = false;

  ready: Promise<void>;

  intensityReady: Promise<void>;

  declare private _loadedImages: { id: string }[];

  declare uniforms: PanoramaTileMaterialUniforms;

  private _rgbResolve: (() => void) | undefined;

  private _intensityResolve: (() => void) | undefined;

  private _depthData: { buffer: Float32Array; tileSize: TileSize } | undefined;

  kernelRadius = 3;

  declare private _minificationFilter: TextureMinificationFilter;

  declare private _magnificationFilter: TextureMagnificationFilter;

  constructor(public readonly tileCoordinate: TileCoordinate) {
    const [numx, numy] = getNumberOfTiles(tileCoordinate.level);
    const sizeX = 1 / numx;
    const sizeY = 1 / numy;

    const { x, y } = tileCoordinate;
    const minSt = new Cartesian2(x * sizeX, 1 - (y * sizeY + sizeY));
    const maxSt = new Cartesian2(x * sizeX + sizeX, 1 - y * sizeY);

    super({
      fabric: {
        type: 'TileImage',
        uniforms: {
          ...getDefaultPanoramaTileMaterialUniforms(),
          minSt,
          maxSt,
        },
        source,
      },
      translucent: false,
    });

    this.ready = new Promise<void>((resolve) => {
      this._rgbResolve = resolve;
    });

    this.intensityReady = new Promise<void>((resolve) => {
      this._intensityResolve = resolve;
    });

    this.ready
      .then(() => {
        this.uniforms.opacity = this.opacity;
      })
      .catch(() => {
        getLogger('PanoramaTileMaterial').error(
          'Error loading panorama tile material',
        );
      });

    this.intensityReady
      .then(() => {
        this.uniforms.showIntensity = this.showIntensity;
      })
      .catch(() => {
        getLogger('PanoramaTileMaterial').error(
          'Error loading panorama tile material',
        );
      });
  }

  get showDebug(): boolean {
    return this.uniforms.showDebug;
  }

  set showDebug(value: boolean) {
    this.uniforms.showDebug = value;
    if (value && this.uniforms.debug === Material.DefaultImageId) {
      this.uniforms.debug = createDebugCanvas(
        [512, 512],
        this.tileCoordinate.key,
      );
    }
  }

  get showIntensity(): boolean {
    return this._showIntensity;
  }

  set showIntensity(value: boolean) {
    this._showIntensity = value;
    if (!this._intensityResolve) {
      this.uniforms.showIntensity = value;
    }
  }

  get showDepth(): boolean {
    return this.uniforms.showDepth;
  }

  set showDepth(value: boolean) {
    this.uniforms.showDepth = value;
  }

  get opacity(): number {
    return this._opacity;
  }

  set opacity(value: number) {
    this._opacity = value;
    if (!this._rgbResolve) {
      this.uniforms.opacity = value;
    }
  }

  get cursorPositon(): Cartesian3 {
    return this.uniforms.cursorPosition;
  }

  set cursorPosition(value: Cartesian3) {
    this.uniforms.cursorPosition = value;
  }

  get cursorRadius(): number {
    return this.uniforms.cursorRadius;
  }

  set cursorRadius(value: number) {
    this.uniforms.cursorRadius = value;
  }

  get cursorRings(): number {
    return this.uniforms.cursorRings;
  }

  set cursorRings(value: number) {
    this.uniforms.cursorRings = value;
  }

  get intensityOpacity(): number {
    return this.uniforms.intensityOpacity;
  }

  set intensityOpacity(value: number) {
    this.uniforms.intensityOpacity = value;
  }

  setTexture<T extends PanoramaResourceType>(
    type: T,
    data: PanoramaResourceData<T>,
    tileSize: TileSize,
  ): void {
    if (this.hasTexture(type)) {
      throw new Error(`Texture for ${type} can only be set once!`);
    }

    const uniformType = getUniformForType(type);
    if (uniformType === 'depth') {
      this._depthData = {
        buffer: data as Float32Array,
        tileSize,
      };
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = tileSize[0];
      canvas.height = tileSize[1];
      const context = canvas.getContext('2d');
      context!.drawImage(data as ImageBitmap, 0, 0, tileSize[0], tileSize[1]);
      this.uniforms[uniformType] = canvas;
    }
  }

  hasTexture(type: PanoramaResourceType): boolean {
    const uniform = getUniformForType(type);
    return this.uniforms[uniform] !== Material.DefaultImageId;
  }

  getDepthAtPixel(x: number, y: number): number | undefined {
    if (!this._depthData) {
      return undefined;
    }

    const { tileSize, buffer } = this._depthData;

    const index = y * tileSize[0] + x;
    return buffer[index];
  }

  update(context: Context): void {
    const resolveRgb =
      this._rgbResolve && this._loadedImages?.some((i) => i.id === 'image');
    const resolveIntensity =
      this._intensityResolve &&
      this._loadedImages?.find((i) => i.id === 'intensity');

    if (this.uniforms.depth === Material.DefaultImageId && this._depthData) {
      const sampler = new Sampler({
        minificationFilter: this._minificationFilter,
        magnificationFilter: this._magnificationFilter,
      });

      this.uniforms.depth = new Texture({
        context,
        pixelDatatype: PixelDatatype.FLOAT,
        pixelFormat: PixelFormat.RED,
        source: {
          arrayBufferView: this._depthData.buffer,
          width: this._depthData.tileSize[0],
          height: this._depthData.tileSize[1],
        },
        sampler,
      });
    } else if (
      !this.uniforms.depthReady &&
      this.uniforms.depth !== Material.DefaultImageId
    ) {
      this.uniforms.depthReady = true;
    }

    // @ts-expect-error is actually private
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super.update(context);

    if (resolveRgb) {
      this._rgbResolve?.();
      this._rgbResolve = undefined;
    }

    if (resolveIntensity) {
      this._intensityResolve?.();
      this._intensityResolve = undefined;
    }
  }
}
