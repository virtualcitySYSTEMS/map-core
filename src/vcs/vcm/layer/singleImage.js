import { check } from '@vcsuite/check';
import RasterLayer from './rasterLayer.js';
import SingleImageCesium from './cesium/singleImageCesium.js';
import SingleImageOpenlayers from './openlayers/singleImageOpenlayers.js';
import CesiumMap from '../maps/cesium.js';
import Openlayers from '../maps/openlayers.js';
import Extent from '../util/extent.js';

/**
 * @typedef {vcs.vcm.layer.RasterLayer.Options} vcs.vcm.layer.SingleImage.Options
 * @property {string|undefined} credit -  credit
 * @api
 */

/**
 * @typedef {vcs.vcm.layer.RasterLayer.ImplementationOptions} vcs.vcm.layer.SingleImage.ImplementationOptions
 * @property {string|undefined} credit
 */

/**
 * Image layer for Cesium and Openlayers
 * @class
 * @export
 * @extends {vcs.vcm.layer.RasterLayer}
 * @api stable
 * @memberOf vcs.vcm.layer
 */
class SingleImage extends RasterLayer {
  static get className() { return 'vcs.vcm.layer.SingleImage'; }

  /**
   * @returns {vcs.vcm.layer.SingleImage.Options}
   */
  static getDefaultOptions() {
    return {
      ...RasterLayer.getDefaultOptions(),
      credit: undefined,
    };
  }

  /**
   * @param {vcs.vcm.layer.SingleImage.Options} options
   */
  constructor(options) {
    super(options);
    const defaultOptions = SingleImage.getDefaultOptions();
    /** @type {string} */
    this.credit = options.credit || defaultOptions.credit;

    if (!this.extent.isValid()) {
      this.getLogger().warning(`layer ${this.name} was constructed with an invalid extent, defaulting to global extent`);
      this.extent = new Extent({
        epsg: 'EPSG:4326',
        coordinates: [-180, -90, 180, 90],
      });
    }

    this._supportedMaps = [
      CesiumMap.className,
      Openlayers.className,
    ];
  }

  /**
   * @returns {vcs.vcm.layer.SingleImage.ImplementationOptions}
   */
  getImplementationOptions() {
    return {
      ...super.getImplementationOptions(),
      credit: this.credit,
    };
  }

  /**
   * @param {vcs.vcm.maps.VcsMap} map
   * @returns {Array<vcs.vcm.layer.openlayers.SingleImageOpenlayers|vcs.vcm.layer.cesium.SingleImageCesium>}
   */
  createImplementationsForMap(map) {
    if (map instanceof CesiumMap) {
      return [new SingleImageCesium(map, this.getImplementationOptions())];
    } else if (map instanceof Openlayers) {
      return [new SingleImageOpenlayers(map, this.getImplementationOptions())];
    }
    return [];
  }

  /**
   * sets the image extent
   * @param {vcs.vcm.util.Extent} extent
   * @api
   */
  setExtent(extent) {
    check(extent, Extent);
    if (!extent.isValid()) {
      throw new Error('Cannot set invalid extent');
    }

    this.extent = extent;
    this.forceRedraw();
  }

  /**
   * @inheritDoc
   * @returns {vcs.vcm.layer.SingleImage.Options}
   */
  getConfigObject() {
    const config = /** @type {vcs.vcm.layer.SingleImage.Options} */ (super.getConfigObject());
    delete config.tilingSchema;

    if (this.credit) {
      config.credit = this.credit;
    }

    return config;
  }
}

export default SingleImage;
