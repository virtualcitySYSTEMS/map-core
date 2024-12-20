import { boundingExtent, Extent } from 'ol/extent.js';
import { Camera, Cartesian3, PerspectiveFrustum } from '@vcmap-cesium/engine';
import { globalCartesianToImageSpherical } from './sphericalCoordinates.js';

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

export type ProjectedFov = {
  topLeft: [number, number];
  topRight: [number, number];
  bottomLeft: [number, number];
  bottomRight: [number, number];
  center: [number, number];
};

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

/**
 * Returns the projected fov in image spherical coordinates. only used for debugging
 * @param camera
 * @returns The projected fov in image spherical coordinates.
 */
export function getProjectedFov(camera: Camera): ProjectedFov {
  const fov = getFov(camera);
  return {
    topLeft: globalCartesianToImageSpherical(fov.topLeft, camera.position),
    topRight: globalCartesianToImageSpherical(fov.topRight, camera.position),
    bottomLeft: globalCartesianToImageSpherical(
      fov.bottomLeft,
      camera.position,
    ),
    bottomRight: globalCartesianToImageSpherical(
      fov.bottomRight,
      camera.position,
    ),
    center: globalCartesianToImageSpherical(fov.center, camera.position),
  };
}

const scratchExtentFov = createEmptyFov();

/**
 * Returns the extent of the fov in image spherical coordinates.
 * @param camera
 * @returns The extent of the fov in image spherical coordinates.
 */
export function getFovImageSphericalExtent(camera: Camera): Extent {
  const fov = getFov(camera, scratchExtentFov);
  return boundingExtent(
    Object.values(fov).map((corner) =>
      globalCartesianToImageSpherical(corner, camera.position),
    ),
  );
}
