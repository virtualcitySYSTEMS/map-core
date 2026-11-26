import { TrustedServers } from '@vcmap-cesium/engine';
import XYZ, { type Options as XYZOptions } from 'ol/source/XYZ.js';
import Tile from 'ol/layer/Tile.js';
import ImageLayer from 'ol/layer/Image.js';
import OGCMap, {
  type Options as OGCMapSourceOptions,
} from 'ol/source/OGCMap.js';
import { type Options as BaseLayerOptions } from 'ol/layer/Base.js';
import type { Size } from 'ol/size.js';
import { getTopLeft, getWidth } from 'ol/extent.js';
import TileGrid from 'ol/tilegrid/TileGrid.js';
import type OpenlayersMap from '../../map/openlayersMap.js';
import { isSameOrigin } from '../../util/urlHelpers.js';
import { mercatorProjection, wgs84Projection } from '../../util/projection.js';
import { TilingScheme } from '../rasterLayer.js';
import type { OGCMapImplementationOptions } from '../ogcMapLayer.js';
import type { OGCParameters } from '../ogcHelpers.js';
import {
  CRS_3857,
  CRS_84,
  getOgcMapUrl,
  type OGCMapQueryOptions,
} from '../ogcMapHelpers.js';
import {
  getImageLoadFunction,
  getTileLoadFunction,
} from './loadFunctionHelpers.js';
import RasterLayerOpenlayersImpl from './rasterLayerOpenlayersImpl.js';

/**
 * OGCMapLayer implementation for {@link OpenlayersMap}.
 * Requests map images per tile using the bbox, width & height parameters of the /map endpoint.
 */
class OGCMapOpenlayersImpl extends RasterLayerOpenlayersImpl {
  static get className(): string {
    return 'OGCMapOpenlayersImpl';
  }

  tileSize: Size;

  singleImage2d: boolean;

  styleId: string | undefined;

  parameters: OGCParameters;

  constructor(map: OpenlayersMap, options: OGCMapImplementationOptions) {
    super(map, options);
    this.tileSize = options.tileSize;
    this.singleImage2d = options.singleImage2d;
    this.styleId = options.styleId;
    this.parameters = options.parameters;
  }

  getOLLayer(): Tile<XYZ> | ImageLayer<OGCMap> {
    const url = this.url as string;
    const isGeographic = this.tilingSchema === TilingScheme.GEOGRAPHIC;
    const crs = isGeographic ? CRS_84 : CRS_3857;
    const queryOptions: OGCMapQueryOptions = {
      parameters: this.parameters,
      styleId: this.styleId,
    };
    let crossOrigin: string | undefined;
    if (TrustedServers.contains(url)) {
      crossOrigin = 'use-credentials';
    } else if (!isSameOrigin(url)) {
      crossOrigin = 'anonymous';
    }
    const layerOptions: BaseLayerOptions = {
      opacity: this.opacity,
      minZoom: this.minRenderingLevel,
      maxZoom: this.maxRenderingLevel,
    };
    if (this.extent && this.extent.isValid()) {
      layerOptions.extent =
        this.extent.getCoordinatesInProjection(mercatorProjection);
    }

    if (this.singleImage2d) {
      const imageSourceOptions: OGCMapSourceOptions = {
        url: getOgcMapUrl(url, queryOptions).toString(),
        // OL registers the CRS URIs as projections and sets crs & bbox-crs from the projection code
        projection: crs,
        crossOrigin,
      };
      if (this.headers) {
        imageSourceOptions.imageLoadFunction = getImageLoadFunction(
          this.headers,
        );
      }
      return new ImageLayer({
        ...layerOptions,
        source: new OGCMap(imageSourceOptions),
      });
    }

    const sourceOptions: XYZOptions = {
      tileSize: this.tileSize,
      minZoom: this.minLevel,
      maxZoom: this.maxLevel,
      wrapX: false,
      crossOrigin,
    };
    if (isGeographic) {
      sourceOptions.projection = 'EPSG:4326';
      const projectionExtent = wgs84Projection.proj.getExtent();
      const levelZeroResolution =
        getWidth(projectionExtent) / (this.tileSize[0] * 2);
      sourceOptions.tileGrid = new TileGrid({
        extent: projectionExtent,
        origin: getTopLeft(projectionExtent),
        resolutions: Array.from(
          { length: this.maxLevel + 1 },
          (_, level) => levelZeroResolution / 2 ** level,
        ),
        tileSize: this.tileSize,
        minZoom: this.minLevel,
      });
    }
    if (this.headers) {
      sourceOptions.tileLoadFunction = getTileLoadFunction(this.headers);
    }

    const source = new XYZ(sourceOptions);
    source.setTileUrlFunction((tileCoord) => {
      const bbox = source.getTileGrid()!.getTileCoordExtent(tileCoord);
      const mapUrl = getOgcMapUrl(url, queryOptions);
      mapUrl.searchParams.set('bbox', bbox.join(','));
      mapUrl.searchParams.set('bbox-crs', crs);
      mapUrl.searchParams.set('crs', crs);
      mapUrl.searchParams.set('width', String(this.tileSize[0]));
      mapUrl.searchParams.set('height', String(this.tileSize[1]));
      return mapUrl.toString();
    });

    return new Tile({ ...layerOptions, source });
  }
}

export default OGCMapOpenlayersImpl;
