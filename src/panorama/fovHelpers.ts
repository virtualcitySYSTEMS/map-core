import type { Extent } from 'ol/extent.js';
import {
  Camera,
  Cartesian3,
  PerspectiveFrustum,
  Math as CesiumMath,
} from '@vcmap-cesium/engine';
import { globalCartesianToImageSpherical } from './sphericalCoordinates.js';
import type { PanoramaImage } from './panoramaImage.js';

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

function createEmptyProjectedFov(): ProjectedFov {
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
 * interpretation of https://gamedev.stackexchange.com/a/55248
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

  const upHalfHeight = Cartesian3.multiplyByScalar(
    camera.up,
    hNearHalf,
    scratchUpHalfHeight,
  );

  const rightHalfWidth = Cartesian3.multiplyByScalar(
    camera.right,
    wNearHalf,
    scratchRightHalfWidth,
  );

  output.top = Cartesian3.add(cNear, upHalfHeight, output.top);
  output.right = Cartesian3.add(cNear, rightHalfWidth, output.right);
  output.bottom = Cartesian3.subtract(cNear, upHalfHeight, output.bottom);
  output.left = Cartesian3.subtract(cNear, rightHalfWidth, output.left);
  output.topLeft = Cartesian3.subtract(
    Cartesian3.add(cNear, upHalfHeight, output.topLeft),
    rightHalfWidth,
    output.topLeft,
  );
  output.topRight = Cartesian3.add(
    Cartesian3.add(cNear, upHalfHeight, output.topRight),
    rightHalfWidth,
    output.topRight,
  );
  output.bottomLeft = Cartesian3.subtract(
    Cartesian3.subtract(cNear, upHalfHeight, output.bottomLeft),
    rightHalfWidth,
    output.bottomLeft,
  );
  output.bottomRight = Cartesian3.add(
    Cartesian3.subtract(cNear, upHalfHeight, output.bottomRight),
    rightHalfWidth,
    output.bottomRight,
  );
  output.center = cNear;
  return output;
}

function projectFov(
  fov: Fov,
  image: PanoramaImage,
  result?: ProjectedFov,
): ProjectedFov {
  const projected = result ?? createEmptyProjectedFov();
  for (const [key, corner] of Object.entries(fov)) {
    projected[key as keyof Fov] = globalCartesianToImageSpherical(
      corner,
      image,
    );
  }

  return projected;
}

/**
 * Returns the projected fov in image spherical coordinates. only used for debugging
 * @param camera
 * @param image - the panorama image to create the projected fov for
 * @returns The projected fov in image spherical coordinates.
 */
export function getProjectedFov(
  camera: Camera,
  image: PanoramaImage,
): ProjectedFov {
  const fov = getFov(camera);
  return projectFov(fov, image);
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
 * @param image - the panorama image to create the projected fov for
 * @returns The extent of the fov in image spherical coordinates.
 */
export function getFovImageSphericalExtent(
  camera: Camera,
  image: PanoramaImage,
): { extents: [Extent] | [Extent, Extent]; center: [number, number] } {
  const fov = getFov(camera, scratchExtentFov);
  const projectedFov = projectFov(fov, image, scratchExtentProjectedFov);
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

  return {
    extents,
    center: projectedFov.center,
  };
}
