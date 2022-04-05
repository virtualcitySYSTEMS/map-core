import {
  Cartesian3,
  PolygonGeometry,
  PerInstanceColorAppearance,
  PolygonOutlineGeometry,
  GroundPolylineGeometry,
  PolygonHierarchy,
  PolylineGeometry,
} from '@vcmap/cesium';
import GeometryType from 'ol/geom/GeometryType.js';
import { parseNumber } from '@vcsuite/parsers';
import { addPrimitivesToContext } from './featureconverterHelper.js';
import Projection from '../projection.js';
import { getFlatCoordinatesFromSimpleGeometry } from '../geometryHelpers.js';

/**
 * @param {Object} options
 * @param {number} height
 * @param {boolean} perPositionHeight
 * @param {number=} extrudedHeight
 * @returns {Array<import("@vcmap/cesium").PolygonGeometry>}
 * @private
 */
export function createSolidGeometries(options, height, perPositionHeight, extrudedHeight) {
  const polygonOptions = {
    ...options,
    perPositionHeight,
    extrudedHeight,
  };
  if (!perPositionHeight) {
    polygonOptions.height = height;
  }
  return [new PolygonGeometry(polygonOptions)];
}

/**
 * @param {Object} options
 * @param {number} height
 * @param {boolean} perPositionHeight
 * @param {number=} extrudedHeight
 * @returns {Array<import("@vcmap/cesium").PolygonOutlineGeometry>}
 * @private
 */
export function createOutlineGeometries(options, height, perPositionHeight, extrudedHeight) {
  return [new PolygonOutlineGeometry({
    ...options,
    height: perPositionHeight ? undefined : height,
    extrudedHeight,
    perPositionHeight,
    vertexFormat: PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
  })];
}

/**
 * @param {Object} options
 * @param {number} height
 * @param {boolean} perPositionHeight
 * @returns {Array<import("@vcmap/cesium").PolygonGeometry>}
 * @private
 */
export function createFillGeometries(options, height, perPositionHeight) {
  return createSolidGeometries(options, height, perPositionHeight, undefined);
}

/**
 * @param {Object} options
 * @param {import("ol/style/Style").default} style
 * @returns {Array<Object>}
 * @private
 */
export function getLineGeometryOptions(options, style) {
  const width = parseNumber(style.getStroke().getWidth(), 1.0);
  const geometryOptions = [];
  geometryOptions.push({
    positions: options.polygonHierarchy.positions,
    width,
  });
  options.polygonHierarchy.holes.forEach((polygonHierarchy) => {
    geometryOptions.push({
      positions: polygonHierarchy.positions,
      width,
    });
  });
  return geometryOptions;
}

/**
 * @param {Object} options
 * @param {import("ol/style/Style").default} style
 * @returns {Array<GroundPolylineGeometry>}
 * @private
 */
export function createGroundLineGeometries(options, style) {
  return getLineGeometryOptions(options, style).map((option) => {
    return new GroundPolylineGeometry(option);
  });
}

/**
 * @param {Object} options
 * @param {import("ol/style/Style").default} style
 * @returns {Array<PolylineGeometry>}
 * @private
 */
export function createLineGeometries(options, style) {
  return getLineGeometryOptions(options, style).map((option) => {
    return new PolylineGeometry(option);
  });
}


/**
 * @param {import("ol/geom/Polygon").default} geometry
 * @param {number} positionHeightAdjustment
 * @returns {Object}
 * @private
 */
export function getGeometryOptions(geometry, positionHeightAdjustment) {
  let hieraryPositions;
  const holes = [];
  const rings = geometry.getLinearRings();
  for (let i = 0; i < rings.length; i++) {
    const coords = rings[i].getCoordinates();
    const positions = coords.map((coord) => {
      const wgs84Coords = Projection.mercatorToWgs84(coord);
      if (wgs84Coords[2] != null) {
        wgs84Coords[2] += positionHeightAdjustment;
      }
      return Cartesian3.fromDegrees(wgs84Coords[0], wgs84Coords[1], wgs84Coords[2]);
    });
    // make sure the last and first vertex is identical.
    if (!Cartesian3.equals(positions[0], positions[positions.length - 1])) {
      positions.push(positions[0]);
    }
    if (i === 0) {
      hieraryPositions = positions;
    } else {
      holes.push(new PolygonHierarchy(positions));
    }
  }
  return {
    polygonHierarchy: new PolygonHierarchy(hieraryPositions, holes),
  };
}

/**
 * @param {Array<import("ol/geom/Polygon").default>} geometries
 * @returns {Array<import("ol/coordinate").Coordinate>}
 * @private
 */
export function getCoordinates(geometries) {
  const coordinates = [];
  geometries.forEach((polygon) => {
    coordinates.push(...getFlatCoordinatesFromSimpleGeometry(polygon));
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
 * TODO maybe add validation Functions to OpenlayersMap
 * validates if a polygon is renderable
 * @param {import("ol/geom/Polygon").default} polygon
 * @returns {boolean}
 */
export function validatePolygon(polygon) {
  if (polygon.getType() !== GeometryType.POLYGON) {
    return false;
  }
  const flatCoordinates = polygon.getFlatCoordinates();
  const ends = polygon.getEnds();
  const stride = polygon.getStride();
  const valid = ends.every((end, index) => {
    const previous = index ? ends[index - 1] : 0;
    const currentRingSize = end - previous;
    return currentRingSize >= stride * 3;
  });
  if (!valid) {
    return false;
  }
  // should have at least three coordinates for each linearRing and every value should be a number
  const minimumValues = stride * 3 * polygon.getLinearRingCount();
  if (flatCoordinates && flatCoordinates.length >= minimumValues && polygon.getLinearRingCount()) {
    return flatCoordinates.every(value => Number.isFinite(value));
  }
  return false;
}

/**
 * converts a polygon to a a cesium primitive, with optional labels
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {import("ol/style/Style").default} style
 * @param {Array<import("ol/geom/Polygon").default>} geometries
 * @param {import("@vcmap/core").VectorProperties} vectorProperties
 * @param {import("@vcmap/cesium").Scene} scene
 * @param {import("@vcmap/core").VectorContext|import("@vcmap/core").ClusterContext} context
 */
export default function polygonToCesium(feature, style, geometries, vectorProperties, scene, context) {
  if (!style.getFill() && !style.getStroke()) {
    return;
  }
  const polygonGeometryFactory = getGeometryFactory();
  const validGeometries = geometries.filter(polygon => validatePolygon(polygon));
  addPrimitivesToContext(
    feature, style, validGeometries, vectorProperties, scene, polygonGeometryFactory, context,
  );
}
