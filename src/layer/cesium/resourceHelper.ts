import { Resource } from '@vcmap-cesium/engine';

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
