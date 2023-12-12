import {
  CesiumTerrainProvider,
  Cartographic,
  Cartesian2,
  sampleTerrainMostDetailed,
} from '@vcmap-cesium/engine';
import type { Coordinate } from 'ol/coordinate.js';
import { getTransform } from 'ol/proj.js';
import Projection, { wgs84Projection } from '../util/projection.js';
import { getResourceOrUrl } from './cesium/resourceHelper.js';

export type TerrainProviderOptions = {
  requestVertexNormals?: boolean;
  requestWaterMask?: boolean;
};

const terrainProviders: Record<string, CesiumTerrainProvider> = {};

export async function getTerrainProviderForUrl(
  url: string,
  options: TerrainProviderOptions,
  headers?: Record<string, string>,
): Promise<CesiumTerrainProvider> {
  if (!terrainProviders[url]) {
    terrainProviders[url] = await CesiumTerrainProvider.fromUrl(
      getResourceOrUrl(url, headers),
      options,
    );
    return terrainProviders[url];
  }
  let terrainProvider = terrainProviders[url];
  if (
    (options.requestVertexNormals !== undefined &&
      terrainProvider.requestVertexNormals !== options.requestVertexNormals) ||
    (options.requestWaterMask !== undefined &&
      terrainProvider.requestWaterMask !== options.requestWaterMask)
  ) {
    terrainProviders[url] = await CesiumTerrainProvider.fromUrl(
      getResourceOrUrl(url, headers),
      options,
    );
    terrainProvider = terrainProviders[url];
  }
  return terrainProvider;
}

/**
 * changes input coordinate Array in place, new height can also be accessed by coordinates[x][2]
 * @param  terrainProvider
 * @param  coordinates
 * @param  optSourceProjection - if input is not WGS84
 * @param  result
 */
export function getHeightFromTerrainProvider(
  terrainProvider: CesiumTerrainProvider,
  coordinates: Coordinate[],
  optSourceProjection?: Projection,
  result?: Coordinate[],
): Promise<Coordinate[]> {
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
 * @param  terrainProvider
 * @param  level
 * @param  position
 */
export function isTerrainTileAvailable(
  terrainProvider: CesiumTerrainProvider,
  level: number,
  position: Cartographic,
): boolean {
  const tileXY = terrainProvider.tilingScheme.positionToTileXY(
    position,
    level,
    new Cartesian2(),
  );
  return !!terrainProvider.getTileDataAvailable(tileXY.x, tileXY.y, level);
}
