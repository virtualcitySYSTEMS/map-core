import { check } from '@vcsuite/check';
import RasterLayer from './rasterLayer.js';
import SingleImageCesiumImpl from './cesium/singleImageCesiumImpl.js';
import SingleImageOpenlayersImpl from './openlayers/singleImageOpenlayersImpl.js';
import CesiumMap from '../map/cesiumMap.js';
import OpenlayersMap from '../map/openlayersMap.js';
import Extent from '../util/extent.js';
import { layerClassRegistry } from '../classRegistry.js';
import { wgs84Projection } from '../util/projection.js';

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
 * Image layer for Cesium and OpenlayersMap
 * @class
 * @export
 * @extends {RasterLayer}
 * @api stable
 */
class SingleImageLayer extends RasterLayer {
  static get className() { return 'SingleImageLayer'; }

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
    const defaultOptions = SingleImageLayer.getDefaultOptions();
    /** @type {string} */
    this.credit = options.credit || defaultOptions.credit;

    if (!this.extent.isValid()) {
      this.getLogger().warning(`layer ${this.name} was constructed with an invalid extent, defaulting to global extent`);
      this.extent = new Extent({
        projection: wgs84Projection.toJSON(),
        coordinates: [-180, -90, 180, 90],
      });
    }

    this._supportedMaps = [
      CesiumMap.className,
      OpenlayersMap.className,
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
   * @returns {Array<SingleImageOpenlayersImpl|SingleImageCesiumImpl>}
   */
  createImplementationsForMap(map) {
    if (map instanceof CesiumMap) {
      return [new SingleImageCesiumImpl(map, this.getImplementationOptions())];
    } else if (map instanceof OpenlayersMap) {
      return [new SingleImageOpenlayersImpl(map, this.getImplementationOptions())];
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

layerClassRegistry.registerClass(SingleImageLayer.className, SingleImageLayer);
export default SingleImageLayer;
