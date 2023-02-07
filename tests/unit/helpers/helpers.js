import { Math as CesiumMath } from '@vcmap-cesium/engine';

/**
 * helper function to wait for a timeout use: await timeout(1);
 * @param {number} ms
 * @returns {Promise<void>}
 */
// eslint-disable-next-line import/prefer-default-export
export function timeout(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * @param {Array<number>} numbers
 * @param {Array<number>} expectedNumbers
 * @param {number} [epsilon=CesiumMath.EPSILON8]
 */
export function arrayCloseTo(numbers, expectedNumbers, epsilon = CesiumMath.EPSILON8) {
  numbers.forEach((c, index) => {
    expect(c).to.be.closeTo(expectedNumbers[index], epsilon, `Array at index ${index}`);
  });
}
