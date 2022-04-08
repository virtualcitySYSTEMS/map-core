import { SplitDirection, WebMercatorTilingScheme, GeographicTilingScheme, Cartographic } from '@vcmap/cesium';
import { getBottomLeft, getBottomRight, getTopLeft, getTopRight } from 'ol/extent.js';

import { parseInteger, parseNumberRange, parseEnumValue } from '@vcsuite/parsers';
import { wgs84Projection } from '../util/projection.js';
import Layer from './layer.js';
import VcsEvent from '../vcsEvent.js';
import Extent from '../util/extent.js';
import { layerClassRegistry } from '../classRegistry.js';

/**
 * @typedef {LayerOptions} RasterLayerOptions
 * @property {number|undefined} [minLevel=0] -  minLevel to show (if not specified, calculated from extent)
 * @property {number} [maxLevel=18] -  maxLevel to show
 * @property {string} [tilingSchema='geographic'] -  either "geographic" or "mercator"
 * @property {number} [opacity=1.0] - opacity between 0 and 1
 * @property {string|undefined} splitDirection - either 'left' or 'right', none if omitted
 * @api
 */

/**
 * @typedef {LayerImplementationOptions} RasterLayerImplementationOptions
 * @property {number} minLevel
 * @property {number} maxLevel
 * @property {string} tilingSchema
 * @property {number} opacity
 * @property {import("@vcmap/cesium").SplitDirection} splitDirection
 * @property {Extent|undefined} extent
 */

/**
 * @typedef {import("@vcmap/core").LayerImplementation<import("@vcmap/core").VcsMap>} RasterLayerImplementation
 * @property {function(number):void} updateOpacity
 * @property {function(import("@vcmap/cesium").SplitDirection):void} updateSplitDirection
 * @api
 */

/**
 * Enumeration of tiling schemes.
 * @enum {string}
 * @api
 * @property {string} GEOGRAPHIC
 * @property {string} MERCATOR
 * @export
 */
export const TilingScheme = {
  GEOGRAPHIC: 'geographic',
  MERCATOR: 'mercator',
};

/**
 * Gets the tiling scheme associated with this layerConfig
 * @param {Object} layerOptions
 * @returns {import("@vcmap/cesium").WebMercatorTilingScheme|import("@vcmap/cesium").GeographicTilingScheme}
 */
export function getTilingScheme(layerOptions) {
  const tilingSchemeOptions = {};
  if (layerOptions.numberOfLevelZeroTilesX && layerOptions.numberOfLevelZeroTilesX > 1) {
    tilingSchemeOptions.numberOfLevelZeroTilesX = layerOptions.numberOfLevelZeroTilesX;
  }
  if (layerOptions.numberOfLevelZeroTilesY && layerOptions.numberOfLevelZeroTilesY > 1) {
    tilingSchemeOptions.numberOfLevelZeroTilesY = layerOptions.numberOfLevelZeroTilesY;
  }
  if (layerOptions.tilingSchema === TilingScheme.MERCATOR) {
    return new WebMercatorTilingScheme(tilingSchemeOptions);
  }
  return new GeographicTilingScheme(tilingSchemeOptions);
}

/**
 * @param {Extent} extent
 * @param {import("@vcmap/cesium").GeographicTilingScheme|import("@vcmap/cesium").WebMercatorTilingScheme} tilingScheme
 * @param {number} maxLevel
 * @param {number} [minLevel=0]
 * @returns {number}
 */
export function calculateMinLevel(extent, tilingScheme, maxLevel, minLevel = 0) {
  if (!extent.isValid()) {
    return minLevel;
  }
  const wgs84Extent = extent.getCoordinatesInProjection(wgs84Projection);
  if (wgs84Extent[1] < -85) {
    wgs84Extent[1] = -85;
  }
  if (wgs84Extent[3] > 85) {
    wgs84Extent[3] = 85;
  }
  const olCoords = [
    getBottomLeft(wgs84Extent),
    getBottomRight(wgs84Extent),
    getTopRight(wgs84Extent),
    getTopLeft(wgs84Extent),
  ];
  const extentCoords = olCoords.map(coord => Cartographic.fromDegrees(coord[0], coord[1]));
  let usedMinLevel = minLevel;
  while (usedMinLevel < maxLevel) {
    // eslint-disable-next-line no-loop-func
    const tileCoords = extentCoords.map(position => tilingScheme.positionToTileXY(position, usedMinLevel));
    const distances = [];
    distances.push(Math.abs(tileCoords[0].x - tileCoords[1].x));
    distances.push(Math.abs(tileCoords[0].y - tileCoords[3].y));
    if (distances[0] > 1 || distances[1] > 1) {
      usedMinLevel -= 1;
      break;
    }
    usedMinLevel += 1;
  }
  return usedMinLevel;
}

/**
 * This abstract class allows for automatic loading scheme determination
 * for raster layers
 * @class
 * @export
 * @extends {Layer}
 * @implements {SplitLayer}
 * @abstract
 */
