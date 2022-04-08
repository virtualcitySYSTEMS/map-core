import { CesiumTerrainProvider, Cartographic, Cartesian2, sampleTerrainMostDetailed } from '@vcmap/cesium';
import { getTransform } from 'ol/proj.js';
import { wgs84Projection } from '../util/projection.js';

/**
 * @typedef {Object} TerrainProviderOptions
 * @property {!string} url
 * @property {boolean|undefined} requestVertexNormals
 * @property {boolean|undefined} requestWaterMask
 * @api
 */

/**
 * @type {Object<string, import("@vcmap/cesium").CesiumTerrainProvider>}
 */
const terrainProviders = {};

/**
 * @param {TerrainProviderOptions} options
 * @returns {import("@vcmap/cesium").CesiumTerrainProvider}
 */
export function getTerrainProviderForUrl(options) {
  if (!terrainProviders[options.url]) {
    terrainProviders[options.url] = new CesiumTerrainProvider(options);
    return terrainProviders[options.url];
  }
  let terrainProvider = terrainProviders[options.url];
  if ((options.requestVertexNormals !== undefined &&
      terrainProvider.requestVertexNormals !== options.requestVertexNormals) ||
    (options.requestWaterMask !== undefined &&
      terrainProvider.requestWaterMask !== options.requestWaterMask)) {
    terrainProviders[options.url] = new CesiumTerrainProvider(options);
    terrainProvider = terrainProviders[options.url];
  }
  return terrainProvider;
}

/**
 * changes input coordinate Array in place, new height can also be accessed by coordinates[x][2]
 * @param {import("@vcmap/cesium").CesiumTerrainProvider} terrainProvider
 * @param {Array<import("ol/coordinate").Coordinate>} coordinates
 * @param {import("@vcmap/core").Projection=} optSourceProjection - if input is not WGS84
 * @param {Array<import("ol/coordinate").Coordinate>=} result
 * @returns {Promise<Array<import("ol/coordinate").Coordinate>>}
 */
export function getHeightFromTerrainProvider(terrainProvider, coordinates, optSourceProjection, result) {
  const sourceTransformer = optSourceProjection ?
    getTransform(
      optSourceProjection.proj,
      wgs84Projection.proj,
    ) :
    null;

  const positions = coordinates.map((coord) => {
    const wgs84 = sourceTransformer ?
      sourceTransformer(coord, coord.slice(), coord.length) :
      coord;
    return Cartographic.fromDegrees(wgs84[0], wgs84[1]);
  });

  const outArray = result || coordinates.map(c => c.slice());
  return sampleTerrainMostDetailed(terrainProvider, positions)
    .then((updatedPositions) => {
      updatedPositions.forEach((position, index) => {
        outArray[index][2] = position.height || 0;
      });
      return outArray;
    });
}

/**
 * checks, whether a terrain tile is available at given position or not
 * @param {import("@vcmap/cesium").CesiumTerrainProvider} terrainProvider
 * @param {number} level
 * @param {import("@vcmap/cesium").Cartographic} position
 * @returns {boolean}
 */
export function isTerrainTileAvailable(terrainProvider, level, position) {
  if (!terrainProvider.ready) {
    return false;
  }
  const tileXY = terrainProvider.tilingScheme.positionToTileXY(
    position, level, new Cartesian2(),
  );
  return terrainProvider.getTileDataAvailable(tileXY.x, tileXY.y, level);
}

