import RasterLayer from './rasterLayer.js';
import Openlayers from '../maps/openlayers.js';
import CesiumMap from '../maps/cesium.js';
import TMSOpenlayers from './openlayers/tmsOpenlayers.js';
import TMSCesium from './cesium/tmsCesium.js';
import { VcsClassRegistry } from '../classRegistry.js';

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
 * TMS Layer
 * @class
 * @export
 * @extends {RasterLayer}
 * @api stable
 */
class TMS extends RasterLayer {
  static get className() { return 'vcs.vcm.layer.TMS'; }

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
    const defaultOptions = TMS.getDefaultOptions();
    options.tilingSchema = options.tilingSchema || defaultOptions.tilingSchema;
    super(options);

    this._supportedMaps = [
      Openlayers.className,
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
   * @returns {Array<TMSOpenlayers|TMSCesium>}
   */
  createImplementationsForMap(map) {
    if (map instanceof Openlayers) {
      return [new TMSOpenlayers(map, this.getImplementationOptions())];
    }

    if (map instanceof CesiumMap) {
      return [new TMSCesium(map, this.getImplementationOptions())];
    }
    return [];
  }

  /**
   * @inheritDoc
   * @returns {TMSOptions}
   */
  getConfigObject() {
    const config = /** @type {TMSOptions} */ (super.getConfigObject());
    const defaultOptions = TMS.getDefaultOptions();

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

VcsClassRegistry.registerClass(TMS.className, TMS);
export default TMS;
