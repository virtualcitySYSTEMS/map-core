import { parseInteger } from '@vcsuite/parsers';
import { getLogger } from '@vcsuite/logger';
import RasterLayer from './rasterLayer.js';
import OpenlayersMap from '../map/openlayersMap.js';
import CesiumMap from '../map/cesiumMap.js';
import WmtsOpenlayersImpl from './openlayers/wmtsOpenlayersImpl.js';
import WmtsCesiumImpl from './cesium/wmtsCesiumImpl.js';
import { layerClassRegistry } from '../classRegistry.js';

/**
 * @typedef {RasterLayerOptions} WMTSOptions
 * @property {string} layer
 * @property {string|undefined} style
 * @property {string|undefined} format
 * @property {string|undefined} tileMatrixSetID
 * @property {string|undefined} tileMatrixPrefix
 * @property {Array<string>} matrixIds
 * @property {number} [numberOfLevelZeroTilesX=1]
 * @property {number} [numberOfLevelZeroTilesY=1]
 * @property {Object|undefined} openlayersOptions
 * @property {import("ol/size").Size} [tileSize=[256,256]]
 * @api
 */

/**
 * @typedef {RasterLayerImplementationOptions} WMTSImplementationOptions
 * @property {string} layer
 * @property {string} style
 * @property {string} format
 * @property {string} tileMatrixSetID
 * @property {import("ol/size").Size} tileSize
 * @property {number} numberOfLevelZeroTilesX
 * @property {number} numberOfLevelZeroTilesY
 * @property {Array<string>} matrixIds
 * @property {Object} openlayersOptions
 */


/**
 * @param {Array<string>} matrixIds
 * @param {number} maxLevel
 * @param {string} prefix
 * @returns {Array<string>}
 */
function getMatrixIds(matrixIds, maxLevel, prefix) {
  if (matrixIds.length > 0) {
    if (matrixIds.length === (maxLevel + 1)) {
      return matrixIds;
    } else {
      getLogger('WmtsCesiumImpl')
        .log('matrixIds must have the same length as maxLevel');
    }
  }
  return new Array(maxLevel + 1).fill(undefined).map((value, index) => {
    return `${prefix}${index}`;
  });
}


/**
 * WmtsLayer layer
 * @class
 * @export
 * @extends {RasterLayer}
 * @api stable
 */
class WMTSLayer extends RasterLayer {
  static get className() { return 'WMTSLayer'; }

  /**
   * @returns {WMTSOptions}
   */
  static getDefaultOptions() {
    return {
      ...RasterLayer.getDefaultOptions(),
      tilingSchema: 'mercator',
      numberOfLevelZeroTilesX: 1,
      numberOfLevelZeroTilesY: 1,
      layer: '',
      style: '',
      format: '',
      tileMatrixPrefix: '',
      tileMatrixSetID: '',
      openlayersOptions: {},
      matrixIds: [],
      tileSize: /** @type {import("ol/size").Size} */ ([256, 256]),
    };
  }

  /**
   * @param {WMTSOptions} options
   */
  constructor(options) {
    const defaultOptions = WMTSLayer.getDefaultOptions();
    options.tilingSchema = options.tilingSchema || defaultOptions.tilingSchema;
    super(options);

    this._supportedMaps = [
      OpenlayersMap.className,
      CesiumMap.className,
    ];

    /** @type {number} */
    this.numberOfLevelZeroTilesX = parseInteger(
      options.numberOfLevelZeroTilesX,
      defaultOptions.numberOfLevelZeroTilesX,
    );

    /** @type {number} */
    this.numberOfLevelZeroTilesY = parseInteger(
      options.numberOfLevelZeroTilesY,
      defaultOptions.numberOfLevelZeroTilesY,
    );

    /** @type {string} */
    this.layer = options.layer || defaultOptions.layer;

    /** @type {string} */
    this.style = options.style || defaultOptions.style;

    /** @type {string} */
    this.format = options.format || defaultOptions.format;

    /** @type {string} */
    this.tileMatrixPrefix = options.tileMatrixPrefix || defaultOptions.tileMatrixPrefix;

    /** @type {string} */
    this.tileMatrixSetID = options.tileMatrixSetID || defaultOptions.tileMatrixSetID;

    /** @type {Object} */
    this.openlayersOptions = options.openlayersOptions || defaultOptions.openlayersOptions;

    /** @type {Array.<string> | null} */
    this.matrixIds = Array.isArray(options.matrixIds) ? options.matrixIds : defaultOptions.matrixIds;

    /** @type {import("ol/size").Size} */
    this.tileSize = options.tileSize || defaultOptions.tileSize;
  }

