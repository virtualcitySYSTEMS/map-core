import {
  Cartesian3,
  Plane,
  ClippingPlane,
  Matrix4,
  ClippingPlaneCollection,
  Entity,
  ConstantProperty,
  JulianDate,
  Cesium3DTileset,
  Globe,
  VoxelPrimitive,
  type Camera,
} from '@vcmap-cesium/engine';
import type { Coordinate } from 'ol/coordinate.js';
import Feature from 'ol/Feature.js';
import LineString from 'ol/geom/LineString.js';
import { offset } from 'ol/sphere.js';
import Polygon from 'ol/geom/Polygon.js';
import { check, maybe, optional } from '@vcsuite/check';
import Projection, {
  mercatorProjection,
  wgs84Projection,
} from '../projection.js';
import Extent3D from '../featureconverter/extent3D.js';
import {
  enforceEndingVertex,
  enforceRightHand,
  getFlatCoordinateReferences,
} from '../geometryHelpers.js';
import { mercatorToCartesian } from '../math.js';

/**
 * Options to the define how Cesium.ClippingPlanes are created from a ol.Feature.
 */
export type ClippingPlaneCreationOptions = {
  /**
   * specify the clip direction. If true, everything outside the clippingPlaneCollection should be cut off
   */
  reverse?: boolean;
  /**
   * specify whether to create the vertical clipping planes
   */
  createVerticalPlanes?: boolean;
  /**
   * specify whether to create the horizontal clipping plane on the top level of an extruded geometry
   */
  createTopPlane?: boolean;
  /**
   * specify whether to create the horizontal clipping plane on the ground level
   */
  createBottomPlane?: boolean;
  /**
   * create 2 planes at the end of a line with only two coordinates
   */
  createEndingPlanes?: boolean;
};

/**
 * Creates a Plane on p1 with the normal in the direction of P2
 * @param  p1
 * @param  p2
 */
function createPlane(p1: Cartesian3, p2: Cartesian3): ClippingPlane {
  const planeNormal = Cartesian3.subtract(p1, p2, new Cartesian3());
  Cartesian3.normalize(planeNormal, planeNormal);
  const plane = Plane.fromPointNormal(p1, planeNormal);
  return ClippingPlane.fromPlane(plane);
}

function createVerticalPlanes(coords: Coordinate[]): ClippingPlane[] {
  const clippingPlanes = [];
  const cartesiansCoords = coords.map((c) => mercatorToCartesian(c));
  for (let i = 0; i < cartesiansCoords.length - 1; i++) {
    const nextIndex = i + 1;
    const normal = new Cartesian3();
    Cartesian3.cross(cartesiansCoords[nextIndex], cartesiansCoords[i], normal);
    Cartesian3.normalize(normal, normal);
    const verticalPlane = new Plane(normal, 0.0);
    if (!Number.isNaN(verticalPlane.distance)) {
      clippingPlanes.push(ClippingPlane.fromPlane(verticalPlane));
    }
  }
  return clippingPlanes;
}

function createHorizontalPlanes(
  feature: Feature,
  coords: Coordinate[],
  options: ClippingPlaneCreationOptions = {},
): ClippingPlane[] {
  const clippingPlanes = [];
  const extent = Extent3D.fromGeometry(feature.getGeometry());
  let min = Number.isFinite(extent.minZ) ? extent.minZ : 0;
  let max = Number.isFinite(extent.maxZ) ? extent.maxZ : 0;
  const extruded = feature.get('olcs_extrudedHeight') as number | undefined;
  if (extruded) {
    max += extruded;
    if (feature.get('olcs_skirt')) {
      min -= feature.get('olcs_skirt');
    }
  }

  if (min === max) {
    max += 1;
  }

  const [lon, lat] = Projection.mercatorToWgs84(coords[0]);
  const lowerPoint = Cartesian3.fromDegrees(lon, lat, min);
  const upperPoint = Cartesian3.fromDegrees(lon, lat, max);
  if (options.createBottomPlane) {
    clippingPlanes.push(createPlane(lowerPoint, upperPoint));
  }
  if (extruded && options.createTopPlane) {
    clippingPlanes.push(createPlane(upperPoint, lowerPoint));
  }
  return clippingPlanes;
}

/**
 * creates a plane for each point in the opposite direction of the other point.
 * only works for two coordinates
 * @param  coords
 * @returns  clippingPlanes
 */
function createEndingPlanes(coords: Coordinate[]): ClippingPlane[] {
  const clippingPlanes: ClippingPlane[] = [];
  const cartesiansCoords = coords.map((c) => mercatorToCartesian(c));
  const normal = new Cartesian3();
  Cartesian3.cross(cartesiansCoords[0], cartesiansCoords[1], normal);
  Cartesian3.normalize(normal, normal);

  function createOuter(cartesian: Cartesian3): void {
    const moved = Cartesian3.add(cartesian, normal, new Cartesian3());
    const planeNormal = new Cartesian3();
    Cartesian3.cross(cartesian, moved, planeNormal);
    Cartesian3.normalize(planeNormal, planeNormal);
    const verticalPlane = new Plane(planeNormal, 0.0);
    clippingPlanes.push(ClippingPlane.fromPlane(verticalPlane));
  }

  createOuter(cartesiansCoords[0]);
  Cartesian3.negate(normal, normal);
  createOuter(cartesiansCoords[1]);
  return clippingPlanes;
}

