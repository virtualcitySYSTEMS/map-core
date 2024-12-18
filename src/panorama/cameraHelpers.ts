import {
  Camera,
  Cartesian3,
  Math as CesiumMath,
  PerspectiveFrustum,
} from '@vcmap-cesium/engine';
import {
  convertLatitudeRange,
  globalCartesianToSpherical,
} from './sphericalCoordinates.js';

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

/**
 * interpretation of https://gamedev.stackexchange.com/a/55248
 */
export function getFov(camera: Camera): Fov {
  const frustum = camera.frustum as PerspectiveFrustum;
  const hNear = 2 * Math.tan(frustum.fov / 2) * frustum.near;
  const wNear = hNear * frustum.aspectRatio;

  const hNearHalf = hNear / 2;
  const wNearHalf = wNear / 2;

  const cNear = Cartesian3.add(
    camera.position,
    Cartesian3.multiplyByScalar(
      camera.direction,
      frustum.near,
      new Cartesian3(),
    ),
    new Cartesian3(),
  );

  const upHalfHeight = Cartesian3.multiplyByScalar(
    camera.up,
    hNearHalf,
    new Cartesian3(),
  );

  const rightHalfWidth = Cartesian3.multiplyByScalar(
    camera.right,
    wNearHalf,
    new Cartesian3(),
  );

  return {
    top: Cartesian3.add(cNear, upHalfHeight, new Cartesian3()),
    right: Cartesian3.add(cNear, rightHalfWidth, new Cartesian3()),
    bottom: Cartesian3.subtract(cNear, upHalfHeight, new Cartesian3()),
    left: Cartesian3.subtract(cNear, rightHalfWidth, new Cartesian3()),
    topLeft: Cartesian3.subtract(
      Cartesian3.add(cNear, upHalfHeight, new Cartesian3()),
      rightHalfWidth,
      new Cartesian3(),
    ),
    topRight: Cartesian3.add(
      Cartesian3.add(cNear, upHalfHeight, new Cartesian3()),
      rightHalfWidth,
      new Cartesian3(),
    ),
    bottomLeft: Cartesian3.subtract(
      Cartesian3.subtract(cNear, upHalfHeight, new Cartesian3()),
      rightHalfWidth,
      new Cartesian3(),
    ),
    bottomRight: Cartesian3.add(
      Cartesian3.subtract(cNear, upHalfHeight, new Cartesian3()),
      rightHalfWidth,
      new Cartesian3(),
    ),
    center: cNear,
  };
}

export function sphericalCameraToSphericalSphere(
  coord: [number, number],
): [number, number] {
  return [
    CesiumMath.convertLongitudeRange(coord[0]) + CesiumMath.PI,
    CesiumMath.PI - (convertLatitudeRange(coord[1]) + CesiumMath.PI_OVER_TWO),
  ];
}

export function getProjectedFov(camera: Camera): ProjectedFov {
  const fov = getFov(camera);
  const rotationZ = CesiumMath.PI_OVER_FOUR;
  return {
    topLeft: globalCartesianToSpherical(
      fov.topLeft,
      camera.position,
      rotationZ,
    ),
    topRight: globalCartesianToSpherical(
      fov.topRight,
      camera.position,
      rotationZ,
    ),
    bottomLeft: globalCartesianToSpherical(
      fov.bottomLeft,
      camera.position,
      rotationZ,
    ),
    bottomRight: globalCartesianToSpherical(
      fov.bottomRight,
      camera.position,
      rotationZ,
    ),
    center: sphericalCameraToSphericalSphere([camera.heading, camera.pitch]),
  };
}
