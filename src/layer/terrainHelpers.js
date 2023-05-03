import {
  CesiumTerrainProvider,
  Cartographic,
  Cartesian2,
  sampleTerrainMostDetailed,
} from '@vcmap-cesium/engine';
import { getTransform } from 'ol/proj.js';
import { wgs84Projection } from '../util/projection.js';

/**
 * @typedef {Object} TerrainProviderOptions
 * @property {boolean|undefined} requestVertexNormals
 * @property {boolean|undefined} requestWaterMask
 * @api
 */

/**
 * @type {Object<string, import("@vcmap-cesium/engine").CesiumTerrainProvider>}
 */
const terrainProviders = {};

/**
 * @param {string} url
 * @param {TerrainProviderOptions} options
 * @returns {Promise<import("@vcmap-cesium/engine").CesiumTerrainProvider>}
 */
export async function getTerrainProviderForUrl(url, options) {
  if (!terrainProviders[url]) {
    terrainProviders[url] = await CesiumTerrainProvider.fromUrl(url, options);
    return terrainProviders[url];
  }
  let terrainProvider = terrainProviders[url];
  if (
    (options.requestVertexNormals !== undefined &&
      terrainProvider.requestVertexNormals !== options.requestVertexNormals) ||
    (options.requestWaterMask !== undefined &&
      terrainProvider.requestWaterMask !== options.requestWaterMask)
  ) {
    terrainProviders[url] = await CesiumTerrainProvider.fromUrl(url, options);
    terrainProvider = terrainProviders[url];
  }
  return terrainProvider;
}

/**
 * changes input coordinate Array in place, new height can also be accessed by coordinates[x][2]
 * @param {import("@vcmap-cesium/engine").CesiumTerrainProvider} terrainProvider
 * @param {Array<import("ol/coordinate").Coordinate>} coordinates
 * @param {import("@vcmap/core").Projection=} optSourceProjection - if input is not WGS84
 * @param {Array<import("ol/coordinate").Coordinate>=} result
 * @returns {Promise<Array<import("ol/coordinate").Coordinate>>}
 */
export function getHeightFromTerrainProvider(
  terrainProvider,
  coordinates,
  optSourceProjection,
  result,
) {
  const sourceTransformer = optSourceProjection
    ? getTransform(optSourceProjection.proj, wgs84Projection.proj)
    : null;

  const positions = coordinates.map((coord) => {
    const wgs84 = sourceTransformer
      ? sourceTransformer(coord, coord.slice(), coord.length)
      : coord;
    return Cartographic.fromDegrees(wgs84[0], wgs84[1]);
  });

  const outArray = result || coordinates.map((c) => c.slice());
  return sampleTerrainMostDetailed(terrainProvider, positions).then(
    (updatedPositions) => {
      updatedPositions.forEach((position, index) => {
        outArray[index][2] = position.height || 0;
      });
      return outArray;
    },
  );
}

/**
 * checks, whether a terrain tile is available at given position or not
 * @param {import("@vcmap-cesium/engine").CesiumTerrainProvider} terrainProvider
 * @param {number} level
 * @param {import("@vcmap-cesium/engine").Cartographic} position
 * @returns {boolean}
 */
export function isTerrainTileAvailable(terrainProvider, level, position) {
  const tileXY = terrainProvider.tilingScheme.positionToTileXY(
    position,
    level,
    new Cartesian2(),
  );
  return terrainProvider.getTileDataAvailable(tileXY.x, tileXY.y, level);
}
