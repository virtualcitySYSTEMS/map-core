import { Resource } from '@vcmap-cesium/engine';

// eslint-disable-next-line import/prefer-default-export
export function getResourceOrUrl(
  url: string,
  headers?: Record<string, string>,
): string | Resource {
  if (headers) {
    return new Resource({
      url,
      headers,
    });
  }
  return url;
}
