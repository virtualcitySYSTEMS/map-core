import { Cartesian3, WallGeometry, WallOutlineGeometry, GroundPolylineGeometry, PolylineGeometry } from '@vcmap/cesium';
import GeometryType from 'ol/geom/GeometryType.js';
import { parseNumber } from '@vcsuite/parsers';
import Projection from '../projection.js';
import { addPrimitivesToContext } from './featureconverterHelper.js';
import { getFlatCoordinatesFromSimpleGeometry } from '../geometryHelpers.js';

/**
 * @param {Object} options
 * @param {number} height
 * @param {boolean} perPositionHeight
 * @param {number=} extrudedHeight
 * @returns {Array<import("@vcmap/cesium").WallGeometry>}
 * @private
 */
export function createSolidGeometries(options, height, perPositionHeight, extrudedHeight) {
  return [WallGeometry.fromConstantHeights({
    ...options,
    maximumHeight: !perPositionHeight ? height : undefined,
    minimumHeight: extrudedHeight,
  })];
}

/**
 * @param {Object} options
 * @param {number} height
 * @param {boolean} perPositionHeight
 * @param {number=} extrudedHeight
 * @returns {Array<import("@vcmap/cesium").WallOutlineGeometry>}
 * @private
 */
export function createOutlineGeometries(options, height, perPositionHeight, extrudedHeight) {
  // maxium and minimum are flipped, to create the same perPositionHeight behaviour as in polygons
  // WallGeometries extrudes down instead of up, so we switch the behaviour and extrude in the other direction
  return [WallOutlineGeometry.fromConstantHeights({
    ...options,
    maximumHeight: !perPositionHeight ? height : undefined,
    minimumHeight: extrudedHeight,
  })];
}

/**
 * @param {Object} options
 * @param {number} height
 * @param {boolean} perPositionHeight
 * @returns {Array}
 * @private
 */
// eslint-disable-next-line no-unused-vars
export function createFillGeometries(options, height, perPositionHeight) {
  return [];
}


/**
 * @param {Object} options
 * @param {import("ol/style/Style").default} style
 * @returns {Array<import("@vcmap/cesium").GroundPolylineGeometry>}
 * @private
 */
export function createGroundLineGeometries(options, style) {
  const width = parseNumber(style.getStroke().getWidth(), 1.0);
  return [new GroundPolylineGeometry({
    ...options,
    width,
  })];
}

/**
 * @param {Object} options
 * @param {import("ol/style/Style").default} style
 * @returns {Array<import("@vcmap/cesium").PolylineGeometry>}
 * @private
 */
export function createLineGeometries(options, style) {
  const width = parseNumber(style.getStroke().getWidth(), 1.0);
  return [new PolylineGeometry({
    ...options,
    width,
  })];
}

/**
 * extracts the center and radius from the CircleGeometry and converts it to Cartesian3/radius in m
 * @param {import("ol/geom/LineString").default} geometry
 * @param {number} positionHeightAdjustment
 * @returns {Object}
 * @private
 */
export function getGeometryOptions(geometry, positionHeightAdjustment) {
  const coords = geometry.getCoordinates();
  const positions = coords.map((coord) => {
    const wgs84Coords = Projection.mercatorToWgs84(coord);
    if (wgs84Coords[2] != null) {
      wgs84Coords[2] += positionHeightAdjustment;
    }
    return Cartesian3.fromDegrees(wgs84Coords[0], wgs84Coords[1], wgs84Coords[2]);
  });
  return { positions };
}

/**
 * @param {Array<import("ol/geom/LineString").default>} geometries
 * @returns {Array<import("ol/coordinate").Coordinate>}
 * @private
 */
export function getCoordinates(geometries) {
  const coordinates = [];
  geometries.forEach((lineString) => {
    coordinates.push(...getFlatCoordinatesFromSimpleGeometry(lineString));
  });
  return coordinates;
}

/**
 * @type {VectorGeometryFactoryType|null}
 */
let geometryFactory = null;

/**
 * @returns {VectorGeometryFactoryType}
 */
function getGeometryFactory() {
  if (!geometryFactory) {
    geometryFactory = {
      getCoordinates,
      getGeometryOptions,
      createSolidGeometries,
      createOutlineGeometries,
      createFillGeometries,
      createGroundLineGeometries,
      createLineGeometries,
    };
  }
  return geometryFactory;
}

/**
 * validates if a lineString is renderable
 * @param {import("ol/geom/LineString").default} lineString
 * @returns {boolean}
 */
export function validateLineString(lineString) {
  if (lineString.getType() !== GeometryType.LINE_STRING) {
    return false;
  }
  const flatCoordinates = lineString.getFlatCoordinates();
  const minimumValues = lineString.getStride() * 2;
  if (flatCoordinates && flatCoordinates.length >= minimumValues) {
    return flatCoordinates.every(value => Number.isFinite(value));
  }
  return false;
}

/**
 * converts a linestring to a a cesium primitive, with optional labels
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {import("ol/style/Style").default} style
 * @param {Array<import("ol/geom/LineString").default>} geometries
 * @param {import("@vcmap/core").VectorProperties} vectorProperties
 * @param {import("@vcmap/cesium").Scene} scene
 * @param {import("@vcmap/core").VectorContext|import("@vcmap/core").ClusterContext} context
 */
export default function lineStringToCesium(feature, style, geometries, vectorProperties, scene, context) {
  if (!style.getFill() && !style.getStroke()) {
    return;
  }
  const lineGeometryFactory = getGeometryFactory();
  const validGeometries = geometries.filter(lineString => validateLineString(lineString));
  addPrimitivesToContext(feature, style, validGeometries, vectorProperties, scene, lineGeometryFactory, context);
}
