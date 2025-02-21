import Feature from 'ol/Feature.js';
import { fromFeature } from 'flatgeobuf/lib/mjs/ol/feature.js';
import { HttpReader } from 'flatgeobuf/lib/mjs/http-reader.js';
import Projection, {
  mercatorProjection,
  parseEPSGCode,
} from '../util/projection.js';
import Extent from '../util/extent.js';
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
