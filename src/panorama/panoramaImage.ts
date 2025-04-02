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
import PanoramaDataset from './panoramaDataset.js';
import { getLogger } from '@vcsuite/logger';

export type PanoramaImageOptions = {
  imageUrl: string;
  name?: string;
};

type PanoramaImageMetadata = {
  tileSize: TileSize;
  minLevel: number;
  maxLevel: number;
};

type PanoramaGDALMetadata = {
  version: string;
  position: Cartesian3;
  orientation: HeadingPitchRoll;
  hasDepth: boolean;
  hasIntensity: boolean;
};

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
  readonly hasDepth: boolean;
  // the following properties are "tiled" specific
  readonly image: GeoTIFF;
  readonly tileProvider: PanoramaTileProvider;
  readonly tileSize: TileSize;
  readonly minLevel: number;
  readonly maxLevel: number;
  readonly maxDepth: number;
  readonly dataset?: PanoramaDataset;

  getIntensityTileProvider(): Promise<PanoramaTileProvider>;
  getPositionAtImageCoordinate(
    coordinate: [number, number],
    result?: Cartesian3,
  ): Promise<Cartesian3 | undefined>;
  destroy(): void;
};

function createDefaultMetadata(): PanoramaGDALMetadata {
  return {
    version: '1.0',
    position: Cartesian3.fromDegrees(0, 0, 0),
    orientation: HeadingPitchRoll.fromDegrees(0, 0, 0),
    hasDepth: false,
    hasIntensity: false,
  };
}

function parsePanoramaGDALMetadata(
  gdalMetadata?: Record<string, string>,
): PanoramaGDALMetadata {
  const version = gdalMetadata?.PANORAMA_VERSION ?? '';
  if (version !== '1.0') {
    return createDefaultMetadata();
  }

  const position = Cartesian3.fromDegrees(0, 0, 0);
  const orientation = new HeadingPitchRoll(0, 0, 0);
  if (gdalMetadata?.PANORAMA_POSITION) {
    const [lat, lon, z] = gdalMetadata.PANORAMA_POSITION.split(',')
      .map(Number)
      .filter((n) => !Number.isNaN(n));
    if (lat != null && lon != null && z != null) {
      Cartesian3.fromDegrees(lon, lat, z, undefined, position);
    }
  }

  if (gdalMetadata?.PANORAMA_ORIENTATION) {
    const [heading, pitch, roll] = gdalMetadata.PANORAMA_ORIENTATION.split(',')
      .map(Number)
      .filter((n) => !Number.isNaN(n));

    if (heading != null && pitch != null && roll != null) {
      orientation.heading = heading;
      orientation.pitch = pitch;
      orientation.roll = roll;
    }
  }

  const hasDepth = gdalMetadata?.PANORAMA_DEPTH === '1';
  const hasIntensity = gdalMetadata?.PANORAMA_INTENSITY === '1';

  return {
    version,
    position,
    orientation,
    hasDepth,
    hasIntensity,
  };
}

async function loadRGBImages(
  imageUrl: string,
): Promise<
  { image: GeoTIFF; images: GeoTIFFImage[] } & PanoramaImageMetadata &
    PanoramaGDALMetadata
> {
  const image = await fromUrl(imageUrl);
  let imageCount = await image.getImageCount();
  const promises = [];
  while (imageCount) {
    imageCount -= 1;
    promises.push(image.getImage(imageCount));
  }
  const images = await Promise.all(promises);
  const tileSize: TileSize = [
    images[0].getTileWidth(),
    images[0].getTileHeight(),
  ];

  let minLevelImage = images[0];
  let minLevel = minLevelImage.getHeight() / tileSize[0] - 1;
  while (minLevel < 0) {
    getLogger('PanoramaImage').warning('Lowest level is not a full tile');
    // lowest image is not a full tile, we skip it
    images.shift();
    minLevelImage = images[0];
    minLevel = minLevelImage.getHeight() / tileSize[0] - 1;
  }
  const maxLevel = images.length - 1 + minLevel;
  const gdalMetadata = parsePanoramaGDALMetadata(
    images.at(-1)!.getGDALMetadata() as Record<string, string> | undefined,
  );

  return {
    image,
    images,
    tileSize,
    minLevel,
    maxLevel,
    ...gdalMetadata,
  };
}

