import { Cartesian3, Math as CesiumMath } from '@vcmap-cesium/engine';
import { BaseDecoder, fromUrl, GeoTIFFImage } from 'geotiff';
import LRUCache from 'ol/structs/LRUCache.js';
import { sphericalToCartesian } from './sphericalCoordinates.js';

export type PanoramaDepth = {
  getPositionAtImageCoordinate(
    imageCoordinate: [number, number],
  ): Promise<Cartesian3 | undefined>;
  destroy(): void;
};

type DepthTile = {
  x: number;
  y: number;
  pixelOffset: number;
  data: ArrayBuffer;
};

type PanoramaDepthTileProvider = {
  getDepthTile(imageCoordinate: [number, number]): Promise<DepthTile>;
  destroy(): void;
};

type GetTileForCoordinate = (imageCoordinate: [number, number]) => {
  x: number;
  y: number;
  pixelOffset: number;
};

function createGetTileForCoordinate(image: GeoTIFFImage): GetTileForCoordinate {
  const width = image.getWidth();
  const radiansPerPixel = CesiumMath.TWO_PI / width;

  const tileWidth = image.getTileWidth();
  const tileHeight = image.getTileHeight();

  return ([phi, theta]) => {
    const pixelX = phi * radiansPerPixel;
    const pixelY = theta * radiansPerPixel;
    const tileX = Math.floor(pixelX / tileWidth);
    const tileY = Math.floor(pixelY / tileHeight);
    const pixelOffset = (pixelX % tileWidth) + (pixelY % tileHeight);
    return {
      x: tileX,
      y: tileY,
      pixelOffset,
    };
  };
}

function createDepthTileProvider(
  image: GeoTIFFImage,
): PanoramaDepthTileProvider {
  const tileForPixel = createGetTileForCoordinate(image);
  const cache = new LRUCache<ArrayBuffer>();

  return {
    async getDepthTile(imageCoordinate: [number, number]): Promise<DepthTile> {
      const { x, y, pixelOffset } = tileForPixel(imageCoordinate);
      const cacheKey = `${x}/${y}`;
      let data;
      if (cache.containsKey(cacheKey)) {
        data = cache.get(cacheKey)!;
      } else {
        ({ data } = await image.getTileOrStrip(x, y, 0, {
          decode: (_f, d) => Promise.resolve(d),
        } as BaseDecoder));
        cache.set(cacheKey, data);
        cache.expireCache();
      }

      return { x, y, pixelOffset, data };
    },
    destroy(): void {
      cache.clear();
    },
  };
}

function getDepthValue(data: ArrayBuffer, pixelOffset: number): number {
  const view = new DataView(data);
  return view.getUint8(pixelOffset);
}

export async function createPanoramaDepth(
  url: string,
  position: Cartesian3,
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
    ): Promise<Cartesian3 | undefined> {
      const tile = await tileProvider.getDepthTile(imageCoordinate);
      const depthValue = getDepthValue(tile.data, tile.pixelOffset);
      if (depthValue === 0) {
        return undefined;
      }
      const cartesian = sphericalToCartesian(imageCoordinate);
      Cartesian3.normalize(cartesian, cartesian);
      Cartesian3.multiplyByScalar(cartesian, depthValue, cartesian);
      return Cartesian3.add(cartesian, position, cartesian);
    },
    destroy(): void {
      tileProvider.destroy();
      geotiff.close();
    },
  };
}
