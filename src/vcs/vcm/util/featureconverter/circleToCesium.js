import { circular } from 'ol/geom/Polygon.js';
import GeometryType from 'ol/geom/GeometryType.js';
import {
  Cartesian3,
  CircleGeometry,
  GroundPolylineGeometry,
  CircleOutlineGeometry,
  Math as CesiumMath,
  Cartographic,
  PolylineGeometry,
} from '@vcmap/cesium';
import { parseNumber } from '@vcsuite/parsers';
import { addPrimitivesToContext } from './featureconverterHelper.js';
import Projection from '../projection.js';

/**
 * @param {Object} options
 * @param {number} height
 * @param {boolean} perPositionHeight
 * @param {number=} extrudedHeight
 * @returns {Array<Cesium/CircleGeometry>}
 */
export function createSolidGeometries(options, height, perPositionHeight, extrudedHeight) {
  return [new CircleGeometry({
    ...options,
    height,
    granularity: 0.02,
    extrudedHeight,
  })];
}

/**
 * @param {Object} options
 * @param {number} height
 * @param {boolean} perPositionHeight
 * @param {number=} extrudedHeight
 * @returns {Array<Cesium/CircleOutlineGeometry>}
 */
export function createOutlineGeometries(options, height, perPositionHeight, extrudedHeight) {
  return [new CircleOutlineGeometry({
    ...options,
    height,
    extrudedHeight,
    granularity: 0.02,
  })];
}

/**
 * @param {Object} options
 * @param {number} height
 * @param {boolean} perPositionHeight
 * @returns {Array<Cesium/CircleGeometry>}
 */
export function createFillGeometries(options, height, perPositionHeight) {
  return createSolidGeometries(options, height, perPositionHeight, undefined);
}

/**
 * @param {Object} options
 * @param {ol/style/Style} style
 * @returns {{width: number, positions: Array}}
 */
export function getLineGeometryOptions(options, style) {
  const width = parseNumber(style.getStroke().getWidth(), 1.0);
  const { center, radius } = options;
  const cartographic = Cartographic.fromCartesian(center);
  const wgs84Center = [
    CesiumMath.toDegrees(cartographic.longitude),
    CesiumMath.toDegrees(cartographic.latitude),
  ];

  // circular returns polygon with GeometryLayout.XY
  const circlePolygon = circular(
    wgs84Center,
    radius,
    40,
  );
  const pos = circlePolygon.getLinearRing(0).getCoordinates();
  const positions = pos.map((coord) => {
    return Cartesian3.fromDegrees(coord[0], coord[1], cartographic.height);
  });
  return {
    positions,
    width,
  };
}

/**
 * @param {Object} options
 * @param {ol/style/Style} style
 * @returns {Array<Cesium/GroundPolylineGeometry>}
 */
export function createGroundLineGeometries(options, style) {
  const lineOptions = getLineGeometryOptions(options, style);
  return [new GroundPolylineGeometry(lineOptions)];
}

/**
 * @param {Object} options
 * @param {ol/style/Style} style
 * @returns {Array<Cesium/PolylineGeometry>}
 */
export function createLineGeometries(options, style) {
  const lineOptions = getLineGeometryOptions(options, style);
  return [new PolylineGeometry(lineOptions)];
}

/**
 * extracts the center and radius from the CircleGeometry and converts it to Cartesian3/radius in m
 * @param {ol/geom/Circle} geometry
 * @param {number} positionHeightAdjustment
 * @returns {{center: Cesium/Cartesian3, radius: Number}}
 */
export function getGeometryOptions(geometry, positionHeightAdjustment) {
  // olCoordinates of center and radius in WGS84
  const olCenter = geometry.getCenter();
  const olPoint = olCenter.slice();
  olPoint[0] += geometry.getRadius();
  const wgs84Center = Projection.mercatorToWgs84(olCenter, true);
  if (wgs84Center[2] != null) {
    wgs84Center[2] += positionHeightAdjustment;
  }

  const wgs84Point = Projection.mercatorToWgs84(olPoint, true);

  // Cesium coordinates of center and radius
  const center = Cartesian3.fromDegrees(wgs84Center[0], wgs84Center[1], wgs84Center[2]);
  const point = Cartesian3.fromDegrees(wgs84Point[0], wgs84Point[1], wgs84Center[2]);

  // Computation of radius in Cesium 3D
  const radius = Cartesian3.distance(center, point);
  return {
    radius,
    center,
  };
}

/**
 * @param {Array<ol/geom/Circle>} geometries
 * @returns {Array<ol/Coordinate>}
 */
export function getCoordinates(geometries) {
  return geometries.map((circle) => {
    return circle.getCenter();
  });
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
 * validates if a point is renderable
 * @param {ol/geom/Circle} circle
 * @returns {boolean}
 */
export function validateCircle(circle) {
  if (circle.getType() !== GeometryType.CIRCLE) {
    return false;
  }
  const flatCoordinates = circle.getFlatCoordinates();
  const stride = circle.getStride();
  // needs at least one full coordinate + a radius value and a non 0 radius
  if (flatCoordinates && flatCoordinates.length >= stride + 1 && flatCoordinates[stride] !== flatCoordinates[0]) {
    return flatCoordinates.every(value => Number.isFinite(value));
  }
  return false;
}


/**
 * @param {ol/Feature} feature
 * @param {ol/style/Style} style
 * @param {Array<ol/geom/Circle>} geometries
 * @param {vcs.vcm.layer.VectorProperties} vectorProperties
 * @param {Cesium/Scene} scene
 * @param {vcs.vcm.layer.cesium.VectorContext|vcs.vcm.layer.cesium.ClusterContext} context
 */
export default function circleToCesium(feature, style, geometries, vectorProperties, scene, context) {
  if (!style.getFill() && !style.getStroke()) {
    return;
  }
  const circleGeometryFactory = getGeometryFactory();
  const validGeometries = geometries.filter(circle => validateCircle(circle));
  addPrimitivesToContext(
    feature, style, validGeometries, vectorProperties, scene, circleGeometryFactory, context,
  );
}
