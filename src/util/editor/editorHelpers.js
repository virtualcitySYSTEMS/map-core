import Point from 'ol/geom/Point.js';
import Feature from 'ol/Feature.js';
import {
  Cartesian2,
  Cartesian3,
  Math as CesiumMath,
  Plane,
  Ray, IntersectionTests, Cartographic, HeightReference,
} from '@vcmap/cesium';

import { mercatorToCartesian } from '../math.js';
import { getFlatCoordinatesFromGeometry } from '../geometryHelpers.js';
import CesiumMap from '../../map/cesiumMap.js';
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
 * Returns the closest point on a 2D line. the Z index is taken from the point.
 * @param {import("ol/coordinate").Coordinate} start - line segment start
 * @param {import("ol/coordinate").Coordinate} end - line segment end
 * @param {import("ol/coordinate").Coordinate} point - point to project
 * @returns {!import("ol/coordinate").Coordinate}
 */
export function getClosestPointOn2DLine(start, end, point) {
  scratchCartesian21 = Cartesian2.fromElements(end[0] - start[0], end[1] - start[1], scratchCartesian21);
  if (scratchCartesian21.equals(Cartesian2.ZERO)) {
    scratchCartesian21 = Cartesian2.fromElements(1, 1, scratchCartesian21);
  }
  scratchCartesian21 = Cartesian2.normalize(scratchCartesian21, scratchCartesian21);
  scratchCartesian22 = Cartesian2.fromElements(point[0] - start[0], point[1] - start[1], scratchCartesian22);
  const lambda = Cartesian2.dot(scratchCartesian21, scratchCartesian22);
  scratchCartesian21 = Cartesian2.multiplyByScalar(scratchCartesian21, lambda, scratchCartesian21);
  return [scratchCartesian21.x + start[0], scratchCartesian21.y + start[1], point[2]];
}

/**
 * @param {import("ol/coordinate").Coordinate} start - line segment start
 * @param {import("ol/coordinate").Coordinate} end - line segment end
 * @param {import("ol/coordinate").Coordinate} point - the point to project
 * @param {number=} epsilon
 * @returns {boolean}
 */
export function pointOnLine3D(start, end, point, epsilon) {
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
  return scratchCartesian31.equalsEpsilon(scratchCartesian32, epsilon || CesiumMath.EPSILON5);
}

/**
 * @param {import("ol/coordinate").Coordinate} start - line segment start
 * @param {import("ol/coordinate").Coordinate} end - line segment end
 * @param {import("ol/coordinate").Coordinate} point - the point to project
 * @param {number=} epsilon
 * @returns {boolean}
 */
export function pointOnLine2D(start, end, point, epsilon) {
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

  return scratchCartesian21.equalsEpsilon(scratchCartesian22, epsilon || CesiumMath.EPSILON5);
}

/**
 * @param {import("ol/coordinate").Coordinate} originCoordinates
 * @param {import("@vcmap/cesium").Scene} scene
 * @returns {!import("@vcmap/cesium").Plane}
 */
export function createCameraVerticalPlane(originCoordinates, scene) {
  scratchCartesian31 = mercatorToCartesian(originCoordinates, scratchCartesian31);
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
  scratchCartesian31 = mercatorToCartesian(originCoordinates, scratchCartesian31);
  scratchCartesian32 = scene.globe.ellipsoid.geodeticSurfaceNormal(scratchCartesian31, scratchCartesian32);

  return Plane.fromPointNormal(scratchCartesian31, scratchCartesian32);
}

/**
 * @param {import("@vcmap/cesium").Plane} plane
 * @param {import("@vcmap/cesium").Camera} camera
 * @param {import("@vcmap/cesium").Cartesian2} windowPosition
 * @returns {import("@vcmap/cesium").Cartographic}
 */
export function getCartographicFromPlane(plane, camera, windowPosition) {
  const ray = camera.getPickRay(windowPosition, new Ray());
  const intersection = IntersectionTests.rayPlane(ray, plane);
  if (intersection) {
    return Cartographic.fromCartesian(intersection);
  }
  return Cartographic.ZERO;
}

/**
 * Drapes a geometry onto the terrain by placing each coordinate at its height.
 * @param {import("ol/geom").Geometry} geometry
 * @param {import("@vcmap/core").VcsMap} map
 * @returns {Promise<void>}
 */
export async function drapeGeometryOnTerrain(geometry, map) {
  if (map instanceof CesiumMap) {
    const coordinates = geometry.getCoordinates();
    const flats = getFlatCoordinatesFromGeometry(geometry, coordinates);
    await map.getHeightFromTerrain(flats);
    geometry.setCoordinates(coordinates);
  }
}

/**
 * Places a geometry onto the terrain at its lowest point.
 * @param {import("ol/geom").Geometry} geometry
 * @param {import("@vcmap/core").VcsMap} map
 * @returns {Promise<void>}
 */
export async function placeGeometryOnTerrain(geometry, map) {
  if (map instanceof CesiumMap) {
    const coordinates = geometry.getCoordinates();
    const flats = getFlatCoordinatesFromGeometry(geometry, coordinates);
    await map.getHeightFromTerrain(flats);
    let minHeight = Infinity;
    flats.forEach((coord) => {
      if (minHeight > coord[2]) {
        minHeight = coord[2];
      }
    });
    flats.forEach((coord) => {
      coord[2] = minHeight;
    });
    geometry.setCoordinates(coordinates);
  }
}

/**
 * @param {import("ol").Feature} feature
 * @param {import("@vcmap/core").VectorLayer} layer
 * @param {import("@vcmap/core").VcsMap} cesiumMap
 * @returns {Promise<void>}
 */
export async function ensureFeatureAbsolute(feature, layer, cesiumMap) {
  const layerIsClamped = layer.vectorProperties.altitudeMode === HeightReference.CLAMP_TO_GROUND;
  const altitudeMode = feature.get('olcs_altitudeMode');
  if (altitudeMode === 'clampToGround' || (!altitudeMode && layerIsClamped)) {
    feature.set('olcs_altitudeMode', 'absolute', true);
    const geometry = feature.getGeometry();
    if (geometry) {
      await placeGeometryOnTerrain(geometry, cesiumMap);
    }
  }
}

/**
 * @param {import("ol").Feature} feature
 */
export function clampFeature(feature) {
  feature.set('olcs_altitudeMode', 'clampToGround');
}
