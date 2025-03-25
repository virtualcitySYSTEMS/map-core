import {
  generateLevelBounds,
  NODE_ITEM_BYTE_LEN,
} from 'flatgeobuf/lib/mjs/packedrtree.js';
import { HttpReader } from 'flatgeobuf/lib/mjs/http-reader.js';
import { Coordinate } from 'ol/coordinate.js';
import { containsCoordinate, Extent, forEachCorner } from 'ol/extent.js';
import { fromExtent } from 'ol/geom/Polygon.js';
import { cartesian2DDistance } from '../util/math.js';
import Projection from '../util/projection.js';

/**
 * values in webmercator
 */
export type PanoramaRTreeNode = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  offset: number;
};

function readNode(dataView: DataView, offset: number): PanoramaRTreeNode {
  const [minX, minY] = Projection.wgs84ToMercator([
    dataView.getFloat64(offset, true),
    dataView.getFloat64(offset + 8, true),
  ]);
  const [maxX, maxY] = Projection.wgs84ToMercator([
    dataView.getFloat64(offset + 16, true),
    dataView.getFloat64(offset + 24, true),
  ]);
  const nodeOffset = dataView.getUint32(offset + 32, true);

  return { minX, minY, maxX, maxY, offset: nodeOffset };
}

export async function getRootNode(
  reader: HttpReader,
): Promise<PanoramaRTreeNode> {
  const lengthBeforeTree = reader.lengthBeforeTree();

  // @ts-expect-error: not actually private
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
  const buffer = (await reader.headerClient.getRange(
    lengthBeforeTree,
    NODE_ITEM_BYTE_LEN,
    0,
    'index',
  )) as ArrayBuffer;
  return readNode(new DataView(buffer), 0);
}

export async function loadTreeLeaves(
  reader: HttpReader,
): Promise<PanoramaRTreeNode[]> {
  const { header } = reader;
  const [start, end] = generateLevelBounds(
    header.featuresCount,
    header.indexNodeSize,
  )[1];

  const lengthBeforeTree = reader.lengthBeforeTree();
  const numberOfNodes = end - start;
  // @ts-expect-error: not actually private
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
  const buffer = (await reader.headerClient.getRange(
    lengthBeforeTree + start * NODE_ITEM_BYTE_LEN,
    numberOfNodes * NODE_ITEM_BYTE_LEN,
    0,
    'index',
  )) as ArrayBuffer;

  const nodes = new Array<PanoramaRTreeNode>(numberOfNodes);
  const dataView = new DataView(buffer);
  for (let i = 0; i < numberOfNodes; i++) {
    nodes[i] = readNode(dataView, i * NODE_ITEM_BYTE_LEN);
  }

  return nodes;
}

function getClosesPointInExtent(
  coordinate: Coordinate,
  extent: Extent,
): Coordinate {
  const polygon = fromExtent(extent);
  return polygon.getClosestPoint(coordinate);
}

export function getSearchExtent(
  coordinate: Coordinate,
  node: PanoramaRTreeNode,
): Extent {
  const nodeExtent = [node.minX, node.minY, node.maxX, node.maxY];

  const pointWithinExtent = containsCoordinate(nodeExtent, coordinate)
    ? coordinate
    : getClosesPointInExtent(coordinate, nodeExtent);
  let farthestDistance = -Infinity;
  forEachCorner(nodeExtent, (corner) => {
    const distance = cartesian2DDistance(corner, pointWithinExtent);
    if (distance > farthestDistance) {
      farthestDistance = distance;
    }
  });

  return [
    pointWithinExtent[0] - farthestDistance,
    pointWithinExtent[1] - farthestDistance,
    pointWithinExtent[0] + farthestDistance,
    pointWithinExtent[1] + farthestDistance,
  ];
}
