import { Math as CesiumMath } from '@vcmap-cesium/engine';
import type { Extent } from 'ol/extent.js';
import { cartesian2DDistance } from '../util/math.js';

/**
 * Tile coordinate in format [x, y, level]
 */
export type TileCoordinate = {
  readonly x: number;
  readonly y: number;
  readonly level: number;
  readonly key: string;
};
export type TileSize = [number, number];

/**
 * Calculates the number of tiles in the given level.
 * @param level
 */
export function getNumberOfTiles(level: number): [number, number] {
  const maxX = 2 ** level * 2;
  const maxY = 2 ** level;
  return [maxX, maxY];
}

export function createTileCoordinate(
  x: number,
  y: number,
  level: number,
): TileCoordinate {
  return {
    x,
    y,
    level,
    key: `${level}/${x}/${y}`,
  };
}

/**
 * Creates a tile coordinate from a the key string of a tile coordinate.
 * The key is semantic and has the following structure: `level/x/y`
 * @param key
 */
export function createTileCoordinateFromKey(key: string): TileCoordinate {
  const keys = key.split('/').map(Number).filter(Number.isFinite);
  if (keys.length === 3) {
    return createTileCoordinate(keys[1], keys[2], keys[0]);
  }
  throw new Error(`Provided key "${key}" is not a valid tile coordinate key`);
}

/**
 * Calculates the tile size in radians for the given level.
 * @param level
 */
export function tileSizeInRadians(level: number): number {
  return CesiumMath.PI / 2 ** level;
}

/**
 * Calculates the tile coordinates from the given image spherical coordinate & level.
 * @param spherical
 * @param level
 */
export function tileCoordinateFromImageCoordinate(
  spherical: [number, number],
  level: number,
): TileCoordinate {
  const tileSize = tileSizeInRadians(level);
  const [numTilesX] = getNumberOfTiles(level);
  let tileX = numTilesX - 1 - Math.floor(spherical[0] / tileSize);
  const tileY = Math.floor(spherical[1] / tileSize);
  if (tileX < 0) {
    // wrap around 2 * PI
    tileX = numTilesX + tileX;
  }
  return createTileCoordinate(tileX, tileY, level);
}

/**
 * Get the tile coordinates of all tiles which intersect the given extent of image coordinates for the given level.
 * @param extent
 * @param level
 */
export function getTileCoordinatesInImageExtent(
  extent: Extent,
  level: number,
): TileCoordinate[] {
  // the extent is flipped along the X axis, we need to take this into account.
  const bottomLeft = tileCoordinateFromImageCoordinate(
    [extent[2], extent[1]],
    level,
  );
  const topRight = tileCoordinateFromImageCoordinate(
    [extent[0], extent[3]],
    level,
  );

  const numberOfLines = topRight.y - bottomLeft.y;
  const tileCoordinates = new Array<TileCoordinate>(
    (topRight.x - bottomLeft.x) * numberOfLines,
  );
  for (let i = bottomLeft.x; i <= topRight.x; i++) {
    for (let j = bottomLeft.y; j <= topRight.y; j++) {
      tileCoordinates[
        (i - bottomLeft.x) * (numberOfLines + 1) + (j - bottomLeft.y)
      ] = createTileCoordinate(i, j, level);
    }
  }

  return tileCoordinates;
}

/**
 * Gets the center point of a tile in image spherical coordinates.
 * @param tileCoordinate
 */
export function getTileSphericalCenter(
  tileCoordinate: TileCoordinate,
): [number, number] {
  const sizeR = tileSizeInRadians(tileCoordinate.level);
  const [numTilesX] = getNumberOfTiles(tileCoordinate.level);

  const phi = (numTilesX - 1 - (tileCoordinate.x - 0.5)) * sizeR;
  const theta = (tileCoordinate.y + 0.5) * sizeR;

  return [phi, theta];
}

/**
 * Gets the extent of a tile in image spherical coordinates.
 * @param tileCoordinate
 */
export function getTileSphericalExtent(
  tileCoordinate: TileCoordinate,
): [number, number, number, number] {
  const sizeR = tileSizeInRadians(tileCoordinate.level);
  const [numTilesX] = getNumberOfTiles(tileCoordinate.level);

  const minPhi = (numTilesX - 1 - tileCoordinate.x) * sizeR;
  const maxPhi = (numTilesX - 1 - (tileCoordinate.x - 1)) * sizeR;
  const minTheta = tileCoordinate.y * sizeR;
  const maxTheta = (tileCoordinate.y + 1) * sizeR;

  return [minPhi, minTheta, maxPhi, maxTheta];
}

/**
 * @param tileCoordinate - the tile coordinate to calculate the distance to
 * @param position - the image spherical position to calculate the distance from
 * @returns the distance in radians. this is only used for relative comparisons.
 */
export function getDistanceToTileCoordinate(
  position: [number, number],
  tileCoordinate: TileCoordinate,
): number {
  const center = getTileSphericalCenter(tileCoordinate);
  const distance = cartesian2DDistance(position, center);

  if (distance > Math.PI) {
    return Math.abs(CesiumMath.TWO_PI - distance);
  }
  return distance;
}
