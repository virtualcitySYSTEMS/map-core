import { Cesium3DTileStyle } from '@vcmap/cesium';
import CesiumTilesetCesiumImpl from './cesiumTilesetCesiumImpl.js';

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
 * @extends {CesiumTilesetCesiumImpl}
 * @api stable
 */
class PointCloudCesiumImpl extends CesiumTilesetCesiumImpl {
  static get className() { return 'PointCloudCesiumImpl'; }

  /**
   * @param {import("@vcmap/core").CesiumMap} map
   * @param {PointCloudImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);
    /** @type {string|number} */
    this.pointSize = options.pointSize;
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  async initialize() {
    await super.initialize();
    this.updatePointSize(this.pointSize);
  }

  /**
   * @param {string|number} size
   */
  updatePointSize(size) {
    this.pointSize = size;
    if (this.initialized) {
      if (this.cesium3DTileset.style) {
        // @ts-ignore
        this.cesium3DTileset.style.pointSize = this.pointSize;
        this.cesium3DTileset.makeStyleDirty();
      } else if (this.pointSize != null) {
        this.cesium3DTileset.style = new Cesium3DTileStyle({
          pointSize: this.pointSize.toString(),
        });
      }
    }
  }
}

export default PointCloudCesiumImpl;
