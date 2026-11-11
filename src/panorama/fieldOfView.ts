import type { Extent } from 'ol/extent.js';
import type {
  Camera,
  Cartesian2,
  PerspectiveFrustum,
} from '@vcmap-cesium/engine';
import { Cartesian3, Math as CesiumMath, Matrix4 } from '@vcmap-cesium/engine';
import {
  cartesianToImageSpherical,
  globalCartesianToImageSpherical,
} from './sphericalCoordinates.js';

/**
 * The field of view of a camera in global cartesian coordinates
 */
export type Fov = {
  top: Cartesian3;
  right: Cartesian3;
  bottom: Cartesian3;
  left: Cartesian3;
  topLeft: Cartesian3;
  topRight: Cartesian3;
  bottomLeft: Cartesian3;
  bottomRight: Cartesian3;
  center: Cartesian3;
};

/**
 * The field of view of a camera in image spherical coordinates ordered ([phi, theta]).
 * See the sphericalCoordinates module for more information on how for more information.
 */
export type ProjectedFov = Record<keyof Fov, [number, number]>;

export function createEmptyFov(): Fov {
  return {
    top: new Cartesian3(),
    right: new Cartesian3(),
    bottom: new Cartesian3(),
    left: new Cartesian3(),
    topLeft: new Cartesian3(),
    topRight: new Cartesian3(),
    bottomLeft: new Cartesian3(),
    bottomRight: new Cartesian3(),
    center: new Cartesian3(),
  };
}

export function createEmptyProjectedFov(): ProjectedFov {
  return {
    top: [0, 0],
    right: [0, 0],
    bottom: [0, 0],
    left: [0, 0],
    topLeft: [0, 0],
    topRight: [0, 0],
    bottomLeft: [0, 0],
    bottomRight: [0, 0],
    center: [0, 0],
  };
}

const scratchUpHalfHeight = new Cartesian3();
const scratchRightHalfWidth = new Cartesian3();

/**
 * Returns the field of view of a camera in global cartesian coordinates assuming a perspective frustum & a distance of 1.
 * an interpretation of https://gamedev.stackexchange.com/a/55248
 * technically only used for debugging outside of this module.
 */
export function getFov(camera: Camera, result?: Fov): Fov {
  const frustum = camera.frustum as PerspectiveFrustum;
  const hNear = 2 * Math.tan(frustum.fovy / 2) * frustum.near;
  const wNear = hNear * frustum.aspectRatio;

  const hNearHalf = hNear / 2;
  const wNearHalf = wNear / 2;

  const output = result ?? createEmptyFov();

  const cNear = Cartesian3.add(
    camera.position,
    Cartesian3.multiplyByScalar(camera.direction, frustum.near, output.center),
    output.center,
  );

  const upHalf = Cartesian3.multiplyByScalar(
    camera.up,
    hNearHalf,
    scratchUpHalfHeight,
  );

  const rightHalf = Cartesian3.multiplyByScalar(
    camera.right,
    wNearHalf,
    scratchRightHalfWidth,
  );

  output.top = Cartesian3.add(cNear, upHalf, output.top);
  output.right = Cartesian3.add(cNear, rightHalf, output.right);
  output.bottom = Cartesian3.subtract(cNear, upHalf, output.bottom);
  output.left = Cartesian3.subtract(cNear, rightHalf, output.left);
  output.topLeft = Cartesian3.subtract(
    Cartesian3.add(cNear, upHalf, output.topLeft),
    rightHalf,
    output.topLeft,
  );
  output.topRight = Cartesian3.add(
    Cartesian3.add(cNear, upHalf, output.topRight),
    rightHalf,
    output.topRight,
  );
  output.bottomLeft = Cartesian3.subtract(
    Cartesian3.subtract(cNear, upHalf, output.bottomLeft),
    rightHalf,
    output.bottomLeft,
  );
  output.bottomRight = Cartesian3.add(
    Cartesian3.subtract(cNear, upHalf, output.bottomRight),
    rightHalf,
    output.bottomRight,
  );
  output.center = cNear;
  return output;
}

