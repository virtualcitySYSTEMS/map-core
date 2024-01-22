import { v4 as uuidv4 } from 'uuid';
import { TrustedServers } from '@vcmap-cesium/engine';
import type { ImageTile } from 'ol';
import type { Size } from 'ol/size.js';
import OLProjection from 'ol/proj/Projection.js';
import View from 'ol/View.js';
import TileGrid from 'ol/tilegrid/TileGrid.js';
import TileImage, {
  type Options as TileImageOptions,
} from 'ol/source/TileImage.js';
import Tile from 'ol/layer/Tile.js';
import type ObliqueImageMeta from './obliqueImageMeta.js';
import { isSameOrigin } from '../util/urlHelpers.js';
import { getTileLoadFunction } from '../layer/openlayers/loadFunctionHelpers.js';

let defaultImage = '';
function getDefaultImage(): string {
  if (!defaultImage) {
    const canvas = document.createElement('canvas');
    canvas.height = 512;
    canvas.width = 512;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    context.fillStyle = '#409D76';
    context.fillRect(0, 0, 512, 512);
    context.font = 'bold 46px Monospace, Courier New';
    context.fillStyle = '#424242';
    context.textAlign = 'center';
    context.fillText('No Image', 256, 256);
    defaultImage = canvas.toDataURL('png');
  }
  return defaultImage;
}

export type ObliqueViewOptions = {
  minZoom: number;
  maxZoom: number;
  scaleFactor: number;
  hideLevels: number;
};

class ObliqueView {
  id = uuidv4();

  size: Size;

  url: string;

  tileSize: Size;

  format: string;

  minZoom: number;

  maxZoom: number;

  scaleFactor: number;

  tileResolution: number[];

  private _view: View | undefined;

  private _tileImageSource: TileImage | undefined;

  private _layer: Tile<TileImage> | undefined;

  private _headers?: Record<string, string>;

  constructor(imageMeta: ObliqueImageMeta, options: ObliqueViewOptions) {
    this.size = imageMeta.size;
    this.url = imageMeta.url;
    this.tileSize = imageMeta.tileSize;
    this.format = imageMeta.format;
    this.minZoom = options.minZoom;
    this.maxZoom = options.maxZoom;
    this.scaleFactor = options.scaleFactor;
    this._headers = imageMeta.headers;
    const { tileResolution } = imageMeta;
    this.tileResolution = tileResolution.slice(
      0,
      tileResolution.length - options.hideLevels,
    );

    const extent = [0, 0, ...this.size];
    const zoomifyProjection = new OLProjection({
      code: 'ZOOMIFY',
      units: 'pixels',
      extent,
    });

    const maxZoom =
      this.maxZoom > 0 ? this.maxZoom : this.tileResolution.length + 4;
    const zoomMultiplier = Math.log(2) / Math.log(this.scaleFactor);

    this._view = new View({
      projection: zoomifyProjection,
      center: [this.size[0] / 2, this.size[1] / 2],
      constrainOnlyCenter: true,
      minZoom: this.minZoom * zoomMultiplier,
      maxZoom: maxZoom * zoomMultiplier,
      extent: [-2000, -2000, this.size[0] + 2000, this.size[1] + 2000],
      zoom: this.minZoom * zoomMultiplier,
      zoomFactor: this.scaleFactor,
    });

    const tileImageOptions: TileImageOptions = {
      projection: zoomifyProjection,
      tileGrid: new TileGrid({
        origin: [0, 0],
        extent,
        resolutions: this.tileResolution,
        tileSize: this.tileSize,
      }),
    };
    if (TrustedServers.contains(this.url)) {
      tileImageOptions.crossOrigin = 'use-credentials';
    } else if (!isSameOrigin(this.url)) {
      tileImageOptions.crossOrigin = 'anonymous';
    }
    if (this._headers) {
      tileImageOptions.tileLoadFunction = getTileLoadFunction(this._headers);
    }

    this._tileImageSource = new TileImage(tileImageOptions);

    this._layer = new Tile({
      source: this.tileImageSource,
      extent,
    });
  }

  /**
   * The view for these oblique images.
   */
  get view(): View {
    if (!this._view) {
      throw new Error('trying to access destroyed oblique view');
    }
    return this._view;
  }

  /**
   * The layer of these images.
   */
  get layer(): Tile<TileImage> {
    if (!this._layer) {
      throw new Error('trying to access destroyed oblique view');
    }
    return this._layer;
  }

  /**
   * The layer of these images.
   */
  get tileImageSource(): TileImage {
    if (!this._tileImageSource) {
      throw new Error('trying to access destroyed oblique view');
    }
    return this._tileImageSource;
  }

  /**
   * Sets the layers source to request data for this image
   * @param  name
   * @param  [isDefaultImage=false]
   */
  setImageName(name: string, isDefaultImage: unknown = false): void {
    if (isDefaultImage) {
      this.tileImageSource.setTileLoadFunction((tile) => {
        ((tile as ImageTile).getImage() as HTMLImageElement).src =
          getDefaultImage();
        tile.load();
      });
    }
    this.tileImageSource.setTileUrlFunction((coords) => {
      const [z, x, yInverted] = coords;
      const y = -yInverted - 1;
      return `${this.url}/${name}/${z}/${x}/${y}.${this.format}`;
    });
    this.tileImageSource.refresh();
  }

  destroy(): void {
    this._view = undefined;
    this._layer = undefined;
    this.tileImageSource.clear();
    this._tileImageSource = undefined;
  }
}

export default ObliqueView;
