import {
  HeightReference,
  Math as CesiumMath,
  PrimitiveCollection,
  QuadtreeTile,
  Rectangle,
  SplitDirection,
  TileBoundingRegion,
  TilingScheme,
} from '@vcmap-cesium/engine';
import { StyleLike } from 'ol/style/Style.js';
import { Extent as OLExtent } from 'ol/extent.js';
import type CesiumMap from '../../../map/cesiumMap.js';
import Projection from '../../../util/projection.js';
import TileProvider from '../../tileProvider/tileProvider.js';
import VectorProperties from '../../vectorProperties.js';

export enum VcsTileState {
  LOADING,
  PROCESSING,
  READY,
  FAILED,
}

export enum VcsTileType {
  VECTOR,
  CHILD,
  NO_DATA,
  DEBUG,
}

export type VcsTileOptions = {
  map: CesiumMap;
  primitiveCollection: PrimitiveCollection;
  style: StyleLike;
  tileProvider: TileProvider;
  name: string;
  vectorProperties: VectorProperties;
  splitDirection: SplitDirection;
};

export interface VcsTile {
  state: VcsTileState;
  type: VcsTileType;
  tileBoundingRegion: TileBoundingRegion;
  show: boolean;
  freeResources?: () => void;
}

/**
 * returns the extent of the tile in wgs84 degrees
 * @param tile
 * @param tilingScheme
 */
export function getTileWgs84Extent(
  tile: QuadtreeTile,
  tilingScheme: TilingScheme,
): OLExtent {
  const tileRect = tilingScheme.tileXYToRectangle(tile.x, tile.y, tile.level);

  return [
    CesiumMath.toDegrees(tileRect.west),
    CesiumMath.toDegrees(tileRect.south),
    CesiumMath.toDegrees(tileRect.east),
    CesiumMath.toDegrees(tileRect.north),
  ];
}

/**
 * returns the extent of the tile in web mercator
 * @param tile
 * @param tilingScheme
 */
export function getTileWebMercatorExtent(
  tile: QuadtreeTile,
  tilingScheme: TilingScheme,
): OLExtent {
  const wgs84Extent = getTileWgs84Extent(tile, tilingScheme);
  const min = Projection.wgs84ToMercator([wgs84Extent[0], wgs84Extent[1]]);
  const max = Projection.wgs84ToMercator([wgs84Extent[2], wgs84Extent[3]]);

  return [min[0], min[1], max[0], max[1]];
}

export function getTileBoundingRegion(
  tile: QuadtreeTile<VcsTile>,
  map: CesiumMap,
): TileBoundingRegion {
  const height =
    map
      .getScene()
      ?.getHeight(
        Rectangle.center(tile.rectangle),
        HeightReference.CLAMP_TO_GROUND,
      ) ?? 0;

  return new TileBoundingRegion({
    rectangle: tile.rectangle,
    maximumHeight: height,
    minimumHeight: height,
  });
}

export function getDataTiles(
  minLevel: number,
  maxLevel: number,
  tileProvider: TileProvider,
): {
  dataLevels: Set<number>;
  dataRange: [number, number];
} {
  const dataLevels = new Set<number>();
  for (let i = minLevel; i <= maxLevel; i++) {
    const baseLevel = tileProvider.getBaseLevel(i);
    if (baseLevel != null) {
      const toAdd = baseLevel < minLevel ? minLevel : baseLevel;
      dataLevels.add(toAdd);
    }
  }

  if (dataLevels.size === 0) {
    throw new Error('No base levels for this tile data set');
  }

  const lastDataLevel = [...dataLevels].at(-1)!;
  return {
    dataLevels,
    dataRange: [minLevel, lastDataLevel > minLevel ? lastDataLevel : minLevel],
  };
}

export function getTileHash(tile: QuadtreeTile): string {
  return `${tile.level}/${tile.x}/${tile.y}`;
}
