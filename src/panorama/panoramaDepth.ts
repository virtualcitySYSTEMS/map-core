import { Cartesian3, Math as CesiumMath, Matrix4 } from '@vcmap-cesium/engine';
import type { GeoTIFF, BaseDecoder } from 'geotiff';
import { fromUrl, Pool } from 'geotiff';
import { getLogger } from '@vcsuite/logger';
import { imageSphericalToCartesian } from './sphericalCoordinates.js';

export type PanoramaDepth = {
  readonly maxDepth: number;
  /**
   * Returns the position in 3D space at the given image coordinate.
   * @param imageCoordinate - the image coordinate [phi, theta] in radians, see spherical coordinates
   * @param [buffer=3] - the number of pixels to read around the image coordinate. should be a positive integer
   * @param result
   */
  getPositionAtImageCoordinate(
    imageCoordinate: [number, number],
    buffer?: number,
    result?: Cartesian3,
  ): Promise<Cartesian3 | undefined>;
  destroy(): void;
};

type DepthGDALMetadata = {
  version: string;
  min: number;
  max: number;
};

function createDefaultMetadata(): DepthGDALMetadata {
  return {
    version: '1.0',
    min: 0,
    max: 50,
  };
}

function parsePanoramaGDALMetadata(
  gdalMetadata?: Record<string, string>,
): DepthGDALMetadata {
  const version = gdalMetadata?.PANORAMA_DEPTH_VERSION ?? '';
  const metadata = createDefaultMetadata();
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

/**
 * this is just a linear interpolation. most likely the data should be "weighed" based on pixel value, distance,
 * histogram equalization or something similar.
 * @param value
 * @param min
 * @param max
 * @param minValue
 * @param maxValue
 */
function interpolate(
  value: number,
  min: number,
  max: number,
  minValue = 1,
  maxValue = 65535,
): number {
  return min + ((value - minValue) / (maxValue - minValue)) * (max - min);
}

let defaultDepthPool: Pool | undefined;
function getDefaultDepthPool(): Pool {
  if (!defaultDepthPool) {
    defaultDepthPool = new Pool();
  }
  return defaultDepthPool;
}

/**
 * Creates a panorama depth object given a GeoTIFF image. Most likely you wish to use createPanoramaDepthFromUrl.
 * @param geotiff - the GeoTIFF image containing the depth data
 * @param modelMatrix - the model matrix of the image
 * @param [pool]
 */
export async function createPanoramaDepth(
  geotiff: GeoTIFF,
  modelMatrix: Matrix4,
  pool: Pool | BaseDecoder = getDefaultDepthPool(),
): Promise<PanoramaDepth> {
  const imageCount = await geotiff.getImageCount();
  if (imageCount !== 1) {
    getLogger('PanoramaDepth').warning(
      'PanoramaDepth only supports single image GeoTIFFs, assuming first image is the largest',
    );
  }
  const image = await geotiff.getImage(0);
  const { min, max } = parsePanoramaGDALMetadata(
    image.getGDALMetadata() as Record<string, string>,
  );

  // this enables caching on the image
  image.tiles = image.tiles ?? {};

  const width = image.getWidth();
  const radiansPerPixel = CesiumMath.TWO_PI / width;

  const getPixelForCoordinate = ([phi, theta]: [number, number]): [
    number,
    number,
  ] => {
    const pixelX = Math.floor(phi / radiansPerPixel);
    const pixelY = Math.floor(theta / radiansPerPixel);
    return [pixelX, pixelY];
  };

  return {
    get maxDepth(): number {
      return max;
    },
    async getPositionAtImageCoordinate(
      imageCoordinate: [number, number],
      buffer = 3,
      result?: Cartesian3,
    ): Promise<Cartesian3 | undefined> {
      const [pixelX, pixelY] = getPixelForCoordinate(imageCoordinate);
      const rasterData = await image.readRasters({
        window: [
          pixelX - buffer,
          pixelY - buffer,
          // we must offset by one to create a "border" around the pixel
          pixelX + buffer + 1,
          pixelY + buffer + 1,
        ],
        pool,
      });

      const data = (rasterData[0] as Uint8Array).filter((i) => !!i);
      if (data.length === 0) {
        return undefined;
      }

      const depthValue =
        data.reduce(
          (prev: number, curr: number) => prev + interpolate(curr, min, max),
          0,
        ) / data.length;

      if (depthValue === 0) {
        return undefined;
      }

      const cartesian = imageSphericalToCartesian(imageCoordinate, result);
      Cartesian3.normalize(cartesian, cartesian);
      Cartesian3.multiplyByScalar(cartesian, depthValue, cartesian);
      Matrix4.multiplyByPoint(modelMatrix, cartesian, cartesian);
      return cartesian;
    },
    destroy(): void {
      // this clears the cache on the image
      image.tiles = {};
    },
  };
}

/**
 * Creates a panorama depth object given a
 * @param url - the url of the GeoTIFF file containing the depth data
 * @param modelMatrix - the model matrix of the image
 */
export async function createPanoramaDepthFromUrl(
  url: string,
  modelMatrix: Matrix4,
): Promise<PanoramaDepth> {
  const geotiff = await fromUrl(url, { cache: true });
  return createPanoramaDepth(geotiff, modelMatrix);
}
