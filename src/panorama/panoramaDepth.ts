import { Cartesian3, Math as CesiumMath, Matrix4 } from '@vcmap-cesium/engine';
import { fromUrl, GeoTIFFImage, Pool, ReadRasterResult } from 'geotiff';
import { sphericalToCartesian } from './sphericalCoordinates.js';

export type PanoramaDepth = {
  getPositionAtImageCoordinate(
    imageCoordinate: [number, number],
    result?: Cartesian3,
  ): Promise<Cartesian3 | undefined>;
  destroy(): void;
};

type PanoramaDepthTileProvider = {
  getDepthTile(imageCoordinate: [number, number]): Promise<ReadRasterResult>;
  destroy(): void;
};

type GetTileForCoordinate = (imageCoordinate: [number, number]) => {
  pixelX: number;
  pixelY: number;
};

function createGetTileForCoordinate(image: GeoTIFFImage): GetTileForCoordinate {
  const width = image.getWidth();
  const radiansPerPixel = CesiumMath.TWO_PI / width;

  return ([phi, theta]) => {
    const pixelX = Math.floor(phi / radiansPerPixel);
    const pixelY = Math.floor(theta / radiansPerPixel);
    return {
      pixelX,
      pixelY,
    };
  };
}

function createDepthTileProvider(
  image: GeoTIFFImage,
): PanoramaDepthTileProvider {
  const tileForPixel = createGetTileForCoordinate(image);
  const pool = new Pool();
  image.tiles = {};

  return {
    async getDepthTile(
      imageCoordinate: [number, number],
    ): Promise<ReadRasterResult> {
      const { pixelX, pixelY } = tileForPixel(imageCoordinate);
      return image.readRasters({
        window: [pixelX - 3, pixelY - 3, pixelX + 3, pixelY + 3],
        pool,
      });
    },
    destroy(): void {
      image.tiles = null;
    },
  };
}

function interpolate(
  value: number,
  min = 0,
  max = 50,
  minValue = 0,
  maxValue = 255,
): number {
  return min + ((value - minValue) / (maxValue - minValue)) * (max - min);
}

export async function createPanoramaDepth(
  url: string,
  position: Cartesian3,
  modelMatrix: Matrix4,
): Promise<PanoramaDepth> {
  const geotiff = await fromUrl(url, { cache: true });
  const imageCount = await geotiff.getImageCount();
  if (imageCount !== 1) {
    throw new Error('Depth image must have exactly one image');
  }
  const highResImage = await geotiff.getImage(0);
  const tileProvider = createDepthTileProvider(highResImage);

  return {
    async getPositionAtImageCoordinate(
      imageCoordinate: [number, number],
      result?: Cartesian3,
    ): Promise<Cartesian3 | undefined> {
      const tile = await tileProvider.getDepthTile(imageCoordinate);
      const data = tile[0] as Uint8Array;
      const depthValue =
        data.reduce(
          (prev: number, curr: number) => prev + interpolate(curr),
          0,
        ) / data.length;
      if (depthValue === 0) {
        return undefined;
      }
      const cartesian = sphericalToCartesian(imageCoordinate, result);
      Cartesian3.normalize(cartesian, cartesian);
      Cartesian3.multiplyByScalar(cartesian, depthValue, cartesian);
      Matrix4.multiplyByPoint(modelMatrix, cartesian, cartesian);
      return cartesian;
    },
    destroy(): void {
      tileProvider.destroy();
      geotiff.close();
    },
  };
}