  /**
   * @inheritDoc
   * @returns {WMTSImplementationOptions}
   */
  getImplementationOptions() {
    return {
      ...super.getImplementationOptions(),
      layer: this.layer,
      style: this.style,
      format: this.format,
      tileMatrixSetID: this.tileMatrixSetID,
      tileSize: this.tileSize,
      numberOfLevelZeroTilesX: this.numberOfLevelZeroTilesX,
      numberOfLevelZeroTilesY: this.numberOfLevelZeroTilesY,
      matrixIds: getMatrixIds(this.matrixIds, this.maxLevel, this.tileMatrixPrefix),
      openlayersOptions: this.openlayersOptions,
    };
  }

  /**
   * @inheritDoc
   * @param {import("@vcmap/core").VcsMap} map
   * @returns {Array<WmtsOpenlayersImpl|WmtsCesiumImpl>}
   */
  createImplementationsForMap(map) {
    if (map instanceof OpenlayersMap) {
      return [new WmtsOpenlayersImpl(map, this.getImplementationOptions())];
    }

    if (map instanceof CesiumMap) {
      return [new WmtsCesiumImpl(map, this.getImplementationOptions())];
    }
    return [];
  }

  /**
   * @inheritDoc
   * @returns {WMTSOptions}
   */
  toJSON() {
    const config = /** @type {WMTSOptions} */ (super.toJSON());
    const defaultOptions = WMTSLayer.getDefaultOptions();

    if (this.tilingSchema !== defaultOptions.tilingSchema) {
      config.tilingSchema = this.tilingSchema;
    } else {
      delete config.tilingSchema;
    }

    if (this.numberOfLevelZeroTilesX !== defaultOptions.numberOfLevelZeroTilesX) {
      config.numberOfLevelZeroTilesX = this.numberOfLevelZeroTilesX;
    }

    if (this.numberOfLevelZeroTilesY !== defaultOptions.numberOfLevelZeroTilesY) {
      config.numberOfLevelZeroTilesY = this.numberOfLevelZeroTilesY;
    }

    if (this.layer !== defaultOptions.layer) {
      config.layer = this.layer;
    }

    if (this.style !== defaultOptions.style) {
      config.style = this.style;
    }

    if (this.format !== defaultOptions.format) {
      config.format = this.format;
    }

    if (this.tileMatrixPrefix !== defaultOptions.tileMatrixPrefix) {
      config.tileMatrixPrefix = this.tileMatrixPrefix;
    }

    if (this.tileMatrixSetID !== defaultOptions.tileMatrixSetID) {
      config.tileMatrixSetID = this.tileMatrixSetID;
    }

    if (Object.keys(this.openlayersOptions).length > 0) {
      config.openlayersOptions = { ...this.openlayersOptions };
    }

    if (this.matrixIds.length > 0) {
      config.matrixIds = this.matrixIds.slice();
    }

    if (this.tileSize[0] !== defaultOptions.tileSize[0] || this.tileSize[1] !== defaultOptions.tileSize[1]) {
      config.tileSize = /** @type {import("ol/size").Size} */ (this.tileSize.slice());
    }

    return config;
  }
}

layerClassRegistry.registerClass(WMTSLayer.className, WMTSLayer);
export default WMTSLayer;

