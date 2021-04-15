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
