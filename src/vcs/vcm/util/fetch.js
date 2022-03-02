/**
 * @param {string} url
 * @param {RequestInit=} init
 * @returns {Promise<Response>}
 */
export async function requestUrl(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Failed fetching url ${url} with status: ${response.status}`);
  }
  return response;
}

/**
 * @param {string} url
 * @param {RequestInit=} init
 * @returns {Promise<any>}
 */
export async function requestJson(url, init) {
  const response = await requestUrl(url, init);
  return response.json();
}

/**
 * @param {string} url
 * @param {RequestInit=} init
 * @returns {Promise<ArrayBuffer>}
 */
export async function requestArrayBuffer(url, init) {
  const response = await requestUrl(url, init);
  return response.arrayBuffer();
}
