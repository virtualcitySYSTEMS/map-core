import Circle from 'ol/geom/Circle.js';
import { fromCircle } from 'ol/geom/Polygon.js';
import { getTransform } from 'ol/proj.js';
import { Cartographic, sampleTerrainMostDetailed } from '@vcmap/cesium';
import { cartesian2DDistance } from '../../util/math.js';
import Projection, { mercatorProjection, wgs84Projection } from '../../util/projection.js';
import { actuallyIsCircle, alreadyTransformedToImage, obliqueGeometry } from '../vectorSymbols.js';
import { convertGeometryToPolygon, getFlatCoordinatesFromGeometry } from '../../util/geometryHelpers.js';
import { transformFromImage } from '../../oblique/helpers.js';

/**
 * @typedef {Object} TransformationOptions
 * @property {boolean|undefined} dontUseTerrain - whether to use the terrain or not
 * @property {import("@vcmap/core").ObliqueImage|undefined} image - the image to use, instead of the current image
 * @property {import("ol/proj/Projection").default|undefined} dataProjection - the projection of the input/output coordinates, assumes wgs84
 */

/**
 * @param {Array<import("ol/coordinate").Coordinate>} coordinates
 * @returns {number}
 */
export function getLongestSide(coordinates) {
  let side = 0;
  for (let i = 0; i < coordinates.length; i++) {
    let j = i + 1;
    if (j >= coordinates.length) {
      j = 0;
    }
    const point1 = coordinates[i];
    const point2 = coordinates[j];
    const currentSide = cartesian2DDistance(point1, point2);
    if (currentSide > side) {
      side = currentSide;
    }
  }
  return side;
}

/**
 * @param {import("ol/Map").default} olMap
 * @param {import("@vcmap/core").ObliqueImage} image
 * @returns {{size: {height: number, width: number}, fovy: number, metersPerUnit: number}}
 */
export function getResolutionOptions(olMap, image) {
  const longestSide = getLongestSide(image.groundCoordinates);
  const fov = Math.PI / 3.0;
  const viewport = /** @type {HTMLElement} */ (olMap.getViewport());
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

/**
 * @param {import("ol/Map").default} olMap
 * @param {import("@vcmap/core").ObliqueImage} image
 * @param {number} distance
 * @returns {number}
 */
export function getZoom(olMap, image, distance) {
  const { size, fovy, metersPerUnit } = getResolutionOptions(olMap, image);
  const visibleMeters = 2 * distance * Math.tan(fovy / 2);
  const visibleMapUnits = visibleMeters / metersPerUnit;
  const resolution = visibleMapUnits / size.height;
  return olMap.getView().getZoomForResolution(resolution);
}


/**
 * converts a geometry in mercator format to image coordinates
 * @param {import("ol/geom/Geometry").default} inputSourceGeometry
 * @param {import("ol/geom/Geometry").default} destinationGeometry
 * @param {import("@vcmap/core").ObliqueImage} image
 * @returns {Promise<import("ol/geom/Geometry").default>}
 */
export async function mercatorGeometryToImageGeometry(inputSourceGeometry, destinationGeometry, image) {
  const sourceGeometry = inputSourceGeometry instanceof Circle ?
    fromCircle(inputSourceGeometry) :
    inputSourceGeometry;
  const coordinates = sourceGeometry.getCoordinates();
  /** type {Array.<import("ol/coordinate").Coordinate>} */
  const flattenCoordinates = getFlatCoordinatesFromGeometry(sourceGeometry, coordinates);
  let transformer = getTransform(mercatorProjection.proj, image.meta.projection.proj);

  let updatedPositions = [];
  if (image.meta.terrainProvider) {
    const cartographicCoordinates = flattenCoordinates.map((coord) => {
      Projection.mercatorToWgs84(coord, true);
      return Cartographic.fromDegrees(coord[0], coord[1]);
    });
    transformer = getTransform(wgs84Projection.proj, image.meta.projection.proj);
    updatedPositions = await sampleTerrainMostDetailed(image.meta.terrainProvider, cartographicCoordinates);
  }

  flattenCoordinates.forEach((coord, index) => {
    transformer(coord, coord, 3);
    const exactHeight = updatedPositions[index] ? updatedPositions[index].height : null;
    const imageCoords = image.transformRealWorld2Image(coord, exactHeight || coord[2] || image.averageHeight);
    flattenCoordinates[index][0] = imageCoords[0];
    flattenCoordinates[index][1] = imageCoords[1];
  });

  destinationGeometry.setCoordinates(coordinates);
  return destinationGeometry;
}

/**
 * returns a cloned geometry geometry with coordinates to format to image coordinates
 * @param {import("ol/geom/Geometry").default} sourceGeometry
 * @param {import("ol/geom/Geometry").default} destinationGeometry
 * @param {import("@vcmap/core").ObliqueImage} image
 * @returns {Promise<import("ol/geom/Geometry").default>}
 */
export function imageGeometryToMercatorGeometry(sourceGeometry, destinationGeometry, image) {
  const coordinates = sourceGeometry.getCoordinates();
  /** type {Array.<import("ol/coordinate").Coordinate>} */
  const flattenCoordinates = getFlatCoordinatesFromGeometry(sourceGeometry, coordinates);
  const promises = flattenCoordinates.map(coord => transformFromImage(image, coord)
    .then((coords) => {
      coord[0] = coords.coords[0];
      coord[1] = coords.coords[1];
      coord[2] = coords.coords[2];
    }));
  return Promise.all(promises)
    .then(() => {
      destinationGeometry.setCoordinates(coordinates);
      return destinationGeometry;
    });
}

/**
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {boolean} [retainRectangle=false]
 * @returns {import("ol/geom/Geometry").default}
 */
export function getPolygonizedGeometry(feature, retainRectangle = false) {
  const geom = feature.getGeometry();
  const isRectangle = geom.get('_vcsGeomType') === 'bbox' || geom.get('_vcsGeomType') === 'rectangle';
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
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} originalFeature
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} obliqueFeature
 */
export function setNewGeometry(originalFeature, obliqueFeature) {
  const originalGeometry = originalFeature.getGeometry();
  const originalGeometryClone = originalFeature.getGeometry().clone();
  obliqueFeature.setGeometry(!originalGeometry[alreadyTransformedToImage] ?
    convertGeometryToPolygon(originalGeometryClone) :
    originalGeometryClone);
  if (originalGeometry[alreadyTransformedToImage]) { // TODO handle UI for bbox and rectangle
    obliqueFeature.getGeometry().setProperties(originalFeature.getGeometry().getProperties(), false);
  }
  originalFeature[obliqueGeometry] = obliqueFeature.getGeometry();
}
