import { type OGCParameters } from './ogcHelpers.js';

export const CRS_3857 = 'http://www.opengis.net/def/crs/EPSG/0/3857';
export const CRS_84 = 'http://www.opengis.net/def/crs/OGC/1.3/CRS84';

export type OGCMapQueryOptions = {
  parameters: OGCParameters;
  styleId?: string;
};

export function getOgcMapUrl(url: string, options?: OGCMapQueryOptions): URL {
  const mapUrl = new URL(url, window.location.href);
  const base = mapUrl.pathname.replace(/\/$/, '');
  mapUrl.pathname = options?.styleId
    ? `${base}/styles/${encodeURIComponent(options.styleId)}/map`
    : `${base}/map`;
  mapUrl.hash = '';

  if (options) {
    Object.entries(options.parameters).forEach(([key, value]) => {
      mapUrl.searchParams.delete(key);
      const values = Array.isArray(value) ? value : [value];
      values.forEach((entry) => {
        mapUrl.searchParams.append(key, entry);
      });
    });
  }

  return mapUrl;
}
