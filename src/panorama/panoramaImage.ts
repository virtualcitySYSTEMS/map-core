import {
  Cartesian3,
  Cartesian4,
  HeadingPitchRoll,
  Matrix4,
  Transforms,
} from '@vcmap-cesium/engine';
import { v4 as uuid } from 'uuid';
import type { GeoTIFFImage, Pool, GeoTIFF } from 'geotiff';
import { fromUrl } from 'geotiff';
import { getLogger } from '@vcsuite/logger';
import type { Size } from 'ol/size.js';
import type {
  PanoramaImageDecoder,
  PanoramaTileProvider,
} from './panoramaTileProvider.js';
import { createPanoramaTileProvider } from './panoramaTileProvider.js';
import { imageSphericalToCartesian } from './sphericalCoordinates.js';
import type PanoramaDatasetLayer from '../layer/panoramaDatasetLayer.js';

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

type PanoramaImageMetadata = {
  tileSize: Size;
  minLevel: number;
  maxLevel: number;
};

export type DepthGDALMetadata = {
  version: string;
  min: number;
  max: number;
};

export type PanoramaFileDirectoryMetadata = { type: 'image' | 'depth' };

/**
 * The panorama image represents all resources associated with a panorama image.
 * When created, it extracts all available metadata from the base geotiff resource
 * and loads associated structures, such as the tile provider for RGB and intensity images (if available & on demand)
 * and the panorama depth of the image (if available).
 */
export type PanoramaImage = Readonly<
  PanoramaImageMetadata & Omit<PanoramaGDALMetadata, 'version'>
> & {
  /**
   * The image name
   */
  readonly name: string;
  /**
   * The image time, if known
   */
  readonly time?: Date;
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
  readonly dataset?: PanoramaDatasetLayer;
  /**
   * Tries to determine the global position at the given image spherical coordinate. Will return undefined, if the image has no depth.
   * Uses the current level on the tile provider
   * @param coordinate
   * @param result
   */
  getPositionAtImageCoordinate(
    coordinate: [number, number],
    result?: Cartesian3,
  ): Promise<Cartesian3 | undefined>;
  /**
   * Tries to determine the global position at the given image spherical coordinate. Will return undefined, if the image has no depth
   * Uses the heighest available depth data, but is more resource intense
   * @param coordinate
   * @param result
   */
  getPositionAtImageCoordinateMostDetailed(
    coordinate: [number, number],
    result?: Cartesian3,
  ): Promise<Cartesian3 | undefined>;
  /**
   * Checks if this panorama image is equal to another panorama image
   * by comparing name and baseUrl of dataset.
   * @param other - the other image to compare with
   * @returns true if the images represent the same panorama data
   */
  equals(other?: PanoramaImage): boolean;
  destroy(): void;
};

/**
 * additional image creating options, mainly used for testing.
 */
