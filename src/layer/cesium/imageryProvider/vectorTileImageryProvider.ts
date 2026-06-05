import { type Cartographic } from '@vcmap-cesium/engine';
import { getLogger } from '@vcsuite/logger';
import {
  compose,
  create as createTransform,
  scale as scaleTransform,
} from 'ol/transform.js';
import { type Extent, getCenter } from 'ol/extent.js';
import type { Coordinate } from 'ol/coordinate.js';
import type { Size } from 'ol/size.js';
import type { Feature } from 'ol/index.js';
// eslint-disable-next-line import/no-named-default
import type { default as Style, StyleFunction } from 'ol/style/Style.js';
import type TileProvider from '../../tileProvider/tileProvider.js';
import CanvasTileRenderer from '../../../ol/render/canvas/canvasTileRenderer.js';
import { rectangleToMercatorExtent } from '../../../util/math.js';
import AbstractVcsImageryProvider from './abstractVcsImageryProvider.js';

export function toContext(
  extent: Extent,
  center: Coordinate,
  context: CanvasRenderingContext2D,
  tileSize: Size,
): CanvasTileRenderer {
  const { canvas } = context;
  canvas.width = tileSize[0];
  canvas.height = tileSize[1];
  canvas.style.width = `${tileSize[0]}px`;
  canvas.style.height = `${tileSize[1]}px`;
  const scaleY = (extent[2] - extent[0]) / (extent[3] - extent[1]);
  const sx = 1 / ((extent[2] - extent[0]) / 256);
  const sy = -1 / ((extent[3] - extent[1]) / 256);
  const transform = scaleTransform(createTransform(), 1, 1);
  const newTransform = compose(
    transform,
    128,
    128,
    sx,
    sy,
    0,
    -center[0],
    -center[1],
  );

  return new CanvasTileRenderer(
    context,
    1,
    extent,
    newTransform,
    0,
    undefined,
    undefined,
    scaleY,
  );
}

/**
 * creates a canvas and draws the features on the canvas;
 * @param features
 * @param extent
 * @param deprecatedCenter deprecated, center is taken from the extent
 * @param tileSize
 * @returns a canvas with the features drawn on it
 */
export function getCanvasFromFeatures(
  features: Feature[],
  extent: Extent,
  deprecatedCenter: Cartographic | undefined,
  tileSize: Size,
): HTMLCanvasElement {
  if (deprecatedCenter) {
    getLogger('VectorTileImageryProvider').deprecate(
      'getCanvasFromFeatures',
      'getCanvasFromFeatures no longer requires a center, it is taken from the extent',
    );
  }
  const canvas = document.createElement('canvas');
  canvas.width = tileSize[0];
  canvas.height = tileSize[1];
  const vectorContext = toContext(
    extent,
    getCenter(extent),
    canvas.getContext('2d') as CanvasRenderingContext2D,
    tileSize,
  );

  features.forEach((feature) => {
    const styleFunction = feature.getStyleFunction() as StyleFunction;
    const featureStyles = styleFunction(feature, 1) as Style[];
    featureStyles.forEach((styleToUse) => {
      vectorContext.drawFeature(feature, styleToUse);
    });
  });

  return canvas;
}

export type VectorTileImageryProviderOptions = {
  tileProvider: TileProvider;
  tileSize: Size;
  headers?: Record<string, string>;
};

/**
 * implementation of Cesium ImageryProvider Interface
 */
class VectorTileImageryProvider extends AbstractVcsImageryProvider {
  tileProvider: TileProvider;

  // eslint-disable-next-line @typescript-eslint/naming-convention
  _reload: undefined | (() => void) = undefined;

  constructor(options: VectorTileImageryProviderOptions) {
    super({
      tilingScheme: options.tileProvider.tilingScheme,
      tileSize: options.tileSize,
      headers: options.headers,
      minLevel: 0,
      maxLevel: 26,
    });
    this.tileProvider = options.tileProvider;
  }

  /**
   * Requests the image for a given tile.  This function should
   * not be called before  returns true.
   *
   * @param  x The tile X coordinate.
   * @param  y The tile Y coordinate.
   * @param  level The tile level.
   * @returns  A promise for the image that will resolve when the image is available, or
   *          undefined if there are too many active requests to the server, and the request
   *          should be retried later.  The resolved image may be either an
   *          Image or a Canvas DOM object.
   */
  async requestImage(
    x: number,
    y: number,
    level: number,
    // @ts-expect-error returns undefined if there are too many active requests
  ): Promise<HTMLImageElement | HTMLCanvasElement> | undefined {
    const features = await this.tileProvider.getFeaturesForTile(
      x,
      y,
      level,
      this.headers,
    );
    if (features.length === 0) {
      return this.emptyCanvas;
    }
    const rectangle = this.tileProvider.tilingScheme.tileXYToRectangle(
      x,
      y,
      level,
    );
    const extent = rectangleToMercatorExtent(rectangle);

    return getCanvasFromFeatures(features, extent, undefined, [
      this.tileWidth,
      this.tileHeight,
    ]);
  }
}

export default VectorTileImageryProvider;