class RasterLayer extends Layer {
  static get className() { return 'RasterLayer'; }

  /**
   * @returns {RasterLayerOptions}
   */
  static getDefaultOptions() {
    return {
      ...Layer.getDefaultOptions(),
      minLevel: 0,
      maxLevel: 18,
      tilingSchema: TilingScheme.GEOGRAPHIC,
      opacity: 1,
      splitDirection: undefined,
    };
  }

  /**
   * @param {RasterLayerOptions} options
   */
  constructor(options) {
    options.url = options.url || '';
    super(options);
    const defaultOptions = RasterLayer.getDefaultOptions();
    this.extent = this.extent || new Extent();
    /**
     * The {@link RasterLayer.TilingScheme} of this layer
     * @type {string}
     * @api
     */
    this.tilingSchema = parseEnumValue(options.tilingSchema, TilingScheme, defaultOptions.tilingSchema);
    /** @type {number} */
    this.maxLevel = parseInteger(options.maxLevel, defaultOptions.maxLevel);
    /**
     * @type {number}
     * @private
     */
    this._minLevel = parseInteger(options.minLevel, defaultOptions.minLevel);

    const cesiumTilingScheme = getTilingScheme(options);
    /** @type {number} */
    this.minLevel = calculateMinLevel(this.extent, cesiumTilingScheme, this.maxLevel, this._minLevel);

    /**
     * @type {number}
     * @private
     */
    this._opacity = parseNumberRange(options.opacity, defaultOptions.opacity, 0.0, 1.0);

    /** @type {import("@vcmap/cesium").SplitDirection} */
    this._splitDirection = SplitDirection.NONE;

    if (options.splitDirection) {
      this._splitDirection = options.splitDirection === 'left' ?
        SplitDirection.LEFT :
        SplitDirection.RIGHT;
    }

    /**
     * raised if the split direction changes, is passed the split direction as its only argument
     * @type {VcsEvent<import("@vcmap/cesium").SplitDirection>}
     * @api
     */
    this.splitDirectionChanged = new VcsEvent();
  }

  /**
   * The split directions of this layer
   * @api
   * @type {import("@vcmap/cesium").SplitDirection}
   */
  get splitDirection() { return this._splitDirection; }

  /**
   * @param {import("@vcmap/cesium").SplitDirection} direction
   */
  set splitDirection(direction) {
    if (direction !== this._splitDirection) {
      this._splitDirection = direction;
      this.getImplementations().forEach((impl) => {
        /** @type {RasterLayerImplementation} */
        (impl).updateSplitDirection(direction);
      });
      this.splitDirectionChanged.raiseEvent(this._splitDirection);
    }
  }

  /**
   * The opacity between 0 (fully transparent) and 1 (fully opaque)
   * @api
   * @type {number}
   */
  get opacity() { return this._opacity; }

  /**
   * @param {number} opacity
   */
  set opacity(opacity) {
    const parsedValue = parseNumberRange(opacity, this._opacity, 0, 1);
    if (this._opacity !== parsedValue) {
      this._opacity = parsedValue;
      this.getImplementations().forEach((impl) => {
        /** @type {RasterLayerImplementation} */
        (impl).updateOpacity(parsedValue);
      });
    }
  }

  /**
   * @returns {RasterLayerImplementationOptions}
   */
  getImplementationOptions() {
    const options = /** @type {RasterLayerImplementationOptions} */ ({
      ...super.getImplementationOptions(),
      minLevel: this.minLevel,
      maxLevel: this.maxLevel,
      tilingSchema: this.tilingSchema,
      opacity: this.opacity,
      splitDirection: this._splitDirection,
    });

    if (this.extent.isValid()) {
      options.extent = this.extent;
    }
    return options;
  }

  /**
   * @inheritDoc
   * @returns {RasterLayerOptions}
   */
  toJSON() {
    const config = /** @type {RasterLayerOptions} */ (super.toJSON());
    const defaultOptions = RasterLayer.getDefaultOptions();

    if (this.extent.equals(new Extent())) {
      delete config.extent;
    }

    if (this._minLevel !== defaultOptions.minLevel) {
      config.minLevel = this._minLevel;
    }

    if (this.maxLevel !== defaultOptions.maxLevel) {
      config.maxLevel = this.maxLevel;
    }

    if (this.tilingSchema !== defaultOptions.tilingSchema) {
      config.tilingSchema = this.tilingSchema;
    }

    if (this.opacity !== defaultOptions.opacity) {
      config.opacity = this.opacity;
    }

    if (this._splitDirection !== SplitDirection.NONE) {
      config.splitDirection = this._splitDirection === SplitDirection.RIGHT ?
        'right' :
        'left';
    }

    return config;
  }

  /**
   * @inheritDoc
   */
  destroy() {
    this.splitDirectionChanged.destroy();
    super.destroy();
  }
}

layerClassRegistry.registerClass(RasterLayer.className, RasterLayer);
export default RasterLayer;
