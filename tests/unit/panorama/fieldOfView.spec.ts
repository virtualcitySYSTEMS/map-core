import { expect } from 'chai';
import type { PerspectiveFrustum, Scene } from '@vcmap-cesium/engine';
import {
  Cartesian3,
  HeadingPitchRoll,
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
import { globalCartesianToImageSpherical } from '../../../src/panorama/sphericalCoordinates.js';
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

  describe('calculating the extent of the image on a non square canvas', () => {
    let scene: Scene;
    let cameraPosition: Cartesian3;
    let invModelMatrix: Matrix4;
    let halfFov: number;
    let halfSmallFov: number;

    before(() => {
      scene = getMockScene();
      cameraPosition = Cartesian3.fromDegrees(0, 0, 1);
      invModelMatrix = Matrix4.inverse(
        Transforms.eastNorthUpToFixedFrame(cameraPosition),
        new Matrix4(),
      );
      (scene.camera.frustum as PerspectiveFrustum).fov =
        CesiumMath.PI_OVER_FOUR;
      halfFov = CesiumMath.PI_OVER_FOUR / 2;
      // half of the smaller angle of a canvas with an aspect ratio of 2 or 0.5
      halfSmallFov = Math.atan(Math.tan(halfFov) / 2);
    });

    after(() => {
      scene.destroy();
    });

    function getExtents(aspectRatio: number, pitch: number): Extent[] {
      (scene.camera.frustum as PerspectiveFrustum).aspectRatio = aspectRatio;
      scene.camera.setView({
        destination: cameraPosition,
        orientation: HeadingPitchRoll.fromDegrees(0, pitch, 0),
      });
      return getFovImageSphericalExtent(scene.camera, invModelMatrix).extents;
    }

    function spansEntireWidth(extents: Extent[]): boolean {
      return (
        extents.length === 1 &&
        extents[0][0] === 0 &&
        Math.abs(extents[0][2] - CesiumMath.TWO_PI) < 0.001
      );
    }

    it('should use the fov as the horizontal angle on a wide canvas', () => {
      const extents = getExtents(2, 0);
      expect(extents).to.have.lengthOf(1);
      arrayCloseTo(extents[0], [
        CesiumMath.THREE_PI_OVER_TWO - halfFov,
        CesiumMath.PI_OVER_TWO - halfSmallFov,
        CesiumMath.THREE_PI_OVER_TWO + halfFov,
        CesiumMath.PI_OVER_TWO + halfSmallFov,
      ]);
    });

    it('should use the fov as the vertical angle on a tall canvas', () => {
      const extents = getExtents(0.5, 0);
      expect(extents).to.have.lengthOf(1);
      arrayCloseTo(extents[0], [
        CesiumMath.THREE_PI_OVER_TWO - halfSmallFov,
        CesiumMath.PI_OVER_TWO - halfFov,
        CesiumMath.THREE_PI_OVER_TWO + halfSmallFov,
        CesiumMath.PI_OVER_TWO + halfFov,
      ]);
    });

    // the wide canvas reaches 11.7 degrees above its center, the tall canvas 22.5 degrees
    it('should not span the entire width, if a pole is just above a wide canvas', () => {
      expect(spansEntireWidth(getExtents(2, 72))).to.be.false;
    });

    it('should span the entire width, if a pole is in view of a wide canvas', () => {
      expect(spansEntireWidth(getExtents(2, 80))).to.be.true;
    });

    it('should span the entire width, if a pole is in view of a tall canvas', () => {
      expect(spansEntireWidth(getExtents(0.5, 72))).to.be.true;
    });
  });

  describe('calculating the extent of a tilted image', () => {
    let scene: Scene;
    let cameraPosition: Cartesian3;
    let invModelMatrix: Matrix4;

    before(() => {
      scene = getMockScene();
      cameraPosition = Cartesian3.fromDegrees(0, 0, 1);
      // model matrix of an image pitched by 45 and rolled by 10 degrees, see createPanoramaImage
      const modelMatrix = Transforms.headingPitchRollToFixedFrame(
        cameraPosition,
        HeadingPitchRoll.fromDegrees(120, -45, -10),
      );
      invModelMatrix = Matrix4.inverseTransformation(
        modelMatrix,
        new Matrix4(),
      );
      (scene.camera.frustum as PerspectiveFrustum).fov = CesiumMath.PI_OVER_TWO;
    });

    after(() => {
      scene.destroy();
    });

    function setView(heading: number, pitch: number): void {
      scene.camera.setView({
        destination: cameraPosition,
        orientation: HeadingPitchRoll.fromDegrees(heading, pitch, 0),
      });
    }

    it('should span the entire width, if a pole is in view', () => {
      // the north pole of the image is tilted 45 degrees towards the back (heading 30 + 180)
      setView(210, 45);
      const { extents } = getFovImageSphericalExtent(
        scene.camera,
        invModelMatrix,
      );
      expect(extents).to.have.lengthOf(1);
      const [[left, top, right]] = extents;
      expect(left).to.equal(0);
      expect(top).to.equal(0);
      expect(right).to.be.closeTo(CesiumMath.TWO_PI, 0.001);
    });

    it('should span the entire width, if the south pole is in view', () => {
      // the south pole of the image is opposite to its north pole
      setView(30, -45);
      const { extents } = getFovImageSphericalExtent(
        scene.camera,
        invModelMatrix,
      );
      expect(extents).to.have.lengthOf(1);
      const [[left, , right, bottom]] = extents;
      expect(left).to.equal(0);
      expect(right).to.be.closeTo(CesiumMath.TWO_PI, 0.001);
      expect(bottom).to.be.closeTo(CesiumMath.PI, 0.001);
    });

    it('should be as large as the field of view of a level camera in every direction', () => {
      const samplesPerEdge = 256;
      const sample = new Cartesian3();
      // the dense sampling of the reference misses up to 0.03 degrees
      const tolerance = CesiumMath.toRadians(0.05);
      for (let heading = 0; heading < 360; heading += 15) {
        for (let pitch = -80; pitch <= 80; pitch += 10) {
          setView(heading, pitch);
          const { extents, center } = getFovImageSphericalExtent(
            scene.camera,
            invModelMatrix,
          );
          const fov = getFov(scene.camera);
          const corners = [
            fov.topLeft,
            fov.topRight,
            fov.bottomRight,
            fov.bottomLeft,
          ];
          let top = CesiumMath.PI;
          let bottom = 0;
          let minPhi = 0;
          let maxPhi = 0;
          for (let index = 0; index < corners.length; index++) {
            const start = corners[index];
            const end = corners[(index + 1) % corners.length];
            for (let i = 0; i <= samplesPerEdge; i++) {
              Cartesian3.lerp(start, end, i / samplesPerEdge, sample);
              const [phi, theta] = globalCartesianToImageSpherical(
                sample,
                invModelMatrix,
              );
              top = Math.min(top, theta);
              bottom = Math.max(bottom, theta);
              const relativePhi = CesiumMath.negativePiToPi(phi - center[0]);
              minPhi = Math.min(minPhi, relativePhi);
              maxPhi = Math.max(maxPhi, relativePhi);
            }
          }

          const message = `heading ${heading}, pitch ${pitch}`;
          const [[left, extentTop, right, extentBottom]] = extents;
          const poleInView =
            extents.length === 1 &&
            left === 0 &&
            right > CesiumMath.TWO_PI - 0.001;
          if (!poleInView) {
            const width = extents.reduce((sum, e) => sum + e[2] - e[0], 0);
            expect(width).to.be.closeTo(maxPhi - minPhi, tolerance, message);
          }
          if (!poleInView || extentTop > 0) {
            expect(extentTop).to.be.closeTo(top, tolerance, message);
          }
          if (!poleInView || extentBottom < CesiumMath.PI - 0.001) {
            expect(extentBottom).to.be.closeTo(bottom, tolerance, message);
          }
        }
      }
    });

    it('should cover the field of view of a level camera in every direction', () => {
      const tolerance = CesiumMath.toRadians(0.01);
      const right = new Cartesian3();
      const up = new Cartesian3();
      const offset = new Cartesian3();
      const sample = new Cartesian3();
      // a single expect per sample is too slow with coverage in the CI
      const uncovered: string[] = [];
      for (let heading = 0; heading < 360; heading += 15) {
        for (let pitch = -80; pitch <= 80; pitch += 10) {
          setView(heading, pitch);
          const { extents } = getFovImageSphericalExtent(
            scene.camera,
            invModelMatrix,
          );
          const fov = getFov(scene.camera);
          Cartesian3.subtract(fov.right, fov.center, right);
          Cartesian3.subtract(fov.top, fov.center, up);
          let covered = true;
          for (let x = -1; x <= 1 && covered; x += 0.1) {
            for (let y = -1; y <= 1 && covered; y += 0.1) {
              Cartesian3.multiplyByScalar(right, x, sample);
              Cartesian3.multiplyByScalar(up, y, offset);
              Cartesian3.add(sample, offset, sample);
              Cartesian3.add(fov.center, sample, sample);
              const [phi, theta] = globalCartesianToImageSpherical(
                sample,
                invModelMatrix,
              );
              covered = extents.some(
                (e) =>
                  (phi - e[0]) * Math.sin(theta) > -tolerance &&
                  (e[2] - phi) * Math.sin(theta) > -tolerance &&
                  theta - e[1] > -tolerance &&
                  e[3] - theta > -tolerance,
              );
            }
          }
          if (!covered) {
            uncovered.push(`heading ${heading}, pitch ${pitch}`);
          }
        }
      }
      expect(uncovered).to.be.empty;
    });
  });
});
