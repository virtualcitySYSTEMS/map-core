import type { GeoJsonProperties, Geometry } from 'geojson';
import type { VcsMeta } from '../layer/vectorProperties.js';
import type { FeatureStoreLayerState } from '../layer/featureStoreLayerState.js';

declare module 'geojson' {
  interface Point {
    olcs_radius?: number;
  }

  interface Feature<
    G extends Geometry | null = Geometry,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    P = GeoJsonProperties,
  > {
    _id?: string;
    radius?: G extends Point ? number : never;
    vcsMeta?: VcsMeta;
    state?: FeatureStoreLayerState;
  }

  interface FeatureCollection {
    crs?:
      | { type: 'name'; properties: { name: string } }
      | { type: 'EPSG'; properties: { code: string } };
    vcsMeta?: VcsMeta;
    vcsEmbeddedIcons?: string[];
  }
}
