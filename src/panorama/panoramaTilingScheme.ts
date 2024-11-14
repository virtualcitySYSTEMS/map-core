import { Math as CesiumMath } from '@vcmap-cesium/engine';

export function getNumberOfTiles(level: number): [number, number] {
  const maxX = 2 ** level * 2;
  const maxY = 2 ** level;
  return [maxX, maxY];
}

export function tileSizeInRadians(level: number): number {
  return CesiumMath.PI / 2 ** level;
}
