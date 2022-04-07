import RasterLayer from './rasterLayer.js';
import OpenlayersMap from '../map/openlayersMap.js';
import CesiumMap from '../map/cesiumMap.js';
import TmsOpenlayersImpl from './openlayers/tmsOpenlayersImpl.js';
import TmsCesiumImpl from './cesium/tmsCesiumImpl.js';
import { layerClassRegistry } from '../classRegistry.js';

/**
 * @typedef {RasterLayerOptions} TMSOptions
 * @property {string} [format=jpeg]
 * @property {import("ol/size").Size} [tileSize=[256, 256]]
 * @api
 */

/**
 * @typedef {RasterLayerImplementationOptions} TMSImplementationOptions
 * @property {string} format
 * @property {import("ol/size").Size} tileSize
 */

/**
 * TmsLayer Layer
 * @class
 * @export
 * @extends {RasterLayer}
 * @api stable
 */
class TMSLayer extends RasterLayer {
  static get className() { return 'TMSLayer'; }

  /**
   * @returns {TMSOptions}
   */
  static getDefaultOptions() {
    return {
      ...RasterLayer.getDefaultOptions(),
      tilingSchema: 'mercator',
      format: 'jpeg',
      tileSize: [256, 256],
    };
  }

  /**
   * @param {TMSOptions} options
   */
  constructor(options) {
    const defaultOptions = TMSLayer.getDefaultOptions();
    options.tilingSchema = options.tilingSchema || defaultOptions.tilingSchema;
    super(options);

    this._supportedMaps = [
      OpenlayersMap.className,
      CesiumMap.className,
    ];

    /** @type {?string} */
    this.format = options.format || defaultOptions.format;

    /** @type {import("ol/size").Size} */
    this.tileSize = Array.isArray(options.tileSize) ? options.tileSize.slice() : defaultOptions.tileSize;
  }

  /**
   * @inheritDoc
   * @returns {TMSImplementationOptions}
   */
  getImplementationOptions() {
    return {
      ...super.getImplementationOptions(),
      format: this.format,
      tileSize: this.tileSize,
    };
  }

  /**
   * @inheritDoc
   * @param {import("@vcmap/core").VcsMap} map
   * @returns {Array<TmsOpenlayersImpl|TmsCesiumImpl>}
   */
  createImplementationsForMap(map) {
    if (map instanceof OpenlayersMap) {
      return [new TmsOpenlayersImpl(map, this.getImplementationOptions())];
    }

    if (map instanceof CesiumMap) {
      return [new TmsCesiumImpl(map, this.getImplementationOptions())];
    }
    return [];
  }

  /**
   * @inheritDoc
   * @returns {TMSOptions}
   */
  toJSON() {
    const config = /** @type {TMSOptions} */ (super.toJSON());
    const defaultOptions = TMSLayer.getDefaultOptions();

    if (this.tilingSchema !== defaultOptions.tilingSchema) {
      config.tilingSchema = this.tilingSchema;
    } else {
      delete config.tilingSchema;
    }

    if (this.format !== defaultOptions.format) {
      config.format = this.format;
    }

    if (
      this.tileSize[0] !== defaultOptions.tileSize[0] ||
      this.tileSize[1] !== defaultOptions.tileSize[1]
    ) {
      config.tileSize = this.tileSize.slice();
    }

    return config;
  }
}

layerClassRegistry.registerClass(TMSLayer.className, TMSLayer);
export default TMSLayer;
