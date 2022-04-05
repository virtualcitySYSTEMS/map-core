import { offset } from 'ol/sphere.js';
import Circle from 'ol/geom/Circle.js';
import Point from 'ol/geom/Point.js';
import LineString from 'ol/geom/LineString.js';
import Polygon, { fromCircle } from 'ol/geom/Polygon.js';
import MultiPoint from 'ol/geom/MultiPoint.js';
import MultiLineString from 'ol/geom/MultiLineString.js';
import MultiPolygon from 'ol/geom/MultiPolygon.js';
import GeometryCollection from 'ol/geom/GeometryCollection.js';
import Projection from './projection.js';

/**
 * @param {import("ol/geom/SimpleGeometry").default} geometry
 * @returns {Array<import("ol/coordinate").Coordinate>}
 */
export function getFlatCoordinatesFromSimpleGeometry(geometry) {
  const stride = geometry.getStride();
  const flatCoordinates = geometry.getFlatCoordinates();
  if (flatCoordinates.length) {
    const numberOfCoordinates = Math.floor(flatCoordinates.length / stride);
    const coordinates = new Array(numberOfCoordinates);
    for (let i = 0; i < numberOfCoordinates; i++) {
      const flatIndex = i * stride;
      const coord = new Array(stride);
      for (let j = 0; j < stride; j++) {
        coord[j] = flatCoordinates[flatIndex + j];
      }
      coordinates[i] = coord;
    }
    return coordinates;
  }
  return [];
}

/**
 * @param {import("ol/geom/Geometry").default} geometry
 * @param {Array=} inputCoordinates
 * @returns {Array.<import("ol/coordinate").Coordinate>}
 */
export function getFlatCoordinatesFromGeometry(geometry, inputCoordinates) {
  const coordinates = inputCoordinates || geometry.getCoordinates();
  let flattenCoordinates = null;
  if (geometry instanceof Point) {
    flattenCoordinates = [coordinates];
  } else if (geometry instanceof LineString) {
    flattenCoordinates = coordinates;
  } else if (geometry instanceof Polygon) {
    flattenCoordinates = coordinates.reduce((current, next) => current.concat(next));
  } else if (geometry instanceof MultiPoint) {
    flattenCoordinates = coordinates;
  } else if (geometry instanceof MultiLineString) {
    flattenCoordinates = coordinates.reduce((current, next) => current.concat(next));
  } else if (geometry instanceof MultiPolygon) {
    flattenCoordinates = coordinates
      .reduce((current, next) => current.concat(next))
      .reduce((current, next) => current.concat(next));
  } else if (geometry instanceof Circle) {
    flattenCoordinates = coordinates;
  } else if (geometry instanceof GeometryCollection) {
    flattenCoordinates = geometry.getGeometries()
      .map((g, i) => getFlatCoordinatesFromGeometry(g, coordinates[i]))
      .reduce((current, next) => current.concat(next));
  }
  return flattenCoordinates;
}

/**
 * @param {import("ol/coordinate").Coordinate} center
 * @param {number} radius
 * @returns {import("ol/geom/Circle").default}
 */
export function circleFromCenterRadius(center, radius) {
  const offsetWGS84 = offset(Projection.mercatorToWgs84(center), radius, Math.PI / 2);
  const of = Projection.wgs84ToMercator(offsetWGS84);
  const dx = center[0] - of[0];
  const dy = center[1] - of[1];
  const dx2 = dx * dx;
  const dy2 = dy * dy;
  const radiusProjected = Math.sqrt(dx2 + dy2);
  return new Circle(
    center,
    radiusProjected,
    'XYZ',
  );
}

/**
 * @param {import("ol/geom/Geometry").default} geometry
 * @returns {import("ol/geom/Geometry").default}
 */
export function convertGeometryToPolygon(geometry) {
  if (geometry instanceof Circle) {
    return fromCircle(geometry);
  } else if (geometry instanceof Polygon) {
    geometry.unset('_vcsGeomType');
  }
  return geometry;
}

/**
 * @param {Array<import("ol/coordinate").Coordinate>} linearRing
 */
export function enforceEndingVertex(linearRing) {
  const [lastX, lastY] = linearRing[linearRing.length - 1];
  if (!(linearRing[0][0] === lastX && linearRing[0][1] === lastY)) {
    linearRing.push(linearRing[0].slice());
  }
}

/**
 * @param {Array<import("ol/coordinate").Coordinate>} linearRing
 */
export function removeEndingVertex(linearRing) {
  const [lastX, lastY] = linearRing[linearRing.length - 1];
  if (linearRing[0][0] === lastX && linearRing[0][1] === lastY) {
    linearRing.pop();
  }
}

/**
 * @param {import("ol/geom/Geometry").default} geometry
 */
export function removeEndingVertexFromGeometry(geometry) {
  if (geometry instanceof Polygon) {
    const coordinates = geometry.getCoordinates();
    coordinates.forEach((ring) => {
      removeEndingVertex(ring);
    });
    geometry.setCoordinates(coordinates);
  } else if (geometry instanceof MultiPolygon) {
    const coordinates = geometry.getCoordinates();
    coordinates.forEach((poly) => {
      poly.forEach((ring) => {
        removeEndingVertex(ring);
      });
    });
    geometry.setCoordinates(coordinates);
  }
}

/**
 * from @mapbox/geojson-area
 * @param {Array<Array<number>>}ring
 * @returns {number}
 */
function ringArea(ring) {
  let area = 0;
  const positions = ring.length;

  for (let i = 0; i <= positions - 2; i++) {
    const p1 = ring[i];
    const p2 = ring[i + 1];
    area += ((p1[0] * p2[1]) - (p1[1] * p2[0]));
  }

  area /= 2;
  return area;
}

/**
 * enforce a ring to be counter-clockwise
 * @param {Array<import("ol/coordinate").Coordinate>} ring
 * @returns {Array<import("ol/coordinate").Coordinate>}
 */
export function enforceRightHand(ring) {
  const area = ringArea(ring);
  if (area < 0) {
    ring.reverse();
  }

  return ring;
}
