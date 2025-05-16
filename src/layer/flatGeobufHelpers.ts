import type Feature from 'ol/Feature.js';
import { fromFeature } from 'flatgeobuf/lib/mjs/ol/feature.js';
import { NODE_ITEM_BYTE_LEN } from 'flatgeobuf/lib/mjs/packedrtree.js';
import { HttpReader } from 'flatgeobuf/lib/mjs/http-reader.js';
import type Projection from '../util/projection.js';
import { mercatorProjection, parseEPSGCode } from '../util/projection.js';
import type Extent from '../util/extent.js';
import { alreadyTransformedToMercator } from './vectorSymbols.js';

export async function getValidReader(
  url: string,
  projection: Projection,
): Promise<HttpReader> {
  const reader = await HttpReader.open(url, false);
  const { crs } = reader.header;
  if (crs) {
    const epsgCode = parseEPSGCode(crs.code, crs.org ?? undefined);
    if (epsgCode !== projection.epsg) {
      throw new Error(
        `The crs of the data does not match the projection of the layer. Data crs: ${epsgCode}, layer projection: ${projection.epsg}`,
      );
    }
  }
  return reader;
}

export async function getOlFeatures(
  reader: HttpReader,
  projection: Projection,
  extent: Extent,
): Promise<Feature[]> {
  const features = [];
  const isMercator = projection.epsg === mercatorProjection.epsg;
  const dataExtent = extent.getCoordinatesInProjection(projection);

  for await (const feature of reader.selectBbox({
    minX: dataExtent[0],
    minY: dataExtent[1],
    maxX: dataExtent[2],
    maxY: dataExtent[3],
  })) {
    const olFeature = fromFeature(
      feature.id,
      feature.feature,
      reader.header,
    ) as Feature;
    const geometry = olFeature.getGeometry();
    if (geometry && !isMercator) {
      geometry.transform(projection.proj, mercatorProjection.proj);
      geometry[alreadyTransformedToMercator] = true;
    }

    features.push(olFeature);
  }

  return features;
}

/**
 * Values in data projection!
 */
export type PackedRTreeNode = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  offset: number;
};

function readNode(dataView: DataView, offset: number): PackedRTreeNode {
  const minX = dataView.getFloat64(offset, true);
  const minY = dataView.getFloat64(offset + 8, true);
  const maxX = dataView.getFloat64(offset + 16, true);
  const maxY = dataView.getFloat64(offset + 24, true);
  const nodeOffset = dataView.getUint32(offset + 32, true);

  return { minX, minY, maxX, maxY, offset: nodeOffset };
}

/**
 * Extracts the root node from the packed hilbert tree. The data is in data projection.
 * @param reader
 */
export async function getRootNode(
  reader: HttpReader,
): Promise<PackedRTreeNode> {
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
