import { checkMaybe } from '@vcs/check';
import CesiumTileset from './cesiumTileset.js';
import DeclarativeStyleItem from '../util/style/declarativeStyleItem.js';
import VectorStyleItem from '../util/style/vectorStyleItem.js';
import CesiumMap from '../maps/cesium.js';
import PointCloudCesium from './cesium/pointCloudCesium.js';

/**
 * @typedef {vcs.vcm.layer.CesiumTileset.Options} vcs.vcm.layer.PointCloud.Options
 * @property {number|string|undefined} pointSize - Pointsize of the pointcloud in pixel default is 1
 * @api
 */

/**
 * @typedef {vcs.vcm.layer.CesiumTileset.ImplementationOptions} vcs.vcm.layer.PointCloud.ImplementationOptions
 * @property {string|number|undefined} pointSize
 * @api
 */

/**
 * @type {vcs.vcm.util.style.DeclarativeStyleItem}
 */
export const defaultPointCloudStyle = new DeclarativeStyleItem({});

/**
 * represents a specific PointCloud layer for cesium.
 * <h3>Config Parameter</h3>
 * <ul>
 *  <li>url: string: url to the p3dm dataset
 *  <li>pointSize: number: size of the points to display
 * </ul>
 *
 * @class
 * @export
 * @extends {vcs.vcm.layer.CesiumTileset}
 * @api stable
 * @memberOf vcs.vcm.layer
 */
class PointCloud extends CesiumTileset {
  static get className() { return 'vcs.vcm.layer.PointCloud'; }

  /**
   * @returns {vcs.vcm.layer.PointCloud.Options}
   */
  static getDefaultOptions() {
    return {
      ...CesiumTileset.getDefaultOptions(),
      pointSize: null,
    };
  }

  /**
   * @param {vcs.vcm.layer.PointCloud.Options} options
   */
  constructor(options) {
    super(options);

    const defaultOptions = PointCloud.getDefaultOptions();
    /**
     * The default point size to fall back on, if no point size is given. Uses Cesium default of 1 if null.
     * @api
     * @type {number|string|null}
     */
    this.defaultPointSize = options.pointSize != null ? options.pointSize : defaultOptions.pointSize;
    /** @type {number|string|null} */
    this._pointSize = this.defaultPointSize;

    this._supportedMaps = [
      CesiumMap.className,
    ];
  }

  /**
   * @inheritDoc
   * @param {(vcs.vcm.util.style.Reference|vcs.vcm.util.style.DeclarativeStyleItem.Options|vcs.vcm.util.style.VectorStyleItem.Options|vcs.vcm.util.style.ClusterStyleItem.Options|vcs.vcm.util.style.StyleItem|string)=} styleOptions
   * @param {(vcs.vcm.util.style.VectorStyleItem|vcs.vcm.util.style.ClusterStyleItem|vcs.vcm.util.style.DeclarativeStyleItem)=} defaultStyle
   * @returns {vcs.vcm.util.style.StyleItem}
   */
  getStyleOrDefaultStyle(styleOptions, defaultStyle) {
    return super.getStyleOrDefaultStyle(styleOptions, defaultStyle || defaultPointCloudStyle);
  }

  /**
   * @type {number|string|null}
   * @api
   */
  get pointSize() { return this._pointSize; }

  /**
   * @param {string|number|undefined} size
   */
  set pointSize(size) {
    checkMaybe(size, [Number, String]);
    this._pointSize = size;
    this.getImplementations().forEach((impl) => {
      /** @type {vcs.vcm.layer.cesium.PointCloudCesium} */ (impl).updatePointSize(size);
    });
  }

  /**
   * @returns {vcs.vcm.layer.PointCloud.ImplementationOptions}
   */
  getImplementationOptions() {
    return {
      ...super.getImplementationOptions(),
      pointSize: this.pointSize,
    };
  }

  /**
   * @param {vcs.vcm.maps.VcsMap} map
   * @returns {Array<vcs.vcm.layer.cesium.PointCloudCesium>}
   */
  createImplementationsForMap(map) {
    if (map instanceof CesiumMap) {
      return [new PointCloudCesium(map, this.getImplementationOptions())];
    }

    return [];
  }

  /**
   * Clears the style of this layer resets the point size to the defaultPointSize
   * @api stable
   */
  clearStyle() {
    super.clearStyle();
    this.pointSize = this.defaultPointSize;
  }

  /**
   * Sets a new declarative style. Cannot set a Vector style on PointCloud layers.
   * @param {string|ol/style/Style|ol/style/StyleFunction|vcs.vcm.util.style.StyleItem} style
   * @param {boolean=} silent
   * @api
   */
  setStyle(style, silent) {
    if (style instanceof VectorStyleItem) {
      this.getLogger().warning('trying to apply vector style to point cloud layer.');
    } else {
      super.setStyle(style, silent);
    }
  }

  /**
   * @inheritDoc
   * @returns {vcs.vcm.layer.PointCloud.Options}
   */
  getConfigObject() {
    const config = /** @type {vcs.vcm.layer.PointCloud.Options} */ (super.getConfigObject());
    const defaultOptions = PointCloud.getDefaultOptions();

    if (this.defaultPointSize !== defaultOptions.pointSize) {
      config.pointSize = this.defaultPointSize;
    }

    return config;
  }
}

export default PointCloud;
