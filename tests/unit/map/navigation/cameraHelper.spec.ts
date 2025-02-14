import { expect } from 'chai';
import {
  Camera,
  Cartesian3,
  HeadingPitchRoll,
  Math as CesiumMath,
} from '@vcmap-cesium/engine';
import {
  lookTwoDof,
  moveFiveDOF,
} from '../../../../src/map/navigation/cameraHelper.js';
import { getMockScene } from '../../helpers/cesiumHelpers.js';

function isZeroOrMultipleOfPi(value: number): boolean {
  return value === 0 || Math.abs(value % CesiumMath.PI) < CesiumMath.EPSILON7;
}

describe('camera helper', () => {
  describe('lookTwoDof', () => {
    let camera: Camera;

    beforeEach(() => {
      camera = new Camera(getMockScene());
      camera.position = new Cartesian3();
      camera.direction = new Cartesian3(-1, 0, 0);
      camera.right = new Cartesian3(0, 1, 0);
      camera.up = new Cartesian3(0, 0, 1);
    });

    it('should tilt the camera down within the threshold', () => {
      const tiltAmount = CesiumMath.toRadians(45);
      const rotation = new HeadingPitchRoll(0, tiltAmount, 0);
      lookTwoDof(camera, rotation, Cartesian3.UNIT_Z);
      expect(camera.pitch).to.equal(-tiltAmount);
    });

    it('should not tilt the camera beyond the negative threshold', () => {
      const rotation = new HeadingPitchRoll(0, CesiumMath.toRadians(100), 0);
      const pitchThreshold = 75;
      lookTwoDof(camera, rotation, Cartesian3.UNIT_Z, pitchThreshold);
      expect(camera.pitch).to.be.closeTo(
        -CesiumMath.toRadians(pitchThreshold),
        0.00001,
      );
    });

    it('should tilt up the camera, if pitch is already beyond negative threshold', () => {
      camera.direction = new Cartesian3(0, 0, -1);
      camera.right = new Cartesian3(1, 0, 0);
      camera.up = new Cartesian3(0, 1, 0);
      expect(camera.pitch).to.equal(-Math.PI / 2);
      const tiltAmount = CesiumMath.toRadians(-10);
      const rotation = new HeadingPitchRoll(0, tiltAmount, 0);
      const pitchThreshold = 75;
      lookTwoDof(camera, rotation, Cartesian3.UNIT_Z, pitchThreshold);
      expect(camera.pitch).to.be.closeTo(
        -CesiumMath.toRadians(pitchThreshold),
        0.00001,
      );
    });

    it('should not rotate the camera pitch beyond the positive threshold', () => {
      const rotation = new HeadingPitchRoll(0, -CesiumMath.toRadians(100), 0);
      const pitchThreshold = CesiumMath.toRadians(75);
      lookTwoDof(camera, rotation, Cartesian3.UNIT_Z, pitchThreshold);
      expect(camera.pitch).to.be.closeTo(
        CesiumMath.toRadians(pitchThreshold),
        0.00001,
      );
    });

    it('should turn the camera heading in horizontal view', () => {
      const newHeading = CesiumMath.toRadians(45);
      const rotation = new HeadingPitchRoll(newHeading, 0, 0);
      lookTwoDof(camera, rotation, Cartesian3.UNIT_Z);
      expect(camera.heading).to.equal(newHeading);
    });

    it('should turn the camera heading in tilted view', () => {
      const pitch = CesiumMath.toRadians(45);
      lookTwoDof(camera, new HeadingPitchRoll(0, pitch, 0), Cartesian3.UNIT_Z);
      expect(camera.pitch).to.equal(-pitch);
      const newHeading = CesiumMath.toRadians(45);
      const rotation = new HeadingPitchRoll(newHeading, 0, 0);
      lookTwoDof(camera, rotation, Cartesian3.UNIT_Z);
      expect(camera.heading).to.equal(newHeading);
      expect(isZeroOrMultipleOfPi(camera.roll)).to.be.true;
    });

    it('should not roll', () => {
      const newRoll = CesiumMath.toRadians(45);
      const rotation = new HeadingPitchRoll(0, 0, newRoll);
      lookTwoDof(camera, rotation, Cartesian3.UNIT_Z);
      expect(isZeroOrMultipleOfPi(camera.roll)).to.be.true;
    });

    it('should rotate multiple axis', () => {
      const newHeading = CesiumMath.toRadians(45);
      const newPitch = CesiumMath.toRadians(45);
      const newRoll = CesiumMath.toRadians(45);
      const rotation = new HeadingPitchRoll(newHeading, newPitch, newRoll);
      lookTwoDof(camera, rotation, Cartesian3.UNIT_Z);
      expect(camera.heading).to.equal(newHeading);
      expect(camera.pitch).to.equal(-newPitch);
      expect(isZeroOrMultipleOfPi(camera.roll)).to.be.true;
    });
  });

  describe('moveFiveDOF', () => {
    let startPosition: Cartesian3;
    let camera: Camera;

    beforeEach(() => {
      startPosition = new Cartesian3(1, 1, 1);
      camera = new Camera(getMockScene());
      camera.position = startPosition.clone(new Cartesian3());
      camera.direction = new Cartesian3(1, 0, 0);
      camera.right = new Cartesian3(0, 1, 0);
      camera.up = new Cartesian3(0, 0, 1);
    });

    it('should move the camera forward', () => {
      moveFiveDOF(camera, new Cartesian3(0, 1, 0), Cartesian3.UNIT_Z);
      expect(camera.position.x).to.be.greaterThan(startPosition.x);
      expect(camera.position.y).to.equal(startPosition.y);
      expect(Cartesian3.magnitudeSquared(camera.position)).to.equal(
        Cartesian3.magnitudeSquared(startPosition),
      );
    });

    it('should move the camera right', () => {
      moveFiveDOF(camera, new Cartesian3(1, 0, 0), Cartesian3.UNIT_Z);
      expect(camera.position.x).to.equal(startPosition.x);
      expect(camera.position.y).to.be.greaterThan(startPosition.y);
      expect(Cartesian3.magnitudeSquared(camera.position)).to.equal(
        Cartesian3.magnitudeSquared(startPosition),
      );
    });

    it('should move the camera diagonal', () => {
      moveFiveDOF(camera, new Cartesian3(1, 1, 0), Cartesian3.UNIT_Z);
      expect(camera.position.x).to.be.greaterThan(startPosition.x);
      expect(camera.position.y).to.be.greaterThan(startPosition.y);
      expect(Cartesian3.magnitudeSquared(camera.position)).to.equal(
        Cartesian3.magnitudeSquared(startPosition),
      );
    });

    it('should move the camera up', () => {
      moveFiveDOF(camera, new Cartesian3(0, 0, 1), Cartesian3.UNIT_Z);
      expect(camera.position.x).to.equal(startPosition.x);
      expect(camera.position.y).to.equal(startPosition.y);
      expect(camera.position.z).to.equal(startPosition.z + 1);
    });
  });
});
