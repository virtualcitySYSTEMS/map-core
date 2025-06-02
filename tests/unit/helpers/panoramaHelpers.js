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

  map._screenSpaceEventHandler = new ScreenSpaceEventHandler(
    cesiumWidget.canvas,
  );

  map._imageView = createPanoramaImageView(map);
  map._cameraController = createPanoramaCameraController(map);

  map.initialized = true;
  return map;
}

/**
 * @param {import("../../../src/panorama/panoramaDataset").default} [dataset]
 * @param {string} [absoluteUrl]
 * @param {string} [name]
 * @returns {Promise<{ panoramaImage: import("../../../src/panorama/panoramaImage.js").PanoramaImage, destroy: () => void }>}
 */
export async function getPanoramaImage(dataset, absoluteUrl, name) {
  const image = await fromFile('tests/data/panorama/badOrientation.tif');
  const panoramaImage = await createPanoramaImage(
    image,
    dataset,
    absoluteUrl,
    name,
  );

  return {
    panoramaImage,
    destroy() {
      panoramaImage.destroy();
      image.close();
    },
  };
}
