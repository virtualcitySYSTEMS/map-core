import {
  Camera,
  Cartesian3,
  HeadingPitchRoll,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  PerspectiveFrustum,
  Scene,
  Transforms,
} from '@vcmap-cesium/engine';
import { ControllerInput } from './controller/controllerInput.js';

const EPSILON3_SQURD = CesiumMath.EPSILON3 * CesiumMath.EPSILON3;

const scratchPitchAxis = new Cartesian3();
const scratchRotateAxis = new Cartesian3();
const scratchRight = new Cartesian3();
const scratchDirection = new Cartesian3();
const scratchMatrix3 = new Matrix3();
const scratchMatrix4 = new Matrix4();

/**
 * change camera orientation with two degrees of freedom (roll is ignored)
 * @param camera
 * @param rotation vector of rotation amounts
 * @param geodeticUp up vector of geodetic east north frame
 * @param [pitchThreshold=89.9] threshold for a maximum pitch angle in degrees.
 */
export function lookTwoDof(
  camera: Camera,
  rotation: HeadingPitchRoll,
  geodeticUp: Cartesian3,
  pitchThreshold = 89.9,
): void {
  const pitchAxis = Cartesian3.cross(
    camera.direction,
    geodeticUp,
    scratchPitchAxis,
  );
  const pitchThresholdRadian = CesiumMath.toRadians(pitchThreshold);
  const newPitch = camera.pitch - rotation.pitch;
  // avoid rotating beyond threshold resulting in an upside down view
  if (newPitch < -pitchThresholdRadian) {
    rotation.pitch = rotation.pitch + newPitch + pitchThresholdRadian;
  } else if (newPitch > pitchThresholdRadian) {
    rotation.pitch = rotation.pitch + newPitch - pitchThresholdRadian;
  }

  // rotate vector must not be zero vector
  if (Cartesian3.magnitudeSquared(pitchAxis) > EPSILON3_SQURD) {
    camera.look(pitchAxis, rotation.pitch);
  } else {
    const sign = Math.sign(Cartesian3.dot(camera.direction, geodeticUp));
    camera.look(camera.right, rotation.pitch * -sign);
  }

  camera.look(geodeticUp, rotation.heading);
}

/**
 * Move the camera along the circumference of a circle by rotating it around the circle's center
 * @param camera
 * @param direction
 * @param geodeticUp up vector of geodetic east north up frame
 * @param radius in m
 */
function moveAlongGreatCircle(
  camera: Camera,
  direction: Cartesian3,
  geodeticUp: Cartesian3,
  radius: number,
): void {
  const rotateAxis = Cartesian3.cross(direction, geodeticUp, scratchRotateAxis);
  const arcLength = Cartesian3.magnitude(direction);
  const circum = 2 * Math.PI * radius;
  const angle = (arcLength / circum) * (2 * Math.PI);
  if (!Number.isNaN(angle)) {
    // rotateVector must not be zero vector (movement in z is not handled here)
    if (Cartesian3.magnitudeSquared(rotateAxis) > EPSILON3_SQURD) {
      camera.rotate(rotateAxis, angle);
    } else if (
      Math.abs(direction.x) > CesiumMath.EPSILON3 ||
      Math.abs(direction.y) > CesiumMath.EPSILON3
    ) {
      // xy-movement in nadir view
      const sign = Math.sign(Cartesian3.dot(direction, geodeticUp));
      camera.rotate(camera.right, angle * -sign);
    }
  }
}

/**
 * Move with five degrees of freedom on a great circle
 * @param camera
 * @param translation vector of translation amounts
 * @param geodeticUp up vector of geodetic east north up frame
 */
export function moveFiveDOF(
  camera: Camera,
  translation: Cartesian3,
  geodeticUp: Cartesian3,
): void {
  const right = Cartesian3.multiplyByScalar(
    camera.right,
    translation.x,
    scratchRight,
  );
  const dir = Cartesian3.multiplyByScalar(
    camera.direction,
    translation.y,
    scratchDirection,
  );
  // update great circle radius
  camera.move(geodeticUp, translation.z);
  const direction = Cartesian3.add(right, dir, scratchDirection);
  const radius = Cartesian3.magnitude(camera.position);
  moveAlongGreatCircle(camera, direction, geodeticUp, radius);
}

/**
 * get the east north up unit vector at camera position
 * @param scene
 * @param [result]
 */
export function getEnuVector(
  scene: Scene,
  result = new Cartesian3(),
): Cartesian3 {
  const rotMat = Matrix4.getMatrix3(
    Transforms.eastNorthUpToFixedFrame(
      scene.camera.position,
      scene.globe.ellipsoid,
      scratchMatrix4,
    ),
    scratchMatrix3,
  );
  return Matrix3.getColumn(rotMat, 2, result);
}

/**
 * get current camera field of view
 * @param camera
 */
export function getFov(camera: Camera): number {
  return camera.frustum instanceof PerspectiveFrustum ? camera.frustum.fov : 1;
}

/**
 * derive distance dependent scale. Scale is limited to a lower bound so you don't slow to a crawl
 * @param distance
 * @param min
 */
export function getScaleFromDistance(distance: number, min = 16): number {
  if (distance < min) {
    return min;
  }
  return distance;
}

/**
 * get translation vector scaled based on current height over ground and field of view
 * @param scene
 * @param input
 * @param hsb
 * @param [result]
 */
export function getScaledTranslation(
  scene: Scene,
  input: ControllerInput,
  hsb: number,
  result = new Cartesian3(),
): Cartesian3 {
  let ellipsoidHeight = 0;
  const { positionCartographic } = scene.camera;
  const height = scene.globe.getHeight(positionCartographic);
  if (height && !Number.isNaN(height)) {
    ellipsoidHeight = height;
  }
  const scale = getScaleFromDistance(
    Math.abs(positionCartographic.height - ellipsoidHeight),
  );
  const scalar = scale * hsb * getFov(scene.camera);
  result.x = input.right * scalar;
  result.y = input.forward * scalar;
  result.z = input.up * scalar;
  return result;
}

/**
 * get rotation vector scaled based on current field of view
 * @param scene
 * @param input
 * @param hsb
 * @param [result]
 */
export function getScaledRotation(
  scene: Scene,
  input: ControllerInput,
  hsb: number,
  result = new HeadingPitchRoll(),
): HeadingPitchRoll {
  const scalar = hsb * getFov(scene.camera);
  result.heading = input.turnRight * scalar;
  result.pitch = input.tiltDown * scalar;
  result.roll = input.rollRight * scalar;
  return result;
}