function projectFov(
  fov: Fov,
  invModelMatrix: Matrix4,
  result?: ProjectedFov,
): ProjectedFov {
  const projected = result ?? createEmptyProjectedFov();
  for (const [key, corner] of Object.entries(fov)) {
    projected[key as keyof Fov] = globalCartesianToImageSpherical(
      corner,
      invModelMatrix,
    );
  }

  return projected;
}

/**
 * Returns the field of view of a camera projected into the image spherical coordinates
 * technically only used for debugging outside of this module.
 * @param camera
 * @param invModelMatrix - the inverse model matrix of the image.
 * @returns The projected fov in image spherical coordinates.
 */
export function getProjectedFov(
  camera: Camera,
  invModelMatrix: Matrix4,
): ProjectedFov {
  const fov = getFov(camera);
  return projectFov(fov, invModelMatrix);
}

const scratchExtentFov = createEmptyFov();
const scratchCorners = [
  new Cartesian3(),
  new Cartesian3(),
  new Cartesian3(),
  new Cartesian3(),
];
const scratchEdge = new Cartesian3();
const scratchEdgePoint = new Cartesian3();

/**
 * Returns the theta where the edge turns towards or away from a pole, if that point lies on the edge.
 * @param start - the start of the edge in the spheres reference system
 * @param end - the end of the edge in the spheres reference system
 */
function getEdgeTurningTheta(
  start: Cartesian3,
  end: Cartesian3,
): number | undefined {
  const edge = Cartesian3.subtract(end, start, scratchEdge);
  // the derivative of cos(theta) along start + t * edge is 0 at this t
  const a = start.z;
  const b = edge.z;
  const c = Cartesian3.dot(start, start);
  const d = Cartesian3.dot(start, edge);
  const e = Cartesian3.dot(edge, edge);
  const t = (a * d - b * c) / (b * d - a * e);
  if (t > 0 && t < 1) {
    Cartesian3.multiplyByScalar(edge, t, scratchEdgePoint);
    Cartesian3.add(start, scratchEdgePoint, scratchEdgePoint);
    return cartesianToImageSpherical(scratchEdgePoint)[1];
  }
  return undefined;
}

const scratchSphereDirection = new Cartesian3();
const scratchSphereUp = new Cartesian3();
const scratchSphereRight = new Cartesian3();

/**
 * Small offset to keep extents within [0, 2 * PI) and [0, PI), since 2 * PI === 0 & PI would be outside of the image.
 */
const EXTENT_EPSILON = 0.0001;

/**
 * Wraps a longitude into [0, 2 * PI)
 * @param phi
 */
function wrapLongitude(phi: number): number {
  const wrapped = phi - Math.floor(phi / CesiumMath.TWO_PI) * CesiumMath.TWO_PI;
  return wrapped < CesiumMath.TWO_PI ? wrapped : 0;
}

/**
 * Determines whether one of the poles of the image sphere is within the field of view of the camera.
 * Uses the same (perspective) frustum as getFov.
 * @param camera
 * @param invModelMatrix - the inverse model matrix of the panorama image
 * @returns 1 if the north pole (theta 0) is in view, -1 if the south pole (theta PI) is in view, 0 otherwise
 */
