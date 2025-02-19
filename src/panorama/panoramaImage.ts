import {
  Cartesian3,
  Matrix4,
  Transforms,
  HeadingPitchRoll,
  Cartesian4,
} from '@vcmap-cesium/engine';
import { fromUrl, GeoTIFF, GeoTIFFImage } from 'geotiff';
import {
  createPanoramaTileProvider,
  PanoramaTileProvider,
} from './panoramaTileProvider.js';
import type { TileSize } from './panoramaTile.js';
import { createPanoramaDepth, PanoramaDepth } from './panoramaDepth.js';

export type PanoramaImageOptions = {
  imageUrl: string;
  name?: string;
  position: { x: number; y: number; z: number };
  orientation: { heading: number; pitch: number; roll: number };
};

type PanoramaImageMetadata = {
  tileSize: TileSize;
  minLevel: number;
  maxLevel: number;
  hasIntensity: boolean;
  hasDepth: boolean;
};

type VcsGdalMetadata =
  | {
      VCS_INTENSITY?: string;
      VCS_DEPTH?: string;
    }
  | undefined
  | null;

export type PanoramaImage = {
  readonly name: string;
  /**
   * position ECEF
   */
  readonly position: Cartesian3;
  /**
   * HeadingPitchRoll in radians
   */
  readonly orientation: HeadingPitchRoll;
  readonly modelMatrix: Matrix4;
  readonly up: Cartesian3;
  readonly invModelMatrix: Matrix4;
  readonly hasIntensity: boolean;
  // the following properties are "tiled" specific
  readonly image: GeoTIFF;
  readonly tileProvider: PanoramaTileProvider;
  readonly tileSize: TileSize;
  readonly minLevel: number;
  readonly maxLevel: number;

  getIntensityTileProvider(): Promise<PanoramaTileProvider>;
  getPositionAtImageCoordinate(
    coordinate: [number, number],
  ): Promise<Cartesian3 | undefined>;
  destroy(): void;
};

async function loadRGBImages(
  imageUrl: string,
): Promise<{ image: GeoTIFF; images: GeoTIFFImage[] } & PanoramaImageMetadata> {
  const image = await fromUrl(imageUrl);
  let imageCount = await image.getImageCount();
  const promises = [];
  while (imageCount) {
    imageCount -= 1;
    promises.push(image.getImage(imageCount));
  }
  const images = await Promise.all(promises);
  const minLevelImage = images[0];
  const tileSize: TileSize = [
    minLevelImage.getTileWidth(),
    minLevelImage.getTileHeight(),
  ];

  const minLevel = minLevelImage.getHeight() / tileSize[0] - 1;
  const maxLevel = images.length - 1 + minLevel;
  const gdalMetadata = images.at(-1)!.getGDALMetadata() as VcsGdalMetadata;

  return {
    image,
    images,
    tileSize,
    minLevel,
    maxLevel,
    hasIntensity: gdalMetadata?.VCS_INTENSITY === '1',
    hasDepth: gdalMetadata?.VCS_DEPTH === '1',
  };
}

export async function createPanoramaImage(
  options: PanoramaImageOptions,
): Promise<PanoramaImage> {
  const { imageUrl, name, position, orientation } = options;
  const absoluteImageUrl = new URL(imageUrl, window.location.href).href;
  const {
    image,
    images: rgb,
    tileSize,
    minLevel,
    maxLevel,
    hasIntensity,
    hasDepth,
  } = await loadRGBImages(absoluteImageUrl);

  const cartesianPosition = Cartesian3.fromDegrees(
    position.x,
    position.y,
    position.z,
  );

  const headingPitchRoll = HeadingPitchRoll.fromDegrees(
    orientation.heading,
    orientation.pitch,
    orientation.roll,
  );

  const modelMatrix = Transforms.headingPitchRollToFixedFrame(
    cartesianPosition,
    headingPitchRoll,
  );

  const upCart4 = Matrix4.getColumn(modelMatrix, 2, new Cartesian4());
  Cartesian4.normalize(upCart4, upCart4);
  const up = Cartesian3.fromCartesian4(upCart4, new Cartesian3());

  const invModelMatrix = Matrix4.inverseTransformation(
    modelMatrix,
    new Matrix4(),
  );

  const tileProvider = createPanoramaTileProvider(
    rgb,
    cartesianPosition,
    tileSize,
    minLevel,
  );

  let intensityTileProvider: PanoramaTileProvider | undefined;
  const getIntensityTileProvider = async (): Promise<PanoramaTileProvider> => {
    if (!hasIntensity) {
      throw new Error('Intensity not available');
    }
    if (!intensityTileProvider) {
      const {
        images: intensity,
        minLevel: intensityMinLevel,
        maxLevel: intensityMaxLevel,
      } = await loadRGBImages(new URL('intensity.tif', absoluteImageUrl).href);
      if (intensityMinLevel !== minLevel || intensityMaxLevel !== maxLevel) {
        throw new Error('Intensity levels do not match RGB levels');
      }

      intensityTileProvider = createPanoramaTileProvider(
        intensity,
        cartesianPosition,
        tileSize,
        minLevel,
      );
    }

    return intensityTileProvider;
  };

  let depthTileProvider: PanoramaDepth | undefined;
  if (hasDepth) {
    createPanoramaDepth(
      new URL('depth.tif', absoluteImageUrl).href,
      cartesianPosition,
    )
      .then((depth) => {
        depthTileProvider = depth; // check destroyed.
      })
      .catch((err) => {
        console.error('Error loading depth', err);
      });
  }

  return {
    get name(): string {
      return name ?? '';
    },
    get position(): Cartesian3 {
      return cartesianPosition;
    },
    get orientation(): HeadingPitchRoll {
      return headingPitchRoll;
    },
    get modelMatrix(): Matrix4 {
      return modelMatrix;
    },
    get up(): Cartesian3 {
      return up;
    },
    get invModelMatrix(): Matrix4 {
      return invModelMatrix;
    },
    get tileProvider(): PanoramaTileProvider {
      return tileProvider;
    },
    get hasIntensity(): boolean {
      return hasIntensity;
    },
    get image(): GeoTIFF {
      return image;
    },
    get tileSize(): TileSize {
      return tileSize;
    },
    get minLevel(): number {
      return minLevel;
    },
    get maxLevel(): number {
      return maxLevel;
    },
    getIntensityTileProvider,
    async getPositionAtImageCoordinate(
      imageCoordinate: [number, number],
    ): Promise<Cartesian3 | undefined> {
      return depthTileProvider?.getPositionAtImageCoordinate(imageCoordinate);
    },
    destroy(): void {
      tileProvider.destroy();
      image.close();
    },
  };
}
