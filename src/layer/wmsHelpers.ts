import { TrustedServers } from '@vcmap-cesium/engine';
import { getLogger } from '@vcsuite/logger';
import type { Size } from 'ol/size.js';
import TileWMS, { type Options as TileWMSOptions } from 'ol/source/TileWMS.js';
import ImageWMS, {
  type Options as ImageWMSOptions,
} from 'ol/source/ImageWMS.js';

import { getTopLeft, getWidth } from 'ol/extent.js';
import TileGrid, {
  type Options as TileGridOptions,
} from 'ol/tilegrid/TileGrid.js';
import { mercatorProjection, wgs84Projection } from '../util/projection.js';
import { isSameOrigin } from '../util/urlHelpers.js';
import type Extent from '../util/extent.js';
import { TilingScheme } from './rasterLayer.js';
import { getTileLoadFunction } from './openlayers/loadFunctionHelpers.js';
import { getInitForUrl, requestObjectUrl } from '../util/fetch.js';

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

export function getProjectionFromWMSSourceOptions(
  tilingSchema: TilingScheme,
  version: string,
): string {
  if (tilingSchema === 'geographic') {
    if (version === '1.3.0') {
      return 'CRS:84';
    } else {
      return 'EPSG:4326';
    }
  }
  return 'EPSG:3857';
}

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
    projection: getProjectionFromWMSSourceOptions(
      options.tilingSchema,
      options.version,
    ),
  };

  if (TrustedServers.contains(options.url)) {
    sourceOptions.crossOrigin = 'use-credentials';
  } else if (!isSameOrigin(options.url)) {
    sourceOptions.crossOrigin = 'anonymous';
  }
  if (options.headers) {
    sourceOptions.tileLoadFunction = getTileLoadFunction(options.headers);
  }
  return new TileWMS(sourceOptions);
}

export function getImageWMSSource(options: {
  url: string;
  parameters: Record<string, string>;
  tilingSchema: TilingScheme;
  version: string;
  headers?: Record<string, string>;
}): ImageWMS {
  const sourceOptions: ImageWMSOptions = {
    url: options.url,
    params: options.parameters,
    projection: getProjectionFromWMSSourceOptions(
      options.tilingSchema,
      options.version,
    ),
  };

  if (TrustedServers.contains(options.url)) {
    sourceOptions.crossOrigin = 'use-credentials';
  } else if (!isSameOrigin(options.url)) {
    sourceOptions.crossOrigin = 'anonymous';
  }

  if (options.headers) {
    sourceOptions.imageLoadFunction = function imageLoadFunction(
      image,
      src,
    ): void {
      const img = image.getImage() as HTMLImageElement;
      const init = getInitForUrl(src, options.headers);
      requestObjectUrl(src, init)
        .then((blobUrl) => {
          img.src = blobUrl;
          img.onload = (): void => {
            URL.revokeObjectURL(blobUrl);
          };
        })
        .catch(() => {
          getLogger('ImageWMSSource').error(`Could not load image: ${src}`);
        });
    };
  }

  return new ImageWMS(sourceOptions);
}
