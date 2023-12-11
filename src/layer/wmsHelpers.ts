import { TrustedServers } from '@vcmap-cesium/engine';
import type { Size } from 'ol/size.js';
import TileWMS, { type Options as TileWMSOptions } from 'ol/source/TileWMS.js';
import { getTopLeft, getWidth } from 'ol/extent.js';
import TileGrid, {
  type Options as TileGridOptions,
} from 'ol/tilegrid/TileGrid.js';
import { mercatorProjection, wgs84Projection } from '../util/projection.js';
import { isSameOrigin } from '../util/urlHelpers.js';
import type Extent from '../util/extent.js';
import { TilingScheme } from './rasterLayer.js';
import { getTileLoadFunction } from './openlayers/loadFunctionHelpers.js';

export type WMSSourceOptions = {
  url: string;
  tilingSchema: TilingScheme;
  maxLevel: number;
  minLevel: number;
  tileSize: Size;
  extent?: Extent;
  parameters: Record<string, string>;
  version: string;
  headers?: Record<string, string>;
};

// eslint-disable-next-line import/prefer-default-export
export function getWMSSource(options: WMSSourceOptions): TileWMS {
  const projection =
    options.tilingSchema === 'geographic'
      ? wgs84Projection
      : mercatorProjection;

  const projectionExtent = projection.proj.getExtent();

  const width = getWidth(projectionExtent);
  const size =
    options.tilingSchema === TilingScheme.GEOGRAPHIC
      ? width / (options.tileSize[0] * 2)
      : width / options.tileSize[0];
  const maxZoom = options.maxLevel + 1;
  const resolutions = [];
  for (let z = 0; z < maxZoom; ++z) {
    // generate resolutions and matrixIds arrays for options WmtsLayer
    resolutions.push(size / 2 ** z);
  }
  const tilingOptions: TileGridOptions = {
    origin: getTopLeft(projectionExtent),
    resolutions,
    tileSize: options.tileSize,
    minZoom: options.minLevel,
  };
  if (options.extent && options.extent.isValid()) {
    tilingOptions.extent =
      options.extent.getCoordinatesInProjection(projection);
  }

  const sourceOptions: TileWMSOptions = {
    url: options.url,
    tileGrid: new TileGrid(tilingOptions),
    params: options.parameters,
  };
  if (TrustedServers.contains(options.url)) {
    sourceOptions.crossOrigin = 'use-credentials';
  } else if (!isSameOrigin(options.url)) {
    sourceOptions.crossOrigin = 'anonymous';
  }
  if (options.tilingSchema === 'geographic') {
    if (options.version === '1.3.0') {
      sourceOptions.projection = 'CRS:84';
    } else {
      sourceOptions.projection = 'EPSG:4326';
    }
  } else {
    sourceOptions.projection = 'EPSG:3857';
  }
  if (options.headers) {
    sourceOptions.tileLoadFunction = getTileLoadFunction(options.headers);
  }
  return new TileWMS(sourceOptions);
}
