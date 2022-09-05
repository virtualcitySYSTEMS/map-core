import Point from 'ol/geom/Point.js';
import Feature from 'ol/Feature.js';
import { Cartesian2, Cartesian3, Math as CesiumMath, Plane } from '@vcmap/cesium';
import Projection from '../projection.js';
import { vertexSymbol } from './editorSymbols.js';
import Vector from '../../layer/vectorLayer.js';

/**
 * @param {import("ol/coordinate").Coordinate} coordinate
 * @returns {Vertex}
 */
export function createVertex(coordinate) {
  const geometry = new Point(coordinate);
  geometry[Vector.alreadyTransformedToImage] = true;
  const vertex = new Feature({
    geometry,
  });
  vertex[vertexSymbol] = true;
  vertex[Vector.doNotTransform] = true;
  return vertex;
}

let scratchCartesian21 = new Cartesian2();
let scratchCartesian22 = new Cartesian2();
let scratchCartesian23 = new Cartesian2();
let scratchCartesian31 = new Cartesian3();
let scratchCartesian32 = new Cartesian3();
let scratchCartesian33 = new Cartesian3();

/**
 * @param {import("ol/coordinate").Coordinate} start - line segment start
 * @param {import("ol/coordinate").Coordinate} end - line segment end
 * @param {import("ol/coordinate").Coordinate} point - the point to project
 * @param {number=} [epsilon=CesiumMath.EPSILON5]
 * @returns {boolean}
 */
export function pointOnLine3D(start, end, point, epsilon = CesiumMath.EPSILON5) {
  scratchCartesian31 = Cartesian3
    .fromElements(end[0] - start[0], end[1] - start[1], end[2] - start[2], scratchCartesian31);
  scratchCartesian32 = Cartesian3
    .fromElements(point[0] - start[0], point[1] - start[1], point[2] - start[2], scratchCartesian32);
  scratchCartesian33 = Cartesian3
    .fromElements(point[0] - end[0], point[1] - end[1], point[2] - point[2], scratchCartesian33);
  const mag1 = Cartesian3.magnitude(scratchCartesian31);
  if (
    mag1 < Cartesian3.magnitude(scratchCartesian32) ||
    mag1 < Cartesian3.magnitude(scratchCartesian33)
  ) {
    return false;
  }

  scratchCartesian31 = Cartesian3.normalize(scratchCartesian31, scratchCartesian31);
  scratchCartesian32 = Cartesian3.normalize(scratchCartesian32, scratchCartesian32);
  return scratchCartesian31.equalsEpsilon(scratchCartesian32, epsilon);
}


/**
 * @param {import("ol/coordinate").Coordinate} start - line segment start
 * @param {import("ol/coordinate").Coordinate} end - line segment end
 * @param {import("ol/coordinate").Coordinate} point - the point to project
 * @param {number=} [epsilon=CesiumMath.EPSILON5]
 * @returns {boolean}
 */
export function pointOnLine2D(start, end, point, epsilon = CesiumMath.EPSILON5) {
  scratchCartesian21 = Cartesian2.fromElements(end[0] - start[0], end[1] - start[1], scratchCartesian21);
  scratchCartesian22 = Cartesian2.fromElements(point[0] - start[0], point[1] - start[1], scratchCartesian22);
  scratchCartesian23 = Cartesian2.fromElements(point[0] - end[0], point[1] - end[1], scratchCartesian23);
  const mag1 = Cartesian2.magnitude(scratchCartesian21);
  if (
    mag1 < Cartesian2.magnitude(scratchCartesian22) ||
    mag1 < Cartesian2.magnitude(scratchCartesian23)
  ) {
    return false;
  }

  scratchCartesian21 = Cartesian2.normalize(scratchCartesian21, scratchCartesian21);
  scratchCartesian22 = Cartesian2.normalize(scratchCartesian22, scratchCartesian22);

  return scratchCartesian21.equalsEpsilon(scratchCartesian22, epsilon);
}

/**
 * @param {import("ol/coordinate").Coordinate} originCoordinates
 * @param {import("@vcmap/cesium").Scene} scene
 * @returns {!import("@vcmap/cesium").Plane}
 */
export function createVerticalPlane(originCoordinates, scene) {
  const wgs84 = Projection.mercatorToWgs84(originCoordinates);
  scratchCartesian31 = Cartesian3.fromDegrees(wgs84[0], wgs84[1], wgs84[2]);
  scratchCartesian32 = scene.globe.ellipsoid.geodeticSurfaceNormal(scratchCartesian31, scratchCartesian32);
  scratchCartesian32 = Cartesian3.cross(scene.camera.rightWC, scratchCartesian32, scratchCartesian32);
  scratchCartesian32 = Cartesian3.normalize(scratchCartesian32, scratchCartesian32);

  return Plane.fromPointNormal(scratchCartesian31, scratchCartesian32);
}

/**
 * @param {import("ol/coordinate").Coordinate} originCoordinates
 * @param {import("@vcmap/cesium").Scene} scene
 * @returns {!import("@vcmap/cesium").Plane}
 */
export function createHorizontalPlane(originCoordinates, scene) {
  const wgs84 = Projection.mercatorToWgs84(originCoordinates);
  scratchCartesian31 = Cartesian3.fromDegrees(wgs84[0], wgs84[1], wgs84[2]);
  scratchCartesian32 = scene.globe.ellipsoid.geodeticSurfaceNormal(scratchCartesian31, scratchCartesian32);

  return Plane.fromPointNormal(scratchCartesian31, scratchCartesian32);
}
