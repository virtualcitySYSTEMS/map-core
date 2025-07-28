import { Math as CesiumMath } from '@vcmap-cesium/engine';
import { expect } from 'chai';

/**
 * helper function to wait for a timeout use: await timeout(1);
 */
export function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function arrayCloseTo<T extends number[]>(
  numbers: T,
  expectedNumbers: T,
  epsilon = CesiumMath.EPSILON8,
  message = '',
): void {
  expect(numbers.length).to.equal(expectedNumbers.length);
  numbers.forEach((c, index) => {
    expect(c).to.be.closeTo(
      expectedNumbers[index],
      epsilon,
      `Array at index ${String(index)}${message}`,
    );
  });
}

export function replaceRequestAnimationFrame(): {
  tick: () => void;
  cleanup: () => void;
} {
  let callbacks: FrameRequestCallback[] = [];
  const originalRequestAnimationFrame = global.requestAnimationFrame;
  const originalCancelAnimationFrame = global.cancelAnimationFrame;

  global.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    callbacks.push(callback);
    return 0;
  };

  global.cancelAnimationFrame = (): void => {
    callbacks = [];
  };

  return {
    tick(time = 0): void {
      const toExecute = callbacks.slice();
      callbacks = [];
      toExecute.forEach((callback) => {
        callback(time);
      });
    },
    cleanup(): void {
      global.requestAnimationFrame = originalRequestAnimationFrame;
      global.cancelAnimationFrame = originalCancelAnimationFrame;
    },
  };
}
