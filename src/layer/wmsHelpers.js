import TileWMS from 'ol/source/TileWMS.js';
import { getTopLeft, getWidth } from 'ol/extent.js';
import TileGrid from 'ol/tilegrid/TileGrid.js';
import { mercatorProjection, wgs84Projection } from '../util/projection.js';
import { isSameOrigin } from '../util/urlHelpers.js';

/**
 * @typedef {Object} WMSSourceOptions
 * @property {string} url
 * @property {string} tilingSchema -  either "geographic" or "mercator"
 * @property {number} maxLevel
 * @property {number} minLevel
 * @property {import("ol/size").Size} tileSize
 * @property {import("@vcmap/core").Extent|undefined} extent
 * @property {Object<string, string>} parameters
 * @property {string} version
 */

/**
 * @param {WMSSourceOptions} options
 * @returns {import("ol/source/TileWMS").default}
 */
// eslint-disable-next-line import/prefer-default-export
export function getWMSSource(options) {
  const projection = options.tilingSchema === 'geographic' ?
    wgs84Projection :
    mercatorProjection;

  const projectionExtent = projection.proj.getExtent();

  const width = getWidth(projectionExtent);
  const size = options.tilingSchema === 'geographic' ? width / (options.tileSize[0] * 2) : width / options.tileSize[0];
  const maxZoom = options.maxLevel + 1;
  const resolutions = [];
  for (let z = 0; z < maxZoom; ++z) {
    // generate resolutions and matrixIds arrays for options WmtsLayer
    resolutions.push(size / (2 ** z));
  }
  const tilingOptions = {
    origin: getTopLeft(projectionExtent),
    resolutions,
    tileSize: options.tileSize,
    minZoom: options.minLevel,
  };
  if (options.extent && options.extent.isValid()) {
    tilingOptions.extent = options.extent.getCoordinatesInProjection(projection);
  }

  const sourceOptions = {
    url: options.url,
    tileGrid: new TileGrid(tilingOptions),
    params: options.parameters,
  };
  if (!isSameOrigin(options.url)) {
    sourceOptions.crossOrigin = 'anonymous';
  }
  if (options.tilingSchema === 'geographic') {
    if (options.version === '1.3.0') {
      sourceOptions.projection = 'CRS:84';
    } else {
      sourceOptions.projection = 'EPSG:4326';
    }
  }
  return new TileWMS(sourceOptions);
}
