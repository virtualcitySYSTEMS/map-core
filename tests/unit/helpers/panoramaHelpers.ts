/* eslint-disable no-underscore-dangle */
import type GeoTIFF from 'geotiff';
import { fromFile, BaseDecoder } from 'geotiff';
import { ScreenSpaceEventHandler } from '@vcmap-cesium/engine';
import type { PanoramaMapOptions } from '../../../src/map/panoramaMap.js';
import PanoramaMap from '../../../src/map/panoramaMap.js';
import { getMockCesiumWidget } from './cesiumHelpers.js';
import { createPanoramaImageView } from '../../../src/panorama/panoramaImageView.js';
import { createPanoramaCameraController } from '../../../src/panorama/panoramaCameraController.js';
import type { PanoramaImage } from '../../../src/panorama/panoramaImage.js';
import { createPanoramaImage } from '../../../src/panorama/panoramaImage.js';
import type PanoramaDatasetLayer from '../../../src/layer/panoramaDatasetLayer.js';

export class TestingDecoder extends BaseDecoder {
  constructor() {
    super({
      tileWidth: 1,
      tileHeight: 1,
      predictor: 1,
      bitsPerSample: [16],
      planarConfiguration: 1,
      samplesPerPixel: 1,
    });
  }

  // eslint-disable-next-line class-methods-use-this
  decode(slice: ArrayBuffer): Promise<ArrayBufferLike> {
    const depthData = new Uint16Array(slice);
    const result = new Float32Array(depthData.length);

    for (let i = 0; i < depthData.length; i++) {
      result[i] = depthData[i] / 65535;
    }
    return Promise.resolve(result as unknown as ArrayBufferLike);
  }
}

export function getPanoramaMap(options: PanoramaMapOptions = {}): PanoramaMap {
  const map = new PanoramaMap(options);
  const cesiumWidget = getMockCesiumWidget();
  const { scene } = cesiumWidget;
  // @ts-expect-error access to private property
  map._cesiumWidget = cesiumWidget;

  scene.screenSpaceCameraController.enableInputs = false;
  scene.primitives.destroyPrimitives = false;

  map.screenSpaceEventHandler = new ScreenSpaceEventHandler(
    cesiumWidget.canvas,
  );

  // @ts-expect-error access to private property
  map._imageView = createPanoramaImageView(map);
  // @ts-expect-error access to private property
  map._cameraController = createPanoramaCameraController(map);

  map.initialized = true;
  return map;
}

export async function getPanoramaImage({
  dataset,
  absoluteRootUrl,
  name,
  fileName = 'testRgbGeotiff.tif',
  depth = false,
}: {
  dataset?: PanoramaDatasetLayer;
  absoluteRootUrl?: string;
  name?: string;
  fileName?: string;
  depth?: boolean;
} = {}): Promise<{
  panoramaImage: PanoramaImage;
  destroy: () => void;
}> {
  const image = await fromFile(`tests/data/panorama/${fileName}`);
  let depthImage: GeoTIFF | undefined;
  if (depth) {
    depthImage = await fromFile(`tests/data/panorama/testDepthGeotiff.tif`);
  }
  const panoramaImage = await createPanoramaImage(image, {
    depthImage,
    dataset,
    absoluteRootUrl,
    name,
    poolOrDecoder: new TestingDecoder(),
  });

  return {
    panoramaImage,
    destroy(): void {
      panoramaImage.destroy();
      const promises = [];
      promises.push(image.close(), depthImage?.close());
      Promise.all(promises.filter((p): p is Promise<void> => !!p)).catch(
        () => {},
      );
    },
  };
}
