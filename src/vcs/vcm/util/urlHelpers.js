/**
 * @param {string} source
 * @returns {boolean}
 */
// eslint-disable-next-line import/prefer-default-export
export function isSameOrigin(source) {
  const { location } = window;
  const url = new URL(source, `${location.protocol}//${location.host}${location.pathname}`);
  // for instance data: URIs have no host information and are implicitly same origin
  // see https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy#inherited_origins
  if (!url.host) {
    return true;
  }
  return url.protocol === location.protocol &&
    url.host === location.host;
}
