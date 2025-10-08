/* eslint-disable no-underscore-dangle */
import { fromFile } from 'geotiff';
import { ScreenSpaceEventHandler } from '@vcmap-cesium/engine';
import PanoramaMap from '../../../src/map/panoramaMap.js';
import { getMockCesiumWidget } from './cesiumHelpers.js';
import { createPanoramaImageView } from '../../../src/panorama/panoramaImageView.js';
import { createPanoramaCameraController } from '../../../src/panorama/panoramaCameraController.js';
import { createPanoramaImage } from '../../../src/panorama/panoramaImage.js';

/**
 * @param {import("../../../src/map/panoramaMap").PanoramaMapOptions} options
 * @returns {PanoramaMap}
 */
export function getPanoramaMap(options = {}) {
  const map = new PanoramaMap(options);
  const cesiumWidget = getMockCesiumWidget();
  const { scene } = cesiumWidget;
  map._cesiumWidget = cesiumWidget;

  scene.screenSpaceCameraController.enableInputs = false;
  scene.primitives.destroyPrimitives = false;

  map.screenSpaceEventHandler = new ScreenSpaceEventHandler(
    cesiumWidget.canvas,
  );

  map._imageView = createPanoramaImageView(map);
  map._cameraController = createPanoramaCameraController(map);

  map.initialized = true;
  return map;
}

/**
 * @returns {import("../../../src/panorama/panoramaTileProvider.js").PanoramaImageDecoder}
 */
export function createTestingDecoder() {
  return {
    decode(fileDirectory, arrayBuffer) {
      if (fileDirectory.vcsPanorama.type === 'depth') {
        const depthData = new Uint16Array(arrayBuffer);
        const result = new Float32Array(depthData.length);

        for (let i = 0; i < depthData.length; i++) {
          result[i] = depthData[i] / 65535; // Normalize to [0, 1]
        }

        return result;
      }
      return global.createImageBitmap(new Blob([arrayBuffer]), 0, 0, 64, 64);
    },
  };
}

/**
 * @param {{
 *  dataset?: import("../../../src/panorama/panoramaDataset").default,
 *  absoluteRootUrl?: string,
 *  name?: string,
 *  fileName?: string,
 *  depth?: boolean,
 * }}
 * @returns {Promise<{ panoramaImage: import("../../../src/panorama/panoramaImage.js").PanoramaImage, destroy: () => void }>}
 */
export async function getPanoramaImage({
  dataset,
  absoluteRootUrl,
  name,
  fileName = 'testRgbGeotiff.tif',
  depth = false,
} = {}) {
  const image = await fromFile(`tests/data/panorama/${fileName}`);
  let depthImage;
  if (depth) {
    depthImage = await fromFile(`tests/data/panorama/testDepthGeotiff.tif`);
  }
  const panoramaImage = await createPanoramaImage(image, {
    depthImage,
    dataset,
    absoluteRootUrl,
    name,
    poolOrDecoder: createTestingDecoder(),
  });

  return {
    panoramaImage,
    destroy() {
      panoramaImage.destroy();
      image.close();
      depthImage?.close();
    },
  };
}