/**
 * create a Cesium ClippingPlaneCollection based on a given feature having a multi-curve, polygon, or extruded solid geometry
 * @param  feature - base for calculating the clipping planes.
 * @param  options
 * @param  transformMatrix - 4x4 matrix specifying the transform of clipping planes from Earth's fixed frame to another one
 */
export function createClippingPlaneCollection(
  feature: Feature,
  options: ClippingPlaneCreationOptions = {},
  transformMatrix?: Matrix4,
): ClippingPlaneCollection | null {
  check(feature, Feature);
  check(options, Object);
  check(transformMatrix, optional(Matrix4));

  const clippingPlanes = [];
  const geometry = feature.getGeometry()!;
  const geometryType = geometry.getType();

  if (geometryType === 'Point') {
    clippingPlanes.push(
      ...createHorizontalPlanes(
        feature,
        [geometry.getCoordinates() as Coordinate],
        options,
      ),
    );
  } else {
    const coords = getFlatCoordinateReferences(geometry);
    if (
      coords.length < 2 ||
      (coords[0][0] === coords[1][0] && coords[0][1] === coords[1][1])
    ) {
      return null;
    }

    if (geometryType === 'Polygon') {
      enforceEndingVertex(coords);
      enforceRightHand(coords);
    } else if (
      geometryType === 'LineString' &&
      coords.length === 2 &&
      options.createEndingPlanes
    ) {
      clippingPlanes.push(...createEndingPlanes(coords));
    }

    if (options.createVerticalPlanes) {
      clippingPlanes.push(...createVerticalPlanes(coords));
    }

    if (
      feature.get('olcs_altitudeMode') === 'absolute' &&
      (options.createBottomPlane || options.createTopPlane)
    ) {
      clippingPlanes.push(...createHorizontalPlanes(feature, coords, options));
    }
  }

  if (transformMatrix) {
    clippingPlanes.forEach((plane) => {
      const result = Plane.transform(plane, transformMatrix);
      plane.normal = result.normal;
      plane.distance = result.distance;
    });
  }

  if (options.reverse) {
    clippingPlanes.forEach((plane) => {
      Cartesian3.negate(plane.normal, plane.normal);
      plane.distance *= -1;
    });
  }

  return new ClippingPlaneCollection({
    planes: clippingPlanes,
    unionClippingRegions: options.reverse,
  });
}

/**
 * This function ensures that clipping planes on voxels
 * behave the same way as clipping planes on tilesets, entities, etc, by:
 * 1. Directly "bakes" the matrix into the planes definition,
 * since clipping plane matrix is currently ignored by IntersectPlane.glsl.
 * Only when `transform == true`.
 * 2. Negates normal and inverts direction of each plane.
 */
function fixVoxelClippingPlanes(
  clippingPlanes: ClippingPlaneCollection,
  transform: boolean,
): void {
  for (let i = 0; i < clippingPlanes.length; i++) {
    const plane = clippingPlanes.get(i);
    if (transform) {
      Plane.transform(plane, clippingPlanes.modelMatrix, plane);
    }

    // Most likely also a bug in IntersectPlane.glsl
    Cartesian3.negate(plane.normal, plane.normal);
    plane.distance *= -1;
  }
}

/**
 * copies the clippingplanes and the properties from source to result
 * @param  source
 * @param  result
 * @param  transformMatrix - 4x4 matrix specifying the transform of clipping planes from Earth's fixed frame to another one
 * @param  originPoint - the origin point of the transformation target, so the plane distance can be set correctly
 */
export function copyClippingPlanesToCollection(
  source: ClippingPlaneCollection,
  result: ClippingPlaneCollection,
  transformMatrix?: Matrix4,
  originPoint?: Cartesian3,
): ClippingPlaneCollection {
  check(source, ClippingPlaneCollection);
  check(result, ClippingPlaneCollection);

  if (result.length > 0) {
    result.removeAll();
  }
  for (let i = 0; i < source.length; i++) {
    const plane = source.get(i);
    if (transformMatrix && originPoint) {
      const distance = Plane.getPointDistance(plane, originPoint);
      const transformedPlane = Plane.transform(plane, transformMatrix);
      transformedPlane.distance = distance;
      result.add(ClippingPlane.fromPlane(transformedPlane));
    } else {
      result.add(ClippingPlane.clone(plane));
    }
  }
  result.modelMatrix = source.modelMatrix.clone();
  result.unionClippingRegions = source.unionClippingRegions;
  result.edgeColor = source.edgeColor.clone();
  result.edgeWidth = source.edgeWidth;
  return result;
}

