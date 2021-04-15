import LayerImplementation from '../layerImplementation.js';
import { vcsLayerName } from '../layerSymbols.js';
import { getTerrainProviderForUrl } from '../terrainHelpers.js';


/**
 * Terrain implementation for {@link vcs.vcm.maps.CesiumMap}
 * @class
 * @export
 * @extends {vcs.vcm.layer.LayerImplementation<vcs.vcm.maps.CesiumMap>}
 * @memberOf vcs.vcm.layer.cesium
 */
class TerrainCesium extends LayerImplementation {
  static get className() { return 'vcs.vcm.layer.cesium.TerrainCesium'; }

  /**
   * @param {vcs.vcm.maps.CesiumMap} map
   * @param {vcs.vcm.layer.Terrain.ImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);
    /**
     * @type {boolean}
     * @api
     */
    this.requestVertexNormals = options.requestVertexNormals;

    /**
     * @type {boolean}
     * @api
     */
    this.requestWaterMask = options.requestWaterMask;
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  initialize() {
    if (!this.initialized) {
      this.terrainProvider = getTerrainProviderForUrl({
        url: this.url,
        requestVertexNormals: this.requestVertexNormals,
        requestWaterMask: this.requestWaterMask,
      });
      this.terrainProvider[vcsLayerName] = this.name;
    }
    return super.initialize();
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  async activate() {
    await super.activate();
    if (this.active) {
      this.map.setTerrainProvider(this.terrainProvider);
    }
  }

  /**
   * @inheritDoc
   */
  deactivate() {
    super.deactivate();
    if (this.terrainProvider) {
      this.map.unsetTerrainProvider(this.terrainProvider);
    }
  }

  /**
   * @inheritDoc
   */
  destroy() {
    this.terrainProvider = null;
    super.destroy();
  }
}

export default TerrainCesium;
