import Cesium3DTileStyle from 'cesium/Source/Scene/Cesium3DTileStyle.js';
import CesiumTilesetCesium from './cesiumTilesetCesium.js';

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
 * @extends {vcs.vcm.layer.cesium.CesiumTilesetCesium}
 * @api stable
 * @memberOf vcs.vcm.layer.cesium
 */
class PointCloudCesium extends CesiumTilesetCesium {
  static get className() { return 'vcs.vcm.layer.cesium.PointCloud'; }

  /**
   * @param {vcs.vcm.maps.CesiumMap} map
   * @param {vcs.vcm.layer.PointCloud.ImplementationOptions} options
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

export default PointCloudCesium;
