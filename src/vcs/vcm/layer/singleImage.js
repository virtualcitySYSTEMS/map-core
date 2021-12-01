import { check } from '@vcsuite/check';
import RasterLayer from './rasterLayer.js';
import SingleImageCesium from './cesium/singleImageCesium.js';
import SingleImageOpenlayers from './openlayers/singleImageOpenlayers.js';
import CesiumMap from '../maps/cesium.js';
import Openlayers from '../maps/openlayers.js';
import Extent from '../util/extent.js';
import { VcsClassRegistry } from '../classRegistry.js';

/**
 * @typedef {RasterLayerOptions} SingleImageOptions
 * @property {string|undefined} credit -  credit
 * @api
 */

/**
 * @typedef {RasterLayerImplementationOptions} SingleImageImplementationOptions
 * @property {string|undefined} credit
 */

/**
 * Image layer for Cesium and Openlayers
 * @class
 * @export
 * @extends {RasterLayer}
 * @api stable
 */
class SingleImage extends RasterLayer {
  static get className() { return 'vcs.vcm.layer.SingleImage'; }

  /**
   * @returns {SingleImageOptions}
   */
  static getDefaultOptions() {
    return {
      ...RasterLayer.getDefaultOptions(),
      credit: undefined,
    };
  }

  /**
   * @param {SingleImageOptions} options
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
   * @returns {SingleImageImplementationOptions}
   */
  getImplementationOptions() {
    return {
      ...super.getImplementationOptions(),
      credit: this.credit,
    };
  }

  /**
   * @param {import("@vcmap/core").VcsMap} map
   * @returns {Array<SingleImageOpenlayers|SingleImageCesium>}
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
   * @param {Extent} extent
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
   * @returns {SingleImageOptions}
   */
  toJSON() {
    const config = /** @type {SingleImageOptions} */ (super.toJSON());
    delete config.tilingSchema;

    if (this.credit) {
      config.credit = this.credit;
    }

    return config;
  }
}

VcsClassRegistry.registerClass(SingleImage.className, SingleImage);
export default SingleImage;