export type CreatePanoramaImageOptions = {
  /**
   * The dataset an image may belong to
   */
  dataset?: PanoramaDatasetLayer;
  /**
   * The time of the image, if known
   */
  time?: Date;
  /**
   * The root URL for the image. This is used to load the intensity and depth images.
   */
  absoluteRootUrl?: string;
  /**
   * a preloaded depth image for this RGB image.
   */
  depthImage?: GeoTIFF;
  /**
   * a preloaded intensity image for this RGB image.
   */
  intensityImage?: GeoTIFF;
  /**
   * the name of the image. This is used to load intensity and depth images. if not provided, a uuid is used.
   */
  name?: string;
  /**
   * an optional pool or decoder to be passed to the tile provider. mainly used in testing
   */
  poolOrDecoder?: Pool | PanoramaImageDecoder;
  /**
   * The size of the tile cache. If not provided, the default is used.
   */
  tileCacheSize?: number;
  /**
   * The concurrency of the tile provider. If not provided, the default is used.
   */
  providerConcurrency?: number;
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

function createDefaultDepthMetadata(): DepthGDALMetadata {
  return {
    version: '1.0',
    min: 0,
    max: 50,
  };
}

function parseDepthGDALMetadata(
  gdalMetadata?: Record<string, string>,
): DepthGDALMetadata {
  const version = gdalMetadata?.PANORAMA_DEPTH_VERSION ?? '';
  const metadata = createDefaultDepthMetadata();
  if (version !== '1.0') {
    return metadata;
  }

  const max = gdalMetadata?.PANORAMA_DEPTH_MAX ?? '';
  if (max) {
    const maxNumber = Number(max);
    if (Number.isFinite(maxNumber)) {
      metadata.max = maxNumber;
    }
  }

  const min = gdalMetadata?.PANORAMA_DEPTH_MIN ?? '';
  if (min) {
    const minNumber = Number(min);
    if (Number.isFinite(minNumber)) {
      metadata.min = minNumber;
    }
  }

  return metadata;
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
  const tileSize: Size = [images[0].getTileWidth(), images[0].getTileHeight()];

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

  return {
    images,
    tileSize,
    minLevel,
    maxLevel,
  };
}

async function loadRGBImages(
  image: GeoTIFF,
): Promise<
  { images: GeoTIFFImage[] } & PanoramaImageMetadata & PanoramaGDALMetadata
> {
  const { images, ...meta } = await loadMetadataFromImage(image);
  const gdalMetadata = parsePanoramaGDALMetadata(
    images.at(-1)!.getGDALMetadata() as Record<string, string> | undefined,
  );

  images.forEach((i) => {
    (
      i.fileDirectory as { vcsPanorama: PanoramaFileDirectoryMetadata }
    ).vcsPanorama = { type: 'image' };
  });

  return {
    images,
    ...meta,
    ...gdalMetadata,
  };
}

function parseRgbUrl(imageUrl: string): {
  name: string;
  absoluteRootUrl: string;
} {
  const absoluteImageUrl = new URL(imageUrl, window.location.href);
  const fileName = absoluteImageUrl.pathname.split('/').pop();
  if (!fileName || !fileName.endsWith('_rgb.tif')) {
    throw new Error('Invalid image url');
  }
  const name = fileName.slice(0, -8);

  return {
    name,
    absoluteRootUrl: absoluteImageUrl.href,
  };
}

/**
 * This is an internal function to create a panorama image for specific use cases (e.g. testing).
 * In most cases, you should use {@link createPanoramaImageFromURL} directly.
 * Creates a panorama image from a GeoTIFF image. The image should contain the metadata in the GDAL metadata format.
 * @param rgbImage - the RGB image
 * @param [options]
 */
export async function createPanoramaImage(
  rgbImage: GeoTIFF,
  options: CreatePanoramaImageOptions = {},
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
  } = await loadRGBImages(rgbImage);
  const { name, absoluteRootUrl, intensityImage, depthImage, dataset, time } =
    options;

  const imageTime = time ? new Date(time) : undefined;
  const nameOrId = name ?? uuid();
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

  let getIntensityImages: (() => Promise<GeoTIFFImage[]>) | undefined;
  if (intensityImage || (hasIntensity && absoluteRootUrl)) {
    getIntensityImages = async (): Promise<GeoTIFFImage[]> => {
      const usedIntensityImage =
        intensityImage ??
        (await fromUrl(new URL(`${name}_intensity.tif`, absoluteRootUrl).href));

      const {
        images: intensity,
        minLevel: intensityMinLevel,
        maxLevel: intensityMaxLevel,
      } = await loadMetadataFromImage(usedIntensityImage);

      if (intensityMinLevel !== minLevel || intensityMaxLevel !== maxLevel) {
        throw new Error('Intensity levels do not match RGB levels');
      }

      intensity.forEach((i) => {
        (
          i.fileDirectory as { vcsPanorama: PanoramaFileDirectoryMetadata }
        ).vcsPanorama = { type: 'image' };
      });

      return intensity;
    };
  }

  let depth:
    | { levelImages: GeoTIFFImage[]; metadata: DepthGDALMetadata }
    | undefined;

  let usedDepthImage = depthImage;
  if (!usedDepthImage && hasDepth && absoluteRootUrl) {
    try {
      usedDepthImage = await fromUrl(
        new URL(`${name}_depth.tif`, absoluteRootUrl).href,
      );
    } catch (e) {
      getLogger('PanoramaImage').warning(
        `ailed to load depth image for ${name}`,
      );
    }
  }

  if (usedDepthImage) {
    const {
      images: depthImages,
      minLevel: depthMinLevel,
      maxLevel: depthMaxLevel,
    } = await loadMetadataFromImage(usedDepthImage);

    if (depthMinLevel !== minLevel || depthMaxLevel !== maxLevel) {
      throw new Error('Depth levels do not match RGB levels');
    }

    const depthMetadata = parseDepthGDALMetadata(
      depthImages.at(-1)!.getGDALMetadata() as Record<string, string>,
    );
    depthImages.forEach((i) => {
      (
        i.fileDirectory as { vcsPanorama: PanoramaFileDirectoryMetadata }
      ).vcsPanorama = {
        type: 'depth',
      };
    });

    depth = { levelImages: depthImages, metadata: depthMetadata };
  }

  const tileProvider = createPanoramaTileProvider(
    rgb,
    scaledModelMatrix,
    tileSize,
    minLevel,
    maxLevel,
    getIntensityImages,
    depth,
    options.tileCacheSize,
    options.providerConcurrency,
    options.poolOrDecoder,
  );

  const positionAtDepth = async (
    imageCoordinate: [number, number],
    mostDetailed: boolean,
    result?: Cartesian3,
  ): Promise<Cartesian3 | undefined> => {
    const depthValue = mostDetailed
      ? await tileProvider.getDepthAtImageCoordinateMostDetailed(
          imageCoordinate,
        )
      : await tileProvider.getDepthAtImageCoordinate(imageCoordinate);
    if (depthValue === undefined || depthValue === 0) {
      return undefined;
    }
    const cartesian = imageSphericalToCartesian(imageCoordinate, result);
    Cartesian3.normalize(cartesian, cartesian);
    Cartesian3.multiplyByScalar(cartesian, depthValue, cartesian);
    Matrix4.multiplyByPoint(modelMatrix, cartesian, cartesian);
    return cartesian;
  };

  return {
    get name(): string {
      return nameOrId;
    },
    get time(): Date | undefined {
      return imageTime;
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
    get tileSize(): Size {
      return tileSize;
    },
    get minLevel(): number {
      return minLevel;
    },
    get maxLevel(): number {
      return maxLevel;
    },
    get maxDepth(): number {
      return depth?.metadata?.max ?? 50;
    },
    get dataset(): PanoramaDatasetLayer | undefined {
      return dataset;
    },
    async getPositionAtImageCoordinate(
      imageCoordinate: [number, number],
      result?: Cartesian3,
    ): Promise<Cartesian3 | undefined> {
      return positionAtDepth(imageCoordinate, false, result);
    },
    async getPositionAtImageCoordinateMostDetailed(
      imageCoordinate: [number, number],
      result?: Cartesian3,
    ): Promise<Cartesian3 | undefined> {
      return positionAtDepth(imageCoordinate, true, result);
    },
    equals(other?: PanoramaImage): boolean {
      return (
        other != null &&
        nameOrId === other.name &&
        dataset?.baseUrl === other.dataset?.baseUrl
      );
    },
    destroy(): void {
      tileProvider.destroy();
    },
  };
}

/**
 * Creates a panorama image from a URL. The URL must point to a RGB image with the name ending in "_rgb.tif".
 * @param rgbImageUrl - the url to the RGB image
 * @param [dataset] - the dataset to which the image belongs, if applicable
 * @param [time] - the time of the image, if known
 */
export async function createPanoramaImageFromURL(
  rgbImageUrl: string,
  dataset?: PanoramaDatasetLayer,
  time?: Date,
): Promise<PanoramaImage> {
  const { name, absoluteRootUrl } = parseRgbUrl(rgbImageUrl);
  const image = await fromUrl(absoluteRootUrl);
  return createPanoramaImage(image, { dataset, absoluteRootUrl, name, time });
}
