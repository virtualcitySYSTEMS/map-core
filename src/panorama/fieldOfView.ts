import type { Extent } from 'ol/extent.js';
import type {
  Camera,
  Cartesian2,
  Matrix4,
  PerspectiveFrustum,
} from '@vcmap-cesium/engine';
import { Cartesian3, Math as CesiumMath } from '@vcmap-cesium/engine';
import { globalCartesianToImageSpherical } from './sphericalCoordinates.js';

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
  const hNear = 2 * Math.tan(frustum.fov / 2) * frustum.near;
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
const scratchExtentProjectedFov = createEmptyProjectedFov();

function getRightBound(projectedFov: ProjectedFov): number {
  return Math.max(
    projectedFov.right[0],
    projectedFov.topRight[0],
    projectedFov.bottomRight[0],
  );
}

function getLeftBound(projectedFov: ProjectedFov): number {
  return Math.min(
    projectedFov.left[0],
    projectedFov.topLeft[0],
    projectedFov.bottomLeft[0],
  );
}

function getTopBound(projectedFov: ProjectedFov): number {
  return Math.min(
    projectedFov.top[1],
    projectedFov.topLeft[1],
    projectedFov.topRight[1],
  );
}

function getBottomBound(projectedFov: ProjectedFov): number {
  return Math.max(
    projectedFov.bottom[1],
    projectedFov.bottomLeft[1],
    projectedFov.bottomRight[1],
  );
}

/**
 * Returns the extent of the fov in image spherical coordinates. May return two extents, if the FOV wraps around along the longitude.
 * it DOES NOT handle the case where the fov wraps around the poles (the pole is in the fov).
 * Furthermore, the camera has to be aligned with the up axis of the sphere. it is not allowed to be rolled.
 * @param camera
 * @param invModelMatrix - the inverse model matrix of the panorama image to create the projected fov for
 * @returns The extent of the fov in image spherical coordinates and the center. if providing more than on extent, the first will be up until 2 * PI and the second starting at 0.
 */
export function getFovImageSphericalExtent(
  camera: Camera,
  invModelMatrix: Matrix4,
): { extents: [Extent] | [Extent, Extent]; center: [number, number] } {
  const fov = getFov(camera, scratchExtentFov);
  const projectedFov = projectFov(
    fov,
    invModelMatrix,
    scratchExtentProjectedFov,
  );
  const simpleExtent = [
    getLeftBound(projectedFov),
    getTopBound(projectedFov),
    getRightBound(projectedFov),
    getBottomBound(projectedFov),
  ];

  let extents: [Extent] | [Extent, Extent];
  if (simpleExtent[0] > simpleExtent[2]) {
    extents = [
      [simpleExtent[0], simpleExtent[1], CesiumMath.TWO_PI, simpleExtent[3]],
      [0, simpleExtent[1], simpleExtent[2], simpleExtent[3]],
    ];
  } else {
    extents = [simpleExtent];
  }

  extents.forEach((e) => {
    if (e[1] > e[3]) {
      const largerY = e[1];
      e[1] = e[3];
      e[3] = largerY;
    }
  });

  return {
    extents,
    center: projectedFov.center,
  };
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