export function clearClippingPlanes(
  target: Globe | Cesium3DTileset | Entity | VoxelPrimitive,
): void {
  if ('isDestroyed' in target && target.isDestroyed()) {
    return;
  }
  if (target instanceof Entity) {
    if (target.model) {
      if (target.model.clippingPlanes) {
        const entityClippingPlanes =
          target.model.clippingPlanes.getValue() as ClippingPlaneCollection;
        entityClippingPlanes.removeAll();
      } else {
        target.model.clippingPlanes = new ConstantProperty(
          new ClippingPlaneCollection(),
        );
      }
    }
  } else if (target.clippingPlanes) {
    target.clippingPlanes.removeAll();
  } else {
    target.clippingPlanes = new ClippingPlaneCollection();
  }
}

/**
 * @param  target
 * @param  clippingPlaneCollection
 * @param  local
 */
export function setClippingPlanes(
  target: Globe | Cesium3DTileset | Entity | VoxelPrimitive,
  clippingPlaneCollection: ClippingPlaneCollection,
  local?: boolean,
): void {
  clearClippingPlanes(target);
  let localToWorld: Matrix4 | undefined;
  let targetClippingPlanes: ClippingPlaneCollection | undefined;

  if (target instanceof Cesium3DTileset) {
    localToWorld = target.clippingPlanesOriginMatrix;
    targetClippingPlanes = target.clippingPlanes;
  } else if (target instanceof Entity) {
    localToWorld = target.computeModelMatrix(JulianDate.now());
    targetClippingPlanes = target.model?.clippingPlanes?.getValue() as
      ClippingPlaneCollection | undefined;
  } else if (target instanceof VoxelPrimitive) {
    localToWorld = target.provider.shapeTransform;
    targetClippingPlanes = target.clippingPlanes;
  } else if (target instanceof Globe) {
    targetClippingPlanes = target.clippingPlanes;
  }

  if (!targetClippingPlanes) {
    return;
  }

  const clonedSourceClippingPlanes = copyClippingPlanesToCollection(
    clippingPlaneCollection,
    new ClippingPlaneCollection(),
  );
  if (!local && localToWorld) {
    const worldToLocal = Matrix4.inverse(localToWorld, new Matrix4());
    Matrix4.multiply(
      worldToLocal,
      clippingPlaneCollection.modelMatrix,
      clonedSourceClippingPlanes.modelMatrix,
    );
  }
  if (target instanceof VoxelPrimitive) {
    fixVoxelClippingPlanes(clonedSourceClippingPlanes, !local);
  }

  copyClippingPlanesToCollection(
    clonedSourceClippingPlanes,
    targetClippingPlanes,
  );
}

/**
 * Creates a new feature at the given coordinate, which can then be used to create a clippingPlaneCollection.
 * @param  coordinate - in WGS84
 * @param  camera
 * @param  [vertical=false]
 * @param  [offsetDistance=25] - the offset from the coordinate to use for the size of the geometry
 * @param  [rotate=0] - rotation of clipping plane in radians. 0 means vertical plane is parallel to camera.heading and horizontal feature is aligned with axes.
 * @returns  - the features geometry is in web mercator
 */
export function createClippingFeature(
  coordinate: Coordinate,
  camera: Camera,
  vertical = false,
  offsetDistance = 25,
  rotate = 0,
): Feature {
  check(coordinate, [Number]);
  check(vertical, Boolean);
  check(offsetDistance, Number);

  let geometry;
  if (vertical) {
    const p1 = offset(coordinate, -offsetDistance, camera.heading + rotate);
    const p2 = offset(coordinate, offsetDistance, camera.heading + rotate);
    geometry = new LineString(
      [
        [p1[0], p1[1], coordinate[2] - offsetDistance],
        [p2[0], p2[1], coordinate[2] - offsetDistance],
      ],
      'XYZ',
    );
  } else {
    geometry = new Polygon([[]], 'XYZ');
    let bearing = 2 * Math.PI - Math.PI / 4 + rotate; // Bearing NW
    const coordinates = [...(new Array(4) as undefined[])].map(() => {
      const newPoint = offset(coordinate, offsetDistance, bearing);
      bearing -= Math.PI / 2;
      return [newPoint[0], newPoint[1], coordinate[2]];
    });
    geometry.setCoordinates([coordinates]);
  }
  const feature = new Feature({ geometry });
  feature.set('olcs_altitudeMode', 'absolute');
  if (vertical) {
    feature.set('olcs_extrudedHeight', offsetDistance * 2);
  }

  geometry.transform(wgs84Projection.proj, mercatorProjection.proj);
  return feature;
}

/**
 * Gets the clipping options for the current feature to be infinite or not for the given feature created by
 * .
 * @param  feature - the feature created by
 * @param  [infinite=false]
 */
export function getClippingOptions(
  feature?: Feature,
  infinite = false,
): ClippingPlaneCreationOptions {
  check(feature, maybe(Feature));
  check(infinite, Boolean);

  const vertical = feature
    ? feature.getGeometry()!.getType() === 'LineString'
    : false;

  return vertical
    ? {
        createBottomPlane: !infinite,
        createTopPlane: !infinite,
        createEndingPlanes: !infinite,
        createVerticalPlanes: true,
      }
    : {
        createVerticalPlanes: !infinite,
        createBottomPlane: true,
      };
}
