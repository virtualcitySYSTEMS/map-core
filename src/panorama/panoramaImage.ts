import {
  Cartesian3,
  Matrix4,
  Transforms,
  HeadingPitchRoll,
  Cartesian4,
} from '@vcmap-cesium/engine';
import { v4 as uuid } from 'uuid';
import type { GeoTIFF, GeoTIFFImage } from 'geotiff';
import { fromUrl } from 'geotiff';
import { getLogger } from '@vcsuite/logger';
import type { PanoramaTileProvider } from './panoramaTileProvider.js';
import { createPanoramaTileProvider } from './panoramaTileProvider.js';
import type { TileSize } from './panoramaTile.js';
import type { PanoramaDepth } from './panoramaDepth.js';
import { createPanoramaDepthFromUrl } from './panoramaDepth.js';
import type PanoramaDataset from './panoramaDataset.js';

type PanoramaGDALMetadata = {
  /**
   * The metadata version
   */
  version: string;
  /**
   * position ECEF
   */
  position: Cartesian3;
  /**
   * HeadingPitchRoll in radians
   */
  orientation: HeadingPitchRoll;
  /**
   * This image has depth information available
   */
  hasDepth: boolean;
  /**
   * This image has intensity information available
   */
  hasIntensity: boolean;
};

type PanoramaImageMetadata = PanoramaGDALMetadata & {
  tileSize: TileSize;
  minLevel: number;
  maxLevel: number;
};

/**
 * The panorama image represents all resources associated with a panorama image.
 * When created, it extracts all available metadata from the base geotiff resource
 * and loads associated structures, such as the tile provider for RGB and intensity images (if available & on demand)
 * and the panorama depth of the image (if available).
 */
export type PanoramaImage = Readonly<Omit<PanoramaImageMetadata, 'version'>> & {
  /**
   * The image name
   */
  readonly name: string;
  readonly up: Cartesian3;
  readonly modelMatrix: Matrix4;
  readonly invModelMatrix: Matrix4;
  readonly image: GeoTIFF;
  /**
   * The tile provider for the RGB images
   */
  readonly tileProvider: PanoramaTileProvider;
  /**
   * The maximum depth of the image. Either taken from the depth image header or the default
   */
  readonly maxDepth: number;
  /**
   * The parent dataset, if available
   */
  readonly dataset?: PanoramaDataset;
  /**
   * The intensity image tile provider. Will throw an error if the image has no intensity (check "hasIntensity")
   */
  getIntensityTileProvider(): Promise<PanoramaTileProvider>;
  /**
   * Passed directly to {@see PanoramaDepth.getPositionAtImageCoordinate}. Will return undefined, if the image has no depth
   * @param coordinate
   * @param buffer
   * @param result
   */
  getPositionAtImageCoordinate(
    coordinate: [number, number],
    buffer?: number,
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

async function loadMetadataFromImage(
  image: GeoTIFF,
): Promise<{ images: GeoTIFFImage[] } & PanoramaImageMetadata> {
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

/**
 * This is an internal function to create a panorama image for specific use cases (e.g. testing).
 * In most cases, you should use {@link createPanoramaImageFromURL} directly.
 * Creates a panorama image from a GeoTIFF image. The image should contain the metadata in the GDAL metadata format.
 * @param rgbImage - the RGB image
 * @param [dataset] - the dataset to which the image belongs, if applicable
 * @param [absoluteRootUrl] - the root URL for the image. This is used to load the intensity and depth images.
 * @param [name] - the name of the image. This is used to load intensity and depth images. if not provided, a uuid is used.
 */
export async function createPanoramaImage(
  rgbImage: GeoTIFF,
  dataset?: PanoramaDataset,
  absoluteRootUrl?: string,
  name = uuid(),
): Promise<PanoramaImage> {
  const {
    images: rgb,
    tileSize,
    minLevel,
    maxLevel,
    position,
    orientation,
    hasIntensity,
    hasDepth,
  } = await loadMetadataFromImage(rgbImage);

  const modelMatrix = Transforms.headingPitchRollToFixedFrame(
    position,
    new HeadingPitchRoll(
      orientation.heading + Math.PI / 2, // spheres are oriented down the X axis, twist it to align.
      -orientation.pitch, // turn against camera pitch,
      -orientation.roll, // turn against camera roll,
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
    if (!hasIntensity || !absoluteRootUrl) {
      throw new Error('Intensity not available');
    }
    if (!intensityTileProvider) {
      const intensityImage = await fromUrl(
        new URL(`${name}_intensity.tif`, absoluteRootUrl).href,
      );
      const {
        images: intensity,
        minLevel: intensityMinLevel,
        maxLevel: intensityMaxLevel,
      } = await loadMetadataFromImage(intensityImage);
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
  if (hasDepth && absoluteRootUrl) {
    createPanoramaDepthFromUrl(
      new URL(`${name}_depth.tif`, absoluteRootUrl).href,
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
      .catch((err: unknown) => {
        getLogger('PanoramaImage').error('Error loading depth', err);
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
      return rgbImage;
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
      buffer?: number,
      result?: Cartesian3,
    ): Promise<Cartesian3 | undefined> {
      return depthTileProvider?.getPositionAtImageCoordinate(
        imageCoordinate,
        buffer,
        result,
      );
    },
    destroy(): void {
      tileProvider.destroy();
      intensityTileProvider?.destroy();
      depthTileProvider?.destroy();
    },
  };
}

/**
 * Creates a panorama image from a URL. The URL must point to a RGB image with the name ending in "_rgb.tif".
 * @param rgbImageUrl - the url to the RGB image
 * @param [dataset] - the dataset to which the image belongs, if applicable
 */
export async function createPanoramaImageFromURL(
  rgbImageUrl: string,
  dataset?: PanoramaDataset,
): Promise<PanoramaImage> {
  const { name, absoluteUrl } = parseRgbUrl(rgbImageUrl);
  const image = await fromUrl(absoluteUrl);
  return createPanoramaImage(image, dataset, absoluteUrl, name);
}