function parseRgbUrl(imageUrl: string): { name: string; absoluteUrl: string } {
  const absoluteImageUrl = new URL(imageUrl, window.location.href);
  const fileName = absoluteImageUrl.pathname.split('/').pop();
  if (!fileName || !fileName.endsWith('_rgb.tif')) {
    throw new Error('Invalid image url');
  }
  const name = fileName.slice(0, -8);

  return {
    name,
    absoluteUrl: absoluteImageUrl.href,
  };
}

export async function createPanoramaImageFromURL(
  imageUrl: string,
  dataset?: PanoramaDataset,
): Promise<PanoramaImage> {
  const { name, absoluteUrl } = parseRgbUrl(imageUrl);
  const {
    image,
    images: rgb,
    tileSize,
    minLevel,
    maxLevel,
    position,
    orientation,
    hasIntensity,
    hasDepth,
  } = await loadRGBImages(absoluteUrl);

  const modelMatrix = Transforms.headingPitchRollToFixedFrame(
    position,
    new HeadingPitchRoll(
      orientation.heading + Math.PI / 2, // spheres are oriented down the X axis, twist it to align.
      orientation.pitch,
      orientation.roll,
    ),
  );
  const scaledModelMatrix = Matrix4.clone(modelMatrix);
  Matrix4.setScale(modelMatrix, new Cartesian3(50, 50, 50), scaledModelMatrix);

  const upCart4 = Matrix4.getColumn(modelMatrix, 2, new Cartesian4());
  Cartesian4.normalize(upCart4, upCart4);
  const up = Cartesian3.fromCartesian4(upCart4, new Cartesian3());

  const invModelMatrix = Matrix4.inverseTransformation(
    modelMatrix,
    new Matrix4(),
  );

  const tileProvider = createPanoramaTileProvider(
    rgb,
    scaledModelMatrix,
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
      } = await loadRGBImages(
        new URL(`${name}_intensity.tif`, absoluteUrl).href,
      );
      if (intensityMinLevel !== minLevel || intensityMaxLevel !== maxLevel) {
        throw new Error('Intensity levels do not match RGB levels');
      }

      intensityTileProvider = createPanoramaTileProvider(
        intensity,
        scaledModelMatrix,
        tileSize,
        minLevel,
      );
    }

    return intensityTileProvider;
  };

  let depthTileProvider: PanoramaDepth | undefined;
  if (hasDepth) {
    createPanoramaDepth(
      new URL(`${name}_depth.tif`, absoluteUrl).href,
      position,
      modelMatrix,
    )
      .then((depth) => {
        depthTileProvider = depth; // check destroyed.
        Matrix4.setScale(
          scaledModelMatrix,
          new Cartesian3(
            depthTileProvider.maxDepth,
            depthTileProvider.maxDepth,
            depthTileProvider.maxDepth,
          ),
          scaledModelMatrix,
        );
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
      return position;
    },
    get orientation(): HeadingPitchRoll {
      return orientation;
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
    get hasDepth(): boolean {
      return hasDepth;
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
    get maxDepth(): number {
      return depthTileProvider?.maxDepth ?? 50;
    },
    get dataset(): PanoramaDataset | undefined {
      return dataset;
    },
    getIntensityTileProvider,
    async getPositionAtImageCoordinate(
      imageCoordinate: [number, number],
      result?: Cartesian3,
    ): Promise<Cartesian3 | undefined> {
      return depthTileProvider?.getPositionAtImageCoordinate(
        imageCoordinate,
        result,
      );
    },
    destroy(): void {
      tileProvider.destroy();
      image.close();
    },
  };
}
