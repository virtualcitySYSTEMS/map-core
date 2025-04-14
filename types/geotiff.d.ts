import type { BaseDecoder, Pool } from 'geotiff';

declare module 'geotiff' {
  interface GeoTIFFImage {
    getTileOrStrip(
      x: number,
      y: number,
      samplesPerPixel: number,
      decoder: BaseDecoder | Pool,
      abortSignal?: AbortSignal,
    ): Promise<{ x: number; y: number; sample: number; data: ArrayBuffer }>;
  }
}
