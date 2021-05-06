import CesiumEvent from '@vcmap/cesium/Source/Core/Event.js';
import { DEVICE_PIXEL_RATIO } from 'ol/has.js';
import { compose, create as createTransform, scale as scaleTransform } from 'ol/transform.js';
import Rectangle from '@vcmap/cesium/Source/Core/Rectangle.js';
import CesiumMath from '@vcmap/cesium/Source/Core/Math.js';
import { rectangleToExtent } from '../tileProvider/tileProvider.js';
import { wgs84ToMercatorTransformer } from '../../util/projection.js';
import CanvasTileRenderer from '../../../../ol/render/canvas/canvasTileRenderer.js';

/**
 * @param {ol/Extent} extent
 * @param {ol/Coordinate} center
 * @param {Object} context
 * @param {ol/Size} tileSize
 * @returns {ol/CanvasTileRenderer}
 */
export function toContext(extent, center, context, tileSize) {
  const { canvas } = context;
  const pixelRatio = DEVICE_PIXEL_RATIO;
  canvas.width = tileSize[0] * pixelRatio;
  canvas.height = tileSize[1] * pixelRatio;
  canvas.style.width = `${tileSize[0] }px`;
  canvas.style.height = `${tileSize[1] }px`;
  const scaleY = (extent[2] - extent[0]) / (extent[3] - extent[1]);
  const sx = pixelRatio / ((extent[2] - extent[0]) / 256);
  const sy = -pixelRatio / ((extent[3] - extent[1]) / 256);
  const transform = scaleTransform(createTransform(), pixelRatio, pixelRatio);
  const newTransform = compose(transform, 128, 128, sx, sy, 0, -center[0], -center[1]);
  // @ts-ignore
  return new CanvasTileRenderer(context, pixelRatio, extent, newTransform, 0, null, null, scaleY);
}


/**
 * creates a canvas and draws the features on the canvas;
 * @param {Array<ol/Feature>} features
 * @param {ol/Extent} extent
 * @param {Cesium/Cartographic} center
 * @param {ol/Size} tileSize
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
    const featureStyles = /** @type {Array<ol/style/Style>} */(styleFunction(feature, 1));
    featureStyles.forEach((styleToUse) => {
      vectorContext.drawFeature(feature, styleToUse);
    });
  });
  return canvas;
}

/**
 * @typedef {Object} vcs.vcm.layer.cesium.VectorTileImageryProvider.Options
 * @property {vcs.vcm.layer.tileProvider.TileProvider} tileProvider
 * @property {ol/Size} tileSize
 * @api
 */

/**
 * implementation of Cesium ImageryProvider Interface
 * @class
 * @export
 * @memberOf vcs.vcm.layer.cesium
 */
class VectorTileImageryProvider {
  /**
   * @param {vcs.vcm.layer.cesium.VectorTileImageryProvider.Options} options
   */
  constructor(options) {
    /**
     * @type {vcs.vcm.layer.tileProvider.TileProvider}
     */
    this.tileProvider = options.tileProvider;

    /**
     * @type {Cesium/WebMercatorTilingScheme}
     * @private
     */
    this._tilingScheme = this.tileProvider.tilingScheme;

    /**
     * @type {ol/Size}
     * @private
     */
    this._tileSize = options.tileSize;

    /**
     * @type {Cesium/Event}
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
   * @returns {Cesium/Rectangle}
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
   * @returns {Cesium/TilingScheme}
   */
  get tilingScheme() {
    return this._tilingScheme;
  }

  // eslint-disable-next-line class-methods-use-this
  get tileDiscardPolicy() {
    return undefined;
  }

  /**
   * @returns {Cesium/Event}
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
   * @returns {Promise.<HTMLImageElement|HTMLCanvasElement>|undefined} A promise for the image that will resolve when the image is available, or
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
