import { Event as CesiumEvent, Rectangle, Math as CesiumMath } from '@vcmap/cesium';
import { compose, create as createTransform, scale as scaleTransform } from 'ol/transform.js';
import { rectangleToExtent } from '../tileProvider/tileProvider.js';
import { wgs84ToMercatorTransformer } from '../../util/projection.js';
import CanvasTileRenderer from '../../ol/render/canvas/canvasTileRenderer.js';

/**
 * @param {import("ol/extent").Extent} extent
 * @param {import("ol/coordinate").Coordinate} center
 * @param {Object} context
 * @param {import("ol/size").Size} tileSize
 * @returns {import("ol").CanvasTileRenderer}
 */
export function toContext(extent, center, context, tileSize) {
  const { canvas } = context;
  canvas.width = tileSize[0];
  canvas.height = tileSize[1];
  canvas.style.width = `${tileSize[0] }px`;
  canvas.style.height = `${tileSize[1] }px`;
  const scaleY = (extent[2] - extent[0]) / (extent[3] - extent[1]);
  const sx = 1 / ((extent[2] - extent[0]) / 256);
  const sy = -1 / ((extent[3] - extent[1]) / 256);
  const transform = scaleTransform(createTransform(), 1, 1);
  const newTransform = compose(transform, 128, 128, sx, sy, 0, -center[0], -center[1]);
  // @ts-ignore
  return new CanvasTileRenderer(context, 1, extent, newTransform, 0, null, null, scaleY);
}


/**
 * creates a canvas and draws the features on the canvas;
 * @param {Array<import("ol").Feature<import("ol/geom/Geometry").default>>} features
 * @param {import("ol/extent").Extent} extent
 * @param {import("@vcmap/cesium").Cartographic} center
 * @param {import("ol/size").Size} tileSize
 * @returns {HTMLCanvasElement}
 */
export function getCanvasFromFeatures(features, extent, center, tileSize) {
  const canvas = document.createElement('canvas');
  canvas.width = tileSize[0];
  canvas.height = tileSize[0];
  const centerMercator =
    wgs84ToMercatorTransformer([CesiumMath.toDegrees(center.longitude), CesiumMath.toDegrees(center.latitude)]);
  const vectorContext = toContext(extent, centerMercator, canvas.getContext('2d'), tileSize);

  features.forEach((feature) => {
    const styleFunction = feature.getStyleFunction();
    const featureStyles = /** @type {Array<import("ol/style/Style").default>} */(styleFunction(feature, 1));
    featureStyles.forEach((styleToUse) => {
      // @ts-ignore
      vectorContext.drawFeature(feature, styleToUse);
    });
  });
  return canvas;
}

/**
 * @typedef {Object} VectorTileImageryProviderOptions
 * @property {import("@vcmap/core").TileProvider} tileProvider
 * @property {import("ol/size").Size} tileSize
 * @api
 */

/**
 * implementation of Cesium ImageryProvider Interface
 * @class
 * @export
 */
class VectorTileImageryProvider {
  /**
   * @param {VectorTileImageryProviderOptions} options
   */
  constructor(options) {
    /**
     * @type {import("@vcmap/core").TileProvider}
     */
    this.tileProvider = options.tileProvider;

    /**
     * @type {import("@vcmap/cesium").WebMercatorTilingScheme}
     * @private
     */
    this._tilingScheme = this.tileProvider.tilingScheme;

    /**
     * @type {import("ol/size").Size}
     * @private
     */
    this._tileSize = options.tileSize;

    /**
     * @type {import("@vcmap/cesium").Event}
     * @private
     */
    this._errorEvent = new CesiumEvent();

    /**
     * @type {Promise<boolean>}
     * @private
     */
    this._readyPromise = Promise.resolve(true);

    /**
     * @type {HTMLCanvasElement}
     */
    this.emptyCanvas = document.createElement('canvas');
    this.emptyCanvas.width = this.tileWidth;
    this.emptyCanvas.height = this.tileHeight;


    /**
     * @type {number}
     */
    this.minLevel = 0;
    /**
     * @type {number}
     */
    this.maxLevel = 26;

    /**
     * @type {Function}
     */
    this._reload = undefined;

    // Necessary to satisfy Cesium ImageryProvider Interface
    this.defaultAlpha = undefined;
    this.defaultNightAlpha = undefined;
    this.defaultDayAlpha = undefined;
    this.defaultBrightness = undefined;
    this.defaultContrast = undefined;
    this.defaultHue = undefined;
    this.defaultSaturation = undefined;
    this.defaultGamma = undefined;
    this.defaultMinificationFilter = undefined;
    this.defaultMagnificationFilter = undefined;
  }

  /**
   * @returns {boolean}
   */
  // eslint-disable-next-line class-methods-use-this
  get ready() {
    return true;
  }

  /**
   * @returns {Promise<boolean>}
   */
  get readyPromise() {
    return this._readyPromise;
  }

  /**
   * @returns {import("@vcmap/cesium").Rectangle}
   */
  get rectangle() {
    return this._tilingScheme.rectangle;
  }

  /**
   * @returns {number}
   */
  get tileWidth() {
    return this._tileSize[0];
  }

  /**
   * @returns {number}
   */
  get tileHeight() {
    return this._tileSize[1];
  }

  /**
   * @returns {number}
   */
  get maximumLevel() {
    return this.maxLevel;
  }

  /**
   * @returns {number}
   */
  get minimumLevel() {
    return this.minLevel;
  }

  /**
   * @returns {import("@vcmap/cesium").TilingScheme}
   */
  get tilingScheme() {
    return this._tilingScheme;
  }

  // eslint-disable-next-line class-methods-use-this
  get tileDiscardPolicy() {
    return undefined;
  }

  /**
   * @returns {import("@vcmap/cesium").Event}
   */
  get errorEvent() {
    return this._errorEvent;
  }

  // eslint-disable-next-line class-methods-use-this
  get credit() {
    return undefined;
  }

  // eslint-disable-next-line class-methods-use-this
  get proxy() {
    return undefined;
  }

  // eslint-disable-next-line class-methods-use-this
  get hasAlphaChannel() {
    return true;
  }

  /**
   * Requests the image for a given tile.  This function should
   * not be called before {@link TileCoordinatesImageryProvider#ready} returns true.
   *
   * @param {number} x The tile X coordinate.
   * @param {number} y The tile Y coordinate.
   * @param {number} level The tile level.
   * @returns {Promise<HTMLImageElement|HTMLCanvasElement>} A promise for the image that will resolve when the image is available, or
   *          undefined if there are too many active requests to the server, and the request
   *          should be retried later.  The resolved image may be either an
   *          Image or a Canvas DOM object.
   */
  async requestImage(x, y, level) {
    const features = await this.tileProvider.getFeaturesForTile(x, y, level);
    if (features.length === 0) {
      return this.emptyCanvas;
    }
    const rectangle = this.tileProvider.tilingScheme.tileXYToRectangle(x, y, level);
    const extent = rectangleToExtent(rectangle);
    const center = Rectangle.center(rectangle);
    return getCanvasFromFeatures(features, extent, center, this._tileSize);
  }
}

export default VectorTileImageryProvider;
