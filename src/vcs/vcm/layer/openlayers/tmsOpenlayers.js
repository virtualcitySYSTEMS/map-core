import XYZ from 'ol/source/XYZ.js';
import Tile from 'ol/layer/Tile.js';
import { mercatorProjection } from '../../util/projection.js';
import RasterLayerOpenlayers from './rasterLayerOpenlayers.js';
import { TilingScheme } from '../rasterLayer.js';
import { isSameOrigin } from '../../util/urlHelpers.js';

/**
 * TMS implementation for {@link vcs.vcm.maps.Openlayers}.
 * @class
 * @export
 * @extends {vcs.vcm.layer.openlayers.RasterLayerOpenlayers}
 * @memberOf vcs.vcm.layer.openlayers
 */
class TMSOpenlayers extends RasterLayerOpenlayers {
  static get className() { return 'vcs.vcm.layer.openlayers.TMSOpenlayers'; }

  /**
   * @param {vcs.vcm.maps.Openlayers} map
   * @param {vcs.vcm.layer.TMS.ImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);
    /** @type {string} */
    this.format = options.format;
    /** @type {ol/Size} */
    this.tileSize = options.tileSize;
  }

  /**
   * @returns {ol/layer/Tile}
   */
  getOLLayer() {
    const sourceOptions = {
      tileUrlFunction: (tileCoord) => {
        const baseUrl = this.url.replace(/\/$/, '');
        const y = (1 << tileCoord[0]) - (tileCoord[2]) - 1;
        return `${baseUrl}/${tileCoord[0]}/${tileCoord[1]}/${y}.${this.format}`;
      },
      tileSize: this.tileSize,
      minZoom: this.minLevel,
      maxZoom: this.maxLevel,
      wrapX: false,
    };
    if (!isSameOrigin(this.url)) {
      sourceOptions.crossOrigin = 'anonymous';
    }
    if (this.tilingSchema === TilingScheme.GEOGRAPHIC) {
      sourceOptions.projection = 'EPSG:4326';
    }

    const tileOptions = {
      source: new XYZ(sourceOptions),
      opacity: this.opacity,
    };
    if (this.extent && this.extent.isValid()) {
      tileOptions.extent = this.extent.getCoordinatesInProjection(mercatorProjection);
    }
    return new Tile(tileOptions);
  }
}

export default TMSOpenlayers;
