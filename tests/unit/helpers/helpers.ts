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
): void {
  numbers.forEach((c, index) => {
    expect(c).to.be.closeTo(
      expectedNumbers[index],
      epsilon,
      `Array at index ${index}`,
    );
  });
}
