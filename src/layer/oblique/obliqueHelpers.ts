import Circle from 'ol/geom/Circle.js';
import { fromCircle } from 'ol/geom/Polygon.js';
import { getTransform } from 'ol/proj.js';
import type { Coordinate } from 'ol/coordinate.js';
import type OLMap from 'ol/Map.js';
import type { Geometry } from 'ol/geom.js';
import type { Feature } from 'ol/index.js';

import { Cartographic, sampleTerrainMostDetailed } from '@vcmap-cesium/engine';
import { cartesian2DDistanceSquared } from '../../util/math.js';
import Projection, {
  mercatorProjection,
  wgs84Projection,
} from '../../util/projection.js';
import {
  actuallyIsCircle,
  alreadyTransformedToImage,
  obliqueGeometry,
} from '../vectorSymbols.js';
import {
  convertGeometryToPolygon,
  getFlatCoordinateReferences,
} from '../../util/geometryHelpers.js';
import { transformFromImage } from '../../oblique/helpers.js';
import type ObliqueImage from '../../oblique/obliqueImage.js';

export function getLongestSide(coordinates: Coordinate[]): number {
  let sideSquared = 0;
  for (let i = 0; i < coordinates.length; i++) {
    let j = i + 1;
    if (j >= coordinates.length) {
      j = 0;
    }
    const point1 = coordinates[i];
    const point2 = coordinates[j];
    const currentSideSquared = cartesian2DDistanceSquared(point1, point2);
    if (currentSideSquared > sideSquared) {
      sideSquared = currentSideSquared;
    }
  }
  return Math.sqrt(sideSquared);
}

export function getResolutionOptions(
  olMap: OLMap,
  image: ObliqueImage,
): {
  size: { height: number; width: number };
  fovy: number;
  metersPerUnit: number;
} {
  const longestSide = getLongestSide(image.groundCoordinates);
  const fov = Math.PI / 3.0;
  const viewport = olMap.getViewport();
  const size = {
    height: viewport.offsetHeight || 1,
    width: viewport.offsetWidth || 1,
  };
  const aspectRatio = size.width / size.height;
  const fovy = Math.atan(Math.tan(fov * 0.5) / aspectRatio) * 2.0;

  const [imageSizeX, imageSizeY] = image.meta.size;
  const longestImageSize = imageSizeX > imageSizeY ? imageSizeX : imageSizeY;
  const metersPerUnit = longestSide / longestImageSize;
  return {
    size,
    fovy,
    metersPerUnit,
  };
}

export function getZoom(
  olMap: OLMap,
  image: ObliqueImage,
  distance: number,
): number {
  const { size, fovy, metersPerUnit } = getResolutionOptions(olMap, image);
  const visibleMeters = 2 * distance * Math.tan(fovy / 2);
  const visibleMapUnits = visibleMeters / metersPerUnit;
  const resolution = visibleMapUnits / size.height;
  return olMap.getView().getZoomForResolution(resolution) as number;
}

/**
 * converts a geometry in mercator format to image coordinates
 * @param  inputSourceGeometry
 * @param  destinationGeometry
 * @param  image
 */
export async function mercatorGeometryToImageGeometry(
  inputSourceGeometry: Geometry,
  destinationGeometry: Geometry,
  image: ObliqueImage,
): Promise<Geometry> {
  const sourceGeometry =
    inputSourceGeometry instanceof Circle
      ? fromCircle(inputSourceGeometry)
      : inputSourceGeometry;
  const coordinates = sourceGeometry.getCoordinates() as any[];
  const flattenCoordinates = getFlatCoordinateReferences(
    sourceGeometry,
    coordinates,
  );
  let transformer = getTransform(
    mercatorProjection.proj,
    image.meta.projection.proj,
  );

  let updatedPositions: Cartographic[] = [];
  if (image.meta.terrainProvider) {
    const cartographicCoordinates = flattenCoordinates.map((coord) => {
      Projection.mercatorToWgs84(coord, true);
      return Cartographic.fromDegrees(coord[0], coord[1]);
    });
    transformer = getTransform(
      wgs84Projection.proj,
      image.meta.projection.proj,
    );
    updatedPositions = await sampleTerrainMostDetailed(
      image.meta.terrainProvider,
      cartographicCoordinates,
    );
  }

  flattenCoordinates.forEach((coord, index) => {
    transformer(coord, coord, 3);
    const exactHeight = updatedPositions[index]
      ? updatedPositions[index].height
      : null;
    const imageCoords = image.transformRealWorld2Image(
      coord,
      exactHeight || coord[2] || image.averageHeight,
    );
    flattenCoordinates[index][0] = imageCoords[0];
    flattenCoordinates[index][1] = imageCoords[1];
  });

  destinationGeometry.setCoordinates(coordinates);
  return destinationGeometry;
}

/**
 * returns a cloned geometry geometry with coordinates to format to image coordinates
 * @param  sourceGeometry
 * @param  destinationGeometry
 * @param  image
 */
export function imageGeometryToMercatorGeometry(
  sourceGeometry: Geometry,
  destinationGeometry: Geometry,
  image: ObliqueImage,
): Promise<Geometry> {
  const coordinates = sourceGeometry.getCoordinates() as any[];
  const flattenCoordinates = getFlatCoordinateReferences(
    sourceGeometry,
    coordinates,
  );
  const promises = flattenCoordinates.map((coord) =>
    transformFromImage(image, coord).then((coords) => {
      coord[0] = coords.coords[0];
      coord[1] = coords.coords[1];
      coord[2] = coords.coords[2];
    }),
  );
  return Promise.all(promises).then(() => {
    delete destinationGeometry[alreadyTransformedToImage];
    destinationGeometry.setCoordinates(coordinates);
    return destinationGeometry;
  });
}

/**
 * @param  feature
 * @param  [retainRectangle=false]
 */
export function getPolygonizedGeometry(
  feature: Feature,
  retainRectangle = false,
): Geometry {
  const geom = feature.getGeometry() as Geometry;
  const isRectangle =
    geom.get('_vcsGeomType') === 'bbox' ||
    geom.get('_vcsGeomType') === 'rectangle';
  if (isRectangle && retainRectangle) {
    return geom;
  }

  const isCircle = geom instanceof Circle;
  const converted = convertGeometryToPolygon(geom);
  converted[actuallyIsCircle] = isCircle;
  return converted;
}

/**
 * sets the geometry from the originalfeature to the oblique feature
 * @param  originalFeature
 * @param  obliqueFeature
 */
export function setNewGeometry(
  originalFeature: Feature,
  obliqueFeature: Feature,
): void {
  const originalGeometry = originalFeature.getGeometry() as Geometry;
  const originalGeometryClone = originalFeature.getGeometry()!.clone();
  obliqueFeature.setGeometry(
    !originalGeometry[alreadyTransformedToImage]
      ? convertGeometryToPolygon(originalGeometryClone)
      : originalGeometryClone,
  );
  if (originalGeometry[alreadyTransformedToImage]) {
    // TODO handle UI for bbox and rectangle
    obliqueFeature
      .getGeometry()!
      .setProperties(originalFeature.getGeometry()!.getProperties(), false);
  }
  originalFeature[obliqueGeometry] = obliqueFeature.getGeometry();
}
