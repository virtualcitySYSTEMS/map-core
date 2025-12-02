import { TrustedServers } from '@vcmap-cesium/engine';

export async function requestUrl(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(
      `Failed fetching url ${url} with status: ${response.status}`,
    );
  }
  return response;
}

export async function requestJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await requestUrl(url, init);
  return response.json() as Promise<T>;
}

export async function requestArrayBuffer(
  url: string,
  init?: RequestInit,
): Promise<ArrayBuffer> {
  const response = await requestUrl(url, init);
  return response.arrayBuffer();
}

export async function requestObjectUrl(
  url: string,
  init?: RequestInit,
): Promise<string> {
  const response = await requestUrl(url, init);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/**
 * Get a RequestInit object for the given url, adding optional headers. If the url is in the
 * TrustedServers {@see https://cesium.com/learn/cesiumjs/ref-doc/TrustedServers.html?classFilter=Trusted}
 * credentials will be included in the request.
 * @param url
 * @param headers
 */
export function getInitForUrl(
  url: string,
  headers?: Record<string, string>,
): RequestInit {
  const init: RequestInit = {};
  if (headers) {
    init.headers = headers;
  }
  if (TrustedServers.contains(url)) {
    init.credentials = 'include';
  }
  return init;
}
