import {
  Event as CesiumEvent,
  Rectangle,
  Math as CesiumMath,
  type Cartographic,
  type TilingScheme,
} from '@vcmap-cesium/engine';
import {
  compose,
  create as createTransform,
  scale as scaleTransform,
} from 'ol/transform.js';
import type { Extent } from 'ol/extent.js';
import type { Coordinate } from 'ol/coordinate.js';
import type { Size } from 'ol/size.js';
import type { Feature } from 'ol/index.js';
// eslint-disable-next-line import/no-named-default
import type { default as Style, StyleFunction } from 'ol/style/Style.js';
import TileProvider, {
  rectangleToExtent,
} from '../tileProvider/tileProvider.js';
import { wgs84ToMercatorTransformer } from '../../util/projection.js';
import CanvasTileRenderer from '../../ol/render/canvas/canvasTileRenderer.js';

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
 */
export function getCanvasFromFeatures(
  features: Feature[],
  extent: Extent,
  center: Cartographic,
  tileSize: Size,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = tileSize[0];
  canvas.height = tileSize[0];
  const centerMercator = wgs84ToMercatorTransformer([
    CesiumMath.toDegrees(center.longitude),
    CesiumMath.toDegrees(center.latitude),
  ]);
  const vectorContext = toContext(
    extent,
    centerMercator,
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
class VectorTileImageryProvider {
  tileProvider: TileProvider;

  private _tilingScheme: TilingScheme;

  private _tileSize: Size;

  private _errorEvent = new CesiumEvent();

  headers?: Record<string, string>;

  emptyCanvas: HTMLCanvasElement;

  minLevel = 0;

  maxLevel = 26;

  _reload: undefined | (() => void) = undefined;

  constructor(options: VectorTileImageryProviderOptions) {
    this.tileProvider = options.tileProvider;
    this._tilingScheme = this.tileProvider.tilingScheme;
    this._tileSize = options.tileSize;
    this._errorEvent = new CesiumEvent();

    this.emptyCanvas = document.createElement('canvas');
    this.emptyCanvas.width = this.tileWidth;
    this.emptyCanvas.height = this.tileHeight;
    this.headers = options.headers;
  }

  // eslint-disable-next-line class-methods-use-this
  get _ready(): boolean {
    return true;
  }

  // eslint-disable-next-line class-methods-use-this
  get ready(): boolean {
    return true;
  }

  get rectangle(): Rectangle {
    return this._tilingScheme.rectangle;
  }

  get tileWidth(): number {
    return this._tileSize[0];
  }

  get tileHeight(): number {
    return this._tileSize[1];
  }

  get maximumLevel(): number {
    return this.maxLevel;
  }

  get minimumLevel(): number {
    return this.minLevel;
  }

  get tilingScheme(): TilingScheme {
    return this._tilingScheme;
  }

  // eslint-disable-next-line class-methods-use-this
  get tileDiscardPolicy(): undefined {
    return undefined;
  }

  get errorEvent(): CesiumEvent {
    return this._errorEvent;
  }

  // eslint-disable-next-line class-methods-use-this
  get credit(): undefined {
    return undefined;
  }

  // eslint-disable-next-line class-methods-use-this
  get proxy(): undefined {
    return undefined;
  }

  // eslint-disable-next-line class-methods-use-this
  get hasAlphaChannel(): boolean {
    return true;
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
  ): Promise<HTMLImageElement | HTMLCanvasElement> {
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
    const extent = rectangleToExtent(rectangle);
    const center = Rectangle.center(rectangle);
    return getCanvasFromFeatures(features, extent, center, this._tileSize);
  }
}

export default VectorTileImageryProvider;
