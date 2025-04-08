import { expect } from 'chai';
import type { PerspectiveFrustum, Scene } from '@vcmap-cesium/engine';
import {
  Cartesian3,
  Math as CesiumMath,
  Matrix4,
  Transforms,
} from '@vcmap-cesium/engine';
import type { Extent } from 'ol/extent.js';
import { getMockScene } from '../helpers/cesiumHelpers.js';
import type { Fov, ProjectedFov } from '../../../src/panorama/fieldOfView.js';
import {
  getFovImageSphericalExtent,
  getFov,
  getProjectedFov,
} from '../../../src/panorama/fieldOfView.js';
import { arrayCloseTo } from '../helpers/helpers.js';

describe('field of vision calculations', () => {
  describe('calculating the field of vision of a camera', () => {
    let scene: Scene;
    let fov: Fov;
    let cameraPosition: Cartesian3;

    before(() => {
      scene = getMockScene();
      const { camera } = scene;
      cameraPosition = Cartesian3.fromDegrees(0, 0, 1);
      camera.setView({
        destination: cameraPosition,
      });
      (camera.frustum as PerspectiveFrustum).fov = CesiumMath.PI_OVER_TWO;
      fov = getFov(camera);
    });

    after(() => {
      scene.destroy();
    });

    it('should calculate the center', () => {
      const forward = Cartesian3.add(
        cameraPosition,
        scene.camera.direction,
        new Cartesian3(),
      );
      expect(
        Cartesian3.equalsEpsilon(fov.center, forward, CesiumMath.EPSILON10),
      ).to.be.true;
    });

    it('should calculate the top', () => {
      const forward = Cartesian3.add(
        cameraPosition,
        scene.camera.direction,
        new Cartesian3(),
      );
      const top = Cartesian3.add(forward, scene.camera.up, forward);
      expect(Cartesian3.equalsEpsilon(fov.top, top, CesiumMath.EPSILON10)).to.be
        .true;
    });

    it('should calculate the bottom', () => {
      const forward = Cartesian3.add(
        cameraPosition,
        scene.camera.direction,
        new Cartesian3(),
      );
      const bottom = Cartesian3.subtract(forward, scene.camera.up, forward);
      expect(Cartesian3.equalsEpsilon(fov.bottom, bottom, CesiumMath.EPSILON10))
        .to.be.true;
    });

    it('should calculate the right', () => {
      const forward = Cartesian3.add(
        cameraPosition,
        scene.camera.direction,
        new Cartesian3(),
      );
      const right = Cartesian3.add(forward, scene.camera.right, forward);
      expect(Cartesian3.equalsEpsilon(fov.right, right, CesiumMath.EPSILON10))
        .to.be.true;
    });

    it('should calculate the left', () => {
      const forward = Cartesian3.add(
        cameraPosition,
        scene.camera.direction,
        new Cartesian3(),
      );
      const left = Cartesian3.subtract(forward, scene.camera.right, forward);
      expect(Cartesian3.equalsEpsilon(fov.left, left, CesiumMath.EPSILON10)).to
        .be.true;
    });

    it('should calculate the top right', () => {
      const forward = Cartesian3.add(
        cameraPosition,
        scene.camera.direction,
        new Cartesian3(),
      );
      const top = Cartesian3.add(forward, scene.camera.up, forward);
      const right = Cartesian3.add(top, scene.camera.right, top);
      expect(
        Cartesian3.equalsEpsilon(fov.topRight, right, CesiumMath.EPSILON10),
      ).to.be.true;
    });

    it('should calculate the bottom right', () => {
      const forward = Cartesian3.add(
        cameraPosition,
        scene.camera.direction,
        new Cartesian3(),
      );
      const bottom = Cartesian3.subtract(forward, scene.camera.up, forward);
      const right = Cartesian3.add(bottom, scene.camera.right, bottom);
      expect(
        Cartesian3.equalsEpsilon(fov.bottomRight, right, CesiumMath.EPSILON10),
      ).to.be.true;
    });

    it('should calculate the bottom left', () => {
      const forward = Cartesian3.add(
        cameraPosition,
        scene.camera.direction,
        new Cartesian3(),
      );
      const bottom = Cartesian3.subtract(forward, scene.camera.up, forward);
      const left = Cartesian3.subtract(bottom, scene.camera.right, bottom);
      expect(
        Cartesian3.equalsEpsilon(fov.bottomLeft, left, CesiumMath.EPSILON10),
      ).to.be.true;
    });

    it('should calculate the top left', () => {
      const forward = Cartesian3.add(
        cameraPosition,
        scene.camera.direction,
        new Cartesian3(),
      );
      const top = Cartesian3.add(forward, scene.camera.up, forward);
      const left = Cartesian3.subtract(top, scene.camera.right, top);
      expect(Cartesian3.equalsEpsilon(fov.topLeft, left, CesiumMath.EPSILON10))
        .to.be.true;
    });
  });

  describe('calculating the projected field of vision', () => {
    let scene: Scene;
    let fov: ProjectedFov;
    let imageCenter: [number, number];

    before(() => {
      scene = getMockScene();
      const { camera } = scene;
      const cameraPosition = Cartesian3.fromDegrees(0, 0, 1);
      camera.setView({
        destination: cameraPosition,
        orientation: {
          heading: 0,
          pitch: 0,
          roll: 0,
        },
      });

      const invModelMatrix = Matrix4.inverse(
        Transforms.eastNorthUpToFixedFrame(cameraPosition),
        new Matrix4(),
      );
      (camera.frustum as PerspectiveFrustum).fov = CesiumMath.PI_OVER_TWO;
      fov = getProjectedFov(camera, invModelMatrix);
      imageCenter = [
        CesiumMath.TWO_PI - CesiumMath.PI_OVER_TWO,
        CesiumMath.PI_OVER_TWO,
      ];
    });

    after(() => {
      scene.destroy();
    });

    it('should calculate the center', () => {
      arrayCloseTo(fov.center, imageCenter);
    });

    it('should calculate the top', () => {
      const top = imageCenter.slice();
      top[1] -= CesiumMath.PI_OVER_FOUR;
      arrayCloseTo(fov.top, top);
    });

    it('should calculate the bottom', () => {
      const bottom = imageCenter.slice();
      bottom[1] += CesiumMath.PI_OVER_FOUR;
      arrayCloseTo(fov.bottom, bottom);
    });

    it('should calculate the right', () => {
      const right = imageCenter.slice();
      right[0] += CesiumMath.PI_OVER_FOUR;
      arrayCloseTo(fov.right, right);
    });

    it('should calculate the left', () => {
      const left = imageCenter.slice();
      left[0] -= CesiumMath.PI_OVER_FOUR;
      arrayCloseTo(fov.left, left);
    });

    it('should calculate the top right', () => {
      arrayCloseTo(fov.topRight, [5.497787143782138, 0.9553166181245092]);
    });

    it('should calculate the bottom right', () => {
      arrayCloseTo(fov.bottomRight, [5.497787143782138, 2.1862760354652844]);
    });

    it('should calculate the bottom left', () => {
      arrayCloseTo(fov.bottomLeft, [3.9269908169872414, 2.1862760354652844]);
    });

    it('should calculate the top left', () => {
      arrayCloseTo(fov.topLeft, [3.9269908169872414, 0.9553166181245092]);
    });
  });

  describe('calculating the extent of the image', () => {
    let scene: Scene;
    let extents: ReturnType<typeof getFovImageSphericalExtent>;

    before(() => {
      scene = getMockScene();
      const { camera } = scene;
      const cameraPosition = Cartesian3.fromDegrees(0, 0, 1);
      camera.setView({
        destination: cameraPosition,
        orientation: {
          heading: 0,
          pitch: 0,
          roll: 0,
        },
      });

      const invModelMatrix = Matrix4.inverse(
        Transforms.eastNorthUpToFixedFrame(cameraPosition),
        new Matrix4(),
      );
      (camera.frustum as PerspectiveFrustum).fov = CesiumMath.PI_OVER_TWO;
      extents = getFovImageSphericalExtent(camera, invModelMatrix);
    });

    after(() => {
      scene.destroy();
    });

    it('should calculate the center', () => {
      arrayCloseTo(extents.center, [
        CesiumMath.TWO_PI - CesiumMath.PI_OVER_TWO,
        CesiumMath.PI_OVER_TWO,
      ]);
    });

    it('should calculate the extent', () => {
      expect(extents.extents).to.have.lengthOf(1);
      const [extent] = extents.extents;
      arrayCloseTo(extent, [
        CesiumMath.TWO_PI - CesiumMath.PI_OVER_TWO - CesiumMath.PI_OVER_FOUR,
        CesiumMath.PI_OVER_FOUR,
        CesiumMath.TWO_PI - CesiumMath.PI_OVER_FOUR,
        CesiumMath.PI_OVER_TWO + CesiumMath.PI_OVER_FOUR,
      ]);
    });
  });

  describe('calculating the extent of the image looking down the 0 meridian', () => {
    let scene: Scene;
    let extents: ReturnType<typeof getFovImageSphericalExtent>;

    before(() => {
      scene = getMockScene();
      const { camera } = scene;
      const cameraPosition = Cartesian3.fromDegrees(0, 0, 1);
      camera.setView({
        destination: cameraPosition,
        orientation: {
          heading: CesiumMath.toRadians(90),
          pitch: 0,
          roll: 0,
        },
      });

      const invModelMatrix = Matrix4.inverse(
        Transforms.eastNorthUpToFixedFrame(cameraPosition),
        new Matrix4(),
      );
      (camera.frustum as PerspectiveFrustum).fov = CesiumMath.PI_OVER_TWO;
      extents = getFovImageSphericalExtent(camera, invModelMatrix);
    });

    after(() => {
      scene.destroy();
    });

    it('should calculate the center', () => {
      arrayCloseTo(extents.center, [0, CesiumMath.PI_OVER_TWO]);
    });

    it('should calculate the extent', () => {
      expect(extents.extents).to.have.lengthOf(2);
      const [extentLeft, extentRight] = extents.extents as [Extent, Extent];
      arrayCloseTo(extentLeft, [
        CesiumMath.TWO_PI - CesiumMath.PI_OVER_FOUR,
        CesiumMath.PI_OVER_FOUR,
        CesiumMath.TWO_PI,
        CesiumMath.PI_OVER_TWO + CesiumMath.PI_OVER_FOUR,
      ]);
      arrayCloseTo(extentRight, [
        0,
        CesiumMath.PI_OVER_FOUR,
        CesiumMath.PI_OVER_FOUR,
        CesiumMath.PI_OVER_TWO + CesiumMath.PI_OVER_FOUR,
      ]);
    });
  });
});
