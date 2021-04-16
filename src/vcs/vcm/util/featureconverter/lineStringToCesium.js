import Cartesian3 from 'cesium/Source/Core/Cartesian3.js';
import WallGeometry from 'cesium/Source/Core/WallGeometry.js';
import WallOutlineGeometry from 'cesium/Source/Core/WallOutlineGeometry.js';
import GroundPolylineGeometry from 'cesium/Source/Core/GroundPolylineGeometry.js';
import PolylineGeometry from 'cesium/Source/Core/PolylineGeometry.js';
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
 * @returns {Array<Cesium/WallGeometry>}
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
 * @returns {Array<Cesium/WallOutlineGeometry>}
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
 */
// eslint-disable-next-line no-unused-vars
export function createFillGeometries(options, height, perPositionHeight) {
  return [];
}


/**
 * @param {Object} options
 * @param {ol/style/Style} style
 * @returns {Array<Cesium/GroundPolylineGeometry>}
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
 * @param {ol/style/Style} style
 * @returns {Array<Cesium/PolylineGeometry>}
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
 * @param {ol/geom/LineString} geometry
 * @param {number} positionHeightAdjustment
 * @returns {Object}
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
 * @param {Array<ol/geom/LineString>} geometries
 * @returns {Array<ol/Coordinate>}
 */
export function getCoordinates(geometries) {
  const coordinates = [];
  geometries.forEach((lineString) => {
    coordinates.push(...getFlatCoordinatesFromSimpleGeometry(lineString));
  });
  return coordinates;
}

/**
 * @type {vcs.vcm.layer.Vector.GeometryFactoryType|null}
 */
let geometryFactory = null;

/**
 * @returns {vcs.vcm.layer.Vector.GeometryFactoryType}
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
 * @param {ol/geom/LineString} lineString
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
 * @param {ol/Feature} feature
 * @param {ol/style/Style} style
 * @param {Array<ol/geom/LineString>} geometries
 * @param {vcs.vcm.layer.VectorProperties} vectorProperties
 * @param {Cesium/Scene} scene
 * @param {vcs.vcm.layer.cesium.VectorContext|vcs.vcm.layer.cesium.ClusterContext} context
 */
export default function lineStringToCesium(feature, style, geometries, vectorProperties, scene, context) {
  if (!style.getFill() && !style.getStroke()) {
    return;
  }
  const lineGeometryFactory = getGeometryFactory();
  const validGeometries = geometries.filter(lineString => validateLineString(lineString));
  addPrimitivesToContext(feature, style, validGeometries, vectorProperties, scene, lineGeometryFactory, context);
}
