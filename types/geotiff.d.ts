import type { PanoramaResourceType } from '../src/panorama/panoramaTileProvider.js';

declare module 'geotiff' {
  interface Pool {
    bindParameters(
      decoderId: number,
      parameters: { vcsPanoramaType: PanoramaResourceType },
    ): DecoderWorker;
  }
}
