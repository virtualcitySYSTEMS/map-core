import { Math as CesiumMath } from '@vcmap-cesium/engine';
import { decimalRound } from '../../../util/math.js';

export type ControllerInput = {
  /**
   * amount translating the camera forward (positive amount) or backward (negative amount)
   */
  forward: number;
  /**
   * amount translating the camera right or left (when negative)
   */
  right: number;
  /**
   * amount translating the camera up (positive amount) or down (negative amount)
   */
  up: number;
  /**
   * amount tilting the camera down (positive amount) or up (negative amount) around pitch axis
   */
  tiltDown: number;
  /**
   * amount rolling the camera right (positive amount) or left (negative amount) around roll axis
   */
  rollRight: number;
  /**
   * amount turning the camera right (positive amount) or left (negative amount) around yaw axis (heading)
   */
  turnRight: number;
};

export function getZeroInput(): ControllerInput {
  return {
    forward: 0,
    right: 0,
    up: 0,
    tiltDown: 0,
    rollRight: 0,
    turnRight: 0,
  };
}

export function clearInput(input: ControllerInput): ControllerInput {
  input.forward = 0;
  input.right = 0;
  input.up = 0;
  input.tiltDown = 0;
  input.rollRight = 0;
  input.turnRight = 0;
  return input;
}

export function isNonZeroInput(
  input: ControllerInput,
  epsilon = CesiumMath.EPSILON2,
): boolean {
  return (
    input.forward * input.forward +
      input.right * input.right +
      input.up * input.up >
      epsilon * epsilon ||
    input.tiltDown * input.tiltDown +
      input.rollRight * input.rollRight +
      input.turnRight * input.turnRight >
      epsilon * epsilon
  );
}

export function fromArray(
  array: [number, number, number, number, number, number],
  result: ControllerInput = getZeroInput(),
): ControllerInput {
  result.forward = array[0];
  result.right = array[1];
  result.up = array[2];
  result.tiltDown = array[3];
  result.rollRight = array[4];
  result.turnRight = array[5];
  return result;
}

export function multiplyComponents(
  left: ControllerInput,
  right: ControllerInput,
  result: ControllerInput,
): ControllerInput {
  result.forward = left.forward * right.forward;
  result.right = left.right * right.right;
  result.up = left.up * right.up;
  result.tiltDown = left.tiltDown * right.tiltDown;
  result.rollRight = left.rollRight * right.rollRight;
  result.turnRight = left.turnRight * right.turnRight;
  return result;
}

export function multiplyByScalar(
  input: ControllerInput,
  scalar: number,
  result: ControllerInput,
): ControllerInput {
  result.forward = input.forward * scalar;
  result.right = input.right * scalar;
  result.up = input.up * scalar;
  result.tiltDown = input.tiltDown * scalar;
  result.rollRight = input.rollRight * scalar;
  result.turnRight = input.turnRight * scalar;
  return result;
}

export function add(
  left: ControllerInput,
  right: ControllerInput,
  result: ControllerInput,
): ControllerInput {
  result.forward = left.forward + right.forward;
  result.right = left.right + right.right;
  result.up = left.up + right.up;
  result.tiltDown = left.tiltDown + right.tiltDown;
  result.rollRight = left.rollRight + right.rollRight;
  result.turnRight = left.turnRight + right.turnRight;
  return result;
}

const lerpScratch = getZeroInput();

export function lerp(
  start: ControllerInput,
  end: ControllerInput,
  t: number,
  result: ControllerInput,
): ControllerInput {
  multiplyByScalar(end, t, lerpScratch);
  multiplyByScalar(start, 1.0 - t, result);
  return add(lerpScratch, result, result);
}

export function lerpRound(
  start: ControllerInput,
  end: ControllerInput,
  t: number,
  result: ControllerInput,
  decimals = 2,
): ControllerInput {
  lerp(start, end, t, result);
  result.forward = decimalRound(result.forward, decimals);
  result.right = decimalRound(result.right, decimals);
  result.up = decimalRound(result.up, decimals);
  result.tiltDown = decimalRound(result.tiltDown, decimals);
  result.rollRight = decimalRound(result.rollRight, decimals);
  result.turnRight = decimalRound(result.turnRight, decimals);
  return result;
}

export function inputEquals(
  left?: ControllerInput,
  right?: ControllerInput,
  epsilon = CesiumMath.EPSILON2,
): boolean {
  return !!(
    left === right ||
    (left &&
      right &&
      CesiumMath.equalsEpsilon(left.forward, right.forward, epsilon) &&
      CesiumMath.equalsEpsilon(left.right, right.right, epsilon) &&
      CesiumMath.equalsEpsilon(left.up, right.up, epsilon) &&
      CesiumMath.equalsEpsilon(left.tiltDown, right.tiltDown, epsilon) &&
      CesiumMath.equalsEpsilon(left.rollRight, right.rollRight, epsilon) &&
      CesiumMath.equalsEpsilon(left.turnRight, right.turnRight, epsilon))
  );
}

export function checkThreshold(
  input: ControllerInput,
  epsilon: number,
): boolean {
  return Object.values(input).some((v) => Math.abs(v) > epsilon);
}
