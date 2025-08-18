import type { Size } from 'ol/size.js';
import { getLogger } from '@vcsuite/logger';
import CesiumMap from '../map/cesiumMap.js';
import OpenlayersMap from '../map/openlayersMap.js';
import ObliqueMap from '../map/obliqueMap.js';
import PanoramaMap from '../map/panoramaMap.js';
import type VcsApp from '../vcsApp.js';
/**
 * Prepares the cesium map for the screenshot
 * @param map - The cesium map
 * @param scale - The factor to scale the map according to the required resolution
 * @returns The function to reset the applied scale.
 */
function prepareCesiumMap(
  map: CesiumMap | PanoramaMap,
  scale: number,
): () => void {
  const viewer = map.getCesiumWidget()!;
  const { resolutionScale } = viewer;
  viewer.resolutionScale = scale;

  return function resetCesiumMap() {
    viewer.resolutionScale = resolutionScale;
  };
}

/**
 * Returns a function to reset the OLMap to the original state.
 * @param map - The map instance.
 * @param renderSize - The size to set for rendering.
 * @returns The function to reset the map.
 */
function prepareOlMap(
  map: OpenlayersMap | ObliqueMap,
  renderSize: Size,
): () => void {
  const { olMap } = map;
  if (olMap) {
    const olSize = olMap.getSize();
    const extent = olMap.getView().calculateExtent(olSize);
    const originalMinZoom = olMap.getView().getMinZoom();
    const originalMaxZoom = olMap.getView().getMaxZoom();
    olMap.setSize(renderSize);
    olMap.getView().setMinZoom(0);
    olMap.getView().setMaxZoom(28);
    olMap.getView().fit(extent, { size: renderSize });
    olMap.set('vcs_scale', renderSize, true);

    return function resetOlMap() {
      olMap.setSize(olSize);
      olMap.getView().setMinZoom(originalMinZoom);
      olMap.getView().setMaxZoom(originalMaxZoom);
      olMap.getView().fit(extent, { size: olSize });
      olMap.unset('vcs_scale', true);
      olMap.renderSync();
    };
  }
  return () => {};
}

/**
 * Copies Cesium content on the given canvas.
 * @param map - The Cesium map instance.
 * @returns A promise that resolves to the canvas element.
 */
async function getImageFromCesium(
  map: CesiumMap | PanoramaMap,
): Promise<HTMLCanvasElement> {
  const { scene } = map.getCesiumWidget()!;

  return new Promise((resolve) => {
    const removePreListener = scene.preUpdate.addEventListener(() => {
      const { canvas } = scene;
      const removePostListener = scene.postRender.addEventListener(() => {
        resolve(canvas);
        removePostListener();
      });
      removePreListener();
    });
  });
}

/**
 * Copies Openlayers content on the given canvas
 * @param map - The map instance.
 * @param canvasSize - The size of the canvas.
 * @returns A promise that resolves to the canvas element.
 */
async function getImageFromOpenlayers(
  map: OpenlayersMap | ObliqueMap,
  canvasSize: Size,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize[0];
  canvas.height = canvasSize[1];
  const { olMap } = map;
  const canvasContext = canvas.getContext('2d')!;
  // fill canvas with white so transparent pixels are not printed as black when exporting as jpeg.
  canvasContext.fillStyle = 'white';
  canvasContext.fillRect(0, 0, canvas.width, canvas.height);
  await new Promise<void>((resolve) => {
    if (olMap) {
      olMap.once('rendercomplete', () => {
        const olLayerCanvasList = Array.from(
          olMap
            .getViewport()
            .querySelectorAll<HTMLCanvasElement>('.ol-layer canvas'),
        );
        olLayerCanvasList.forEach((layerCanvas) => {
          if (layerCanvas.width > 0) {
            const opacity =
              (layerCanvas.parentNode instanceof HTMLElement
                ? layerCanvas.parentNode.style.opacity
                : '') || layerCanvas.style.opacity;
            canvasContext.globalAlpha = opacity === '' ? 1 : Number(opacity);
            const { transform } = layerCanvas.style;
            const matrix = transform
              .match(/^matrix\(([^(]*)\)$/)?.[1]
              .split(',')
              .map(Number) as
              | [number, number, number, number, number, number]
              | undefined;
            if (matrix) {
              canvasContext.setTransform(...matrix);
            }
            canvasContext.drawImage(layerCanvas, 0, 0);
          }
        });
        resolve();
      });
    }
  });
  return canvas;
}

/**
 * Renders a screenshot of the active map in the VcsApp.
 *
 * @param app - The VcsApp instance containing the active map.
 * @param width - The desired width of the screenshot.
 * @returns A promise that resolves to the canvas element containing the screenshot.
 */
export default async function renderScreenshot(
  app: VcsApp,
  width: number,
): Promise<HTMLCanvasElement> {
  let screenshotCanvas: HTMLCanvasElement;

  function calcRenderSize(mapSize: Size, screenshotWidth: number): Size {
    const aspectRatio = mapSize[0] / mapSize[1];
    return [screenshotWidth, screenshotWidth / aspectRatio];
  }

  function checkChromeMaxPixel(renderSize: Size, threshold: number): void {
    const totalPixelCount = renderSize[0] * renderSize[1];
    if (totalPixelCount > threshold && 'chrome' in window) {
      getLogger('@vcmap/print').warning(
        `The created image might have black bars at some of the edges. This is due to a behavior of chromium based browsers
        that occurs when the total pixel count of the cesium map exceeds a threshold of thirty-three million pixels.
        In order to avoid this either reduce the resolution or switch to Mozilla Firefox browser.`,
      );
    }
  }
  /**
   * Function for resetting map after screenshot processes finished.
   */
  let resetMap: () => void;
  const map = app.maps.activeMap;

  if (map instanceof CesiumMap || map instanceof PanoramaMap) {
    const { canvas } = map.getCesiumWidget()!.scene;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // check if render size is above chromium threshold
    checkChromeMaxPixel(
      calcRenderSize([canvasWidth, canvasHeight], width),
      33000000,
    );
    const scale = width / canvasWidth;
    resetMap = prepareCesiumMap(map, scale);
    screenshotCanvas = await getImageFromCesium(map);
  } else if (map instanceof OpenlayersMap || map instanceof ObliqueMap) {
    const biggestCanvas = Array.from(
      map
        .olMap!.getViewport()
        .querySelectorAll<HTMLCanvasElement>('.ol-layer canvas'),
    ).reduce((acc, val) => (acc.width > val.width ? val : acc));
    const canvasWidth = biggestCanvas.width;
    const canvasHeight = biggestCanvas.height;
    const renderSize = calcRenderSize([canvasWidth, canvasHeight], width);
    resetMap = prepareOlMap(map, renderSize);
    screenshotCanvas = await getImageFromOpenlayers(map, renderSize);
  } else {
    throw new Error('Current map type is not supported');
  }
  resetMap();
  return screenshotCanvas;
}
