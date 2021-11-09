import RasterLayer from './rasterLayer.js';
import Openlayers from '../maps/openlayers.js';
import CesiumMap from '../maps/cesium.js';
import TMSOpenlayers from './openlayers/tmsOpenlayers.js';
import TMSCesium from './cesium/tmsCesium.js';
import { VcsClassRegistry } from '../classRegistry.js';

/**
 * @typedef {vcs.vcm.layer.RasterLayer.Options} vcs.vcm.layer.TMS.Options
 * @property {string} [format=jpeg]
 * @property {ol/Size} [tileSize=[256, 256]]
 * @api
 */

/**
 * @typedef {vcs.vcm.layer.RasterLayer.ImplementationOptions} vcs.vcm.layer.TMS.ImplementationOptions
 * @property {string} format
 * @property {ol/Size} tileSize
 */

/**
 * TMS Layer
 * @class
 * @export
 * @extends {vcs.vcm.layer.RasterLayer}
 * @api stable
 * @memberOf vcs.vcm.layer
 */
class TMS extends RasterLayer {
  static get className() { return 'vcs.vcm.layer.TMS'; }

  /**
   * @returns {vcs.vcm.layer.TMS.Options}
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
   * @param {vcs.vcm.layer.TMS.Options} options
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

    /** @type {ol/Size} */
    this.tileSize = Array.isArray(options.tileSize) ? options.tileSize.slice() : defaultOptions.tileSize;
  }

  /**
   * @inheritDoc
   * @returns {vcs.vcm.layer.TMS.ImplementationOptions}
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
   * @param {vcs.vcm.maps.VcsMap} map
   * @returns {Array<vcs.vcm.layer.openlayers.TMSOpenlayers|vcs.vcm.layer.cesium.TMSCesium>}
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
   * @returns {vcs.vcm.layer.TMS.Options}
   */
  getConfigObject() {
    const config = /** @type {vcs.vcm.layer.TMS.Options} */ (super.getConfigObject());
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
