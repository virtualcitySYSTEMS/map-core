import { checkMaybe } from '@vcsuite/check';
import CesiumTilesetLayer from './cesiumTilesetLayer.js';
import DeclarativeStyleItem from '../style/declarativeStyleItem.js';
import VectorStyleItem from '../style/vectorStyleItem.js';
import CesiumMap from '../map/cesiumMap.js';
import CesiumTilesetCesiumImpl from './cesium/cesiumTilesetCesiumImpl.js';
import { layerClassRegistry } from '../classRegistry.js';

/**
 * @typedef {CesiumTilesetOptions} PointCloudOptions
 * @property {number|string|undefined} pointSize - Pointsize of the pointcloud in pixel default is 1
 * @api
 */

/**
 * @typedef {CesiumTilesetImplementationOptions} PointCloudImplementationOptions
 * @property {string|number|undefined} pointSize
 * @api
 */

/**
 * @type {DeclarativeStyleItem}
 */
export const defaultPointCloudStyle = new DeclarativeStyleItem({});

/**
 * represents a specific PointCloudLayer layer for cesium.
 * <h3>Config Parameter</h3>
 * <ul>
 *  <li>url: string: url to the p3dm dataset
 *  <li>pointSize: number: size of the points to display
 * </ul>
 *
 * @class
 * @export
 * @extends {CesiumTilesetLayer}
 * @api stable
 */
class PointCloudLayer extends CesiumTilesetLayer {
  static get className() { return 'PointCloudLayer'; }

  /**
   * @returns {PointCloudOptions}
   */
  static getDefaultOptions() {
    return {
      ...CesiumTilesetLayer.getDefaultOptions(),
      pointSize: null,
    };
  }

  /**
   * @param {PointCloudOptions} options
   */
  constructor(options) {
    super(options);

    const defaultOptions = PointCloudLayer.getDefaultOptions();
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
   * @param {(DeclarativeStyleItemOptions|VectorStyleItemOptions|import("@vcmap/core").StyleItem)=} styleOptions
   * @param {(VectorStyleItem|DeclarativeStyleItem)=} defaultStyle
   * @returns {import("@vcmap/core").StyleItem}
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
    /** @type {DeclarativeStyleItem} */ (this.style).pointSize = size?.toString();
  }

  async initialize() {
    await super.initialize();
    this.pointSize = this._pointSize;
  }

  /**
   * @param {import("@vcmap/core").VcsMap} map
   * @returns {Array<CesiumTilesetCesiumImpl>}
   */
  createImplementationsForMap(map) {
    if (map instanceof CesiumMap) {
      return [new CesiumTilesetCesiumImpl(map, this.getImplementationOptions())];
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
   * Sets a new declarative style. Cannot set a VectorLayer style on PointCloudLayer layers.
   * @param {import("ol/style/Style").default|import("ol/style/Style").StyleFunction|import("@vcmap/core").StyleItem} style
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
   * @returns {PointCloudOptions}
   */
  toJSON() {
    const config = /** @type {PointCloudOptions} */ (super.toJSON());
    const defaultOptions = PointCloudLayer.getDefaultOptions();

    if (this.defaultPointSize !== defaultOptions.pointSize) {
      config.pointSize = this.defaultPointSize;
    }

    return config;
  }
}

layerClassRegistry.registerClass(PointCloudLayer.className, PointCloudLayer);
export default PointCloudLayer;