function getPoleInView(camera: Camera, invModelMatrix: Matrix4): -1 | 0 | 1 {
  const frustum = camera.frustum as PerspectiveFrustum;
  const tanHalfHeight = Math.tan(frustum.fovy / 2);
  const tanHalfWidth = tanHalfHeight * frustum.aspectRatio;

  // the z component of the camera axes in the spheres reference system equals the dot product with the north pole.
  const { z: directionZ } = Matrix4.multiplyByPointAsVector(
    invModelMatrix,
    camera.direction,
    scratchSphereDirection,
  );
  const { z: upZ } = Matrix4.multiplyByPointAsVector(
    invModelMatrix,
    camera.up,
    scratchSphereUp,
  );
  const { z: rightZ } = Matrix4.multiplyByPointAsVector(
    invModelMatrix,
    camera.right,
    scratchSphereRight,
  );

  const depth = Math.abs(directionZ);
  if (
    depth > 0 &&
    Math.abs(upZ) <= tanHalfHeight * depth &&
    Math.abs(rightZ) <= tanHalfWidth * depth
  ) {
    return directionZ > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * Returns the extent of the fov in image spherical coordinates. May return two extents, if the FOV wraps around along the longitude.
 * If a pole of the image is within the fov, all longitudes are visible and the extent spans the entire width of the image
 * from the pole to the furthest point of the fov.
 * The orientation of the camera relative to the image does not matter, the camera may be pitched & rolled relative to the
 * up axis of the image (e.g. for tilted images).
 * @param camera
 * @param invModelMatrix - the inverse model matrix of the panorama image to create the projected fov for
 * @returns The extent of the fov in image spherical coordinates and the center. if providing more than on extent, the first will be up until 2 * PI and the second starting at 0.
 */
export function getFovImageSphericalExtent(
  camera: Camera,
  invModelMatrix: Matrix4,
): { extents: [Extent] | [Extent, Extent]; center: [number, number] } {
  const fov = getFov(camera, scratchExtentFov);
  const center = globalCartesianToImageSpherical(fov.center, invModelMatrix);
  const corners = [
    fov.topLeft,
    fov.topRight,
    fov.bottomRight,
    fov.bottomLeft,
  ].map((corner, index) =>
    Matrix4.multiplyByPoint(invModelMatrix, corner, scratchCorners[index]),
  );

  let top = CesiumMath.PI;
  let bottom = 0;
  // longitudes relative to the center, to be independent of the 0 meridian & the orientation of the camera
  let minPhi = 0;
  let maxPhi = 0;
  corners.forEach((corner, index) => {
    const [phi, theta] = cartesianToImageSpherical(corner);
    // a straight edge never turns back in phi, so the corners are enough for phi
    const relativePhi = CesiumMath.negativePiToPi(phi - center[0]);
    minPhi = Math.min(minPhi, relativePhi);
    maxPhi = Math.max(maxPhi, relativePhi);
    // an edge can turn towards a pole between its corners, so that point is checked for theta too
    const edgeTheta =
      getEdgeTurningTheta(corner, corners[(index + 1) % corners.length]) ??
      theta;
    top = Math.min(top, theta, edgeTheta);
    bottom = Math.max(bottom, theta, edgeTheta);
  });

  const pole = getPoleInView(camera, invModelMatrix);
  if (pole !== 0) {
    const extent: Extent =
      pole > 0
        ? [
            0,
            0,
            CesiumMath.TWO_PI - EXTENT_EPSILON,
            Math.min(bottom, CesiumMath.PI - EXTENT_EPSILON),
          ]
        : [
            0,
            top,
            CesiumMath.TWO_PI - EXTENT_EPSILON,
            CesiumMath.PI - EXTENT_EPSILON,
          ];

    return { extents: [extent], center };
  }

  const left = wrapLongitude(center[0] + minPhi);
  const right = wrapLongitude(center[0] + maxPhi);

  let extents: [Extent] | [Extent, Extent];
  if (left > right) {
    extents = [
      [left, top, CesiumMath.TWO_PI, bottom],
      [0, top, right, bottom],
    ];
  } else {
    extents = [[left, top, right, bottom]];
  }

  return { extents, center };
}

/**
 * creates a ray from the camera to the window position and try to intersect it with the unit sphere.
 * @param windowPosition
 * @param camera
 * @param invModelMatrix
 */
export function windowPositionToImageSpherical(
  windowPosition: Cartesian2,
  camera: Camera,
  invModelMatrix: Matrix4,
): [number, number] | undefined {
  const ray = camera.getPickRay(windowPosition);
  if (!ray) {
    return undefined;
  }

  const intersectionPoint = Cartesian3.add(
    ray.origin,
    ray.direction,
    new Cartesian3(),
  );

  return globalCartesianToImageSpherical(intersectionPoint, invModelMatrix);
}
