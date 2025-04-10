import { type Movement } from './navigation.js';
import type { ControllerInput } from './controller/controllerInput.js';
import { getZeroInput, lerpRound } from './controller/controllerInput.js';

const inputScratch = getZeroInput();

export type NavigationEasing = {
  startTime: number;
  target: ControllerInput;
  getMovementAtTime(time: number): {
    movement: Movement;
    finished: boolean;
  };
};

export function createEasing(
  startTime: number,
  duration: number,
  origin: ControllerInput = getZeroInput(),
  target: ControllerInput = getZeroInput(),
): NavigationEasing {
  return {
    startTime,
    target,
    getMovementAtTime(time: number): {
      movement: Movement;
      finished: boolean;
    } {
      const normalizedTime = (time - startTime) / duration;
      if (normalizedTime < 1) {
        const movement: Movement = {
          time: normalizedTime,
          duration,
          input: lerpRound(origin, target, normalizedTime, inputScratch, 3),
        };
        return { movement, finished: time >= startTime + duration };
      }
      return {
        movement: {
          time: normalizedTime,
          duration,
          input: structuredClone(target),
        },
        finished: true,
      };
    },
  };
}
