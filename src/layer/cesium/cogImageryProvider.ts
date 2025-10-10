import type { Projection } from 'ol/proj.js';
import type GeoTIFFSource from 'ol/source/GeoTIFF.js';
import {
  createEmpty as createEmptyExtent,
  extend as extendExtent,
  getWidth as getExtentWidth,
  getHeight as getExtentHeight,
  getTopLeft as getTopLeftExtent,
} from 'ol/extent.js';
import TileState from 'ol/TileState.js';
import {
  Cartesian2,
  Event as CesiumEvent,
  GeographicTilingScheme,
  type ImageryTypes,
  Math as CesiumMath,
  Rectangle,
  type TilingScheme,
  WebMercatorTilingScheme,
} from '@vcmap-cesium/engine';
import EventType from 'ol/events/EventType.js';
import type TileGrid from 'ol/tilegrid/TileGrid.js';
import {
  mercatorExtentToRectangle,
  rectangleToMercatorExtent,
} from '../../util/math.js';

export function createEmptyCanvas(
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function areGridsAligned(
  tileGrid: TileGrid,
  tilingScheme: TilingScheme,
): boolean {
  const olRectangle = mercatorExtentToRectangle(
    tileGrid.getTileCoordExtent([0, 0, 0]),
  );
  const cesiumRectangle = tilingScheme.tileXYToRectangle(0, 0, 0);

  return Rectangle.equalsEpsilon(
    cesiumRectangle,
    olRectangle,
    CesiumMath.EPSILON8,
  );
}

function getTilingSchemeFromSource(source: GeoTIFFSource): TilingScheme {
  const tileGrid = source.getTileGrid()!;
  const projection = source.getProjection()!;
  const extent = tileGrid.getExtent();
  const level0TileRange = tileGrid.getTileRangeForExtentAndZ(extent, 0);

  let tilingScheme: TilingScheme | undefined;

  if (projection.getCode() === 'EPSG:4326') {
    tilingScheme = new GeographicTilingScheme({
      numberOfLevelZeroTilesX: level0TileRange.getWidth(),
      numberOfLevelZeroTilesY: level0TileRange.getHeight(),
      rectangle: mercatorExtentToRectangle(extent),
    });
  } else if (projection.getCode() === 'EPSG:3857') {
    tilingScheme = new WebMercatorTilingScheme({
      numberOfLevelZeroTilesX: level0TileRange.getWidth(),
      numberOfLevelZeroTilesY: level0TileRange.getHeight(),
      rectangleSouthwestInMeters: new Cartesian2(extent[0], extent[1]),
      rectangleNortheastInMeters: new Cartesian2(extent[2], extent[3]),
    });
  }

  if (!tilingScheme) {
    throw new Error(`Unexpected code projection: ${projection.getCode()}`);
  }
  return tilingScheme;
}

export default class COGImageryProvider {
  private _emptyCanvas: HTMLCanvasElement;

  // eslint-disable-next-line @typescript-eslint/naming-convention
  _reload: undefined | (() => void) = undefined;

  private _projection: Projection;

  private _tilingScheme: TilingScheme;

  private _tileGrid: TileGrid;

  private _boundTileLoader: (
    x: number,
    y: number,
    level: number,
  ) => Promise<ImageryTypes>;

  readonly tileWidth: number = 256;

  readonly tileHeight: number = 256;

  constructor(private _source: GeoTIFFSource) {
    this._emptyCanvas = createEmptyCanvas(this.tileWidth, this.tileHeight);
    this._projection = this._source.getProjection()!;
    this._tileGrid = this._source.getTileGrid()!;
    this._tilingScheme = getTilingSchemeFromSource(this._source);
    if (areGridsAligned(this._tileGrid, this._tilingScheme)) {
      this._boundTileLoader = this._loadAlignedTile.bind(this);
    } else {
      this._boundTileLoader = this._loadUnalignedTile.bind(this);
    }

    // @ts-expect-error protected
    const [width, height] = this._source.getTileSize(0);
    this.tileWidth = Math.round(width);
    this.tileHeight = Math.round(height);
  }

  // eslint-disable-next-line class-methods-use-this,@typescript-eslint/naming-convention
  get _ready(): boolean {
    return true;
  }

  // eslint-disable-next-line class-methods-use-this
  get ready(): boolean {
    return true;
  }

  get rectangle(): Rectangle {
    return this._tilingScheme.rectangle;
  }

  get tilingScheme(): TilingScheme {
    return this._tilingScheme;
  }

  readonly errorEvent: CesiumEvent = new CesiumEvent();

  // eslint-disable-next-line class-methods-use-this
  get credit(): undefined {
    return undefined;
  }

  // eslint-disable-next-line class-methods-use-this
  get proxy(): undefined {
    return undefined;
  }

  get maximumLevel(): number {
    const tileGrid = this._source.getTileGrid();
    if (tileGrid) {
      return tileGrid.getMaxZoom();
    } else {
      return 18; // some arbitrary value
    }
  }

  // eslint-disable-next-line class-methods-use-this
  get minimumLevel(): number {
    // WARNING: Do not use the minimum level (at least until the extent is
    // properly set). Cesium assumes the minimumLevel to contain only
    // a few tiles and tries to load them all at once -- this can
    // freeze and/or crash the browser !
    return 0;
    //var tg = this._source.getTileGrid();
    //return tg ? tg.getMinZoom() : 0;
  }

  // eslint-disable-next-line class-methods-use-this
  get tileDiscardPolicy(): undefined {
    return undefined;
  }

  // eslint-disable-next-line class-methods-use-this
  get hasAlphaChannel(): boolean {
    return true;
  }

  private async _loadOLTile(
    x: number,
    y: number,
    level: number,
  ): Promise<Uint8Array | undefined> {
    const tile = this._source.getTile(level, x, y, 1, this._projection);
    if (tile) {
      return new Promise<Uint8Array | undefined>((resolve) => {
        const listener = (): void => {
          const data = tile.getData() as Uint8Array | null;
          if (data) {
            tile.removeEventListener(EventType.CHANGE, listener);
            resolve(data);
          } else if (
            tile.getState() === TileState.EMPTY ||
            tile.getState() === TileState.ERROR
          ) {
            tile.removeEventListener(EventType.CHANGE, listener);
            resolve(undefined);
          }
        };
        if (tile.getState() === TileState.LOADED) {
          listener();
        } else if (
          tile.getState() === TileState.EMPTY ||
          tile.getState() === TileState.ERROR
        ) {
          resolve(undefined);
        } else {
          tile.addEventListener(EventType.CHANGE, listener);
          if (tile.getState() === TileState.IDLE) {
            tile.load();
          }
        }
      });
    }
    return Promise.resolve(undefined);
  }

  private _drawData(
    ctx: CanvasRenderingContext2D,
    data: Uint8Array,
    offsetX = 0,
    offsetY = 0,
  ): void {
    const imageData = ctx.createImageData(this.tileWidth, this.tileHeight);
    let usedData = data;
    // this is a grey image
    if (data.length === imageData.data.length / 2) {
      usedData = new Uint8Array(imageData.data.length);
      for (let i = 0; i < data.length; i++) {
        const value = data[i];
        if (i % 2 === 0) {
          const pixelOffset = (i / 2) * 4;
          usedData[pixelOffset] = value;
          usedData[pixelOffset + 1] = value;
          usedData[pixelOffset + 2] = value;
        } else {
          const pixelOffset = ((i - 1) / 2) * 4;
          usedData[pixelOffset + 3] = value;
        }
      }
    }

    imageData.data.set(usedData);
    ctx.putImageData(imageData, offsetX, offsetY);
  }

  private async _loadAlignedTile(
    x: number,
    y: number,
    level: number,
  ): Promise<ImageryTypes> {
    const tileData = await this._loadOLTile(x, y, level);
    if (tileData) {
      const canvas = createEmptyCanvas(this.tileWidth, this.tileHeight);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        this._drawData(ctx, tileData);
      }
      return canvas;
    }

    return this._emptyCanvas;
  }

  private async _loadUnalignedTile(
    x: number,
    y: number,
    level: number,
  ): Promise<ImageryTypes> {
    const rectangle = this._tilingScheme.tileXYToRectangle(x, y, level);
    const extent = rectangleToMercatorExtent(rectangle);
    const resolution = Math.max(
      getExtentWidth(extent) / this.tileWidth,
      getExtentHeight(extent) / this.tileHeight,
    );
    const levelResolution = this._tileGrid.getZForResolution(resolution);
    const tileRange = this._tileGrid.getTileRangeForExtentAndZ(
      extent,
      levelResolution,
    );
    const canvas = createEmptyCanvas(
      this.tileWidth * tileRange.getWidth(),
      this.tileHeight * tileRange.getHeight(),
    );
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return this._emptyCanvas;
    }

    const promises: Promise<void>[] = [];
    const tileRangeExtent = createEmptyExtent();
    for (
      let partialX = tileRange.minX;
      partialX <= tileRange.maxX;
      partialX++
    ) {
      for (
        let partialY = tileRange.minY;
        partialY <= tileRange.maxY;
        partialY++
      ) {
        extendExtent(
          tileRangeExtent,
          this._tileGrid.getTileCoordExtent([
            levelResolution,
            partialX,
            partialY,
          ]),
        );
        promises.push(
          this._loadOLTile(partialX, partialY, levelResolution).then(
            (tileData) => {
              if (tileData) {
                this._drawData(
                  ctx,
                  tileData,
                  (partialX - tileRange.minX) * this.tileWidth,
                  (partialY - tileRange.minY) * this.tileHeight,
                );
              }
            },
          ),
        );
      }
    }
    await Promise.all(promises);

    const unitsPerPixelX =
      getExtentWidth(tileRangeExtent) / (this.tileWidth * tileRange.getWidth());
    const unitsPerPixelY =
      getExtentHeight(tileRangeExtent) /
      (this.tileHeight * tileRange.getHeight());

    const tileRangeTopLeft = getTopLeftExtent(tileRangeExtent);
    const extentTopLeft = getTopLeftExtent(extent);

    const windowX =
      Math.abs(tileRangeTopLeft[0] - extentTopLeft[0]) / unitsPerPixelX;
    const windowY =
      Math.abs(tileRangeTopLeft[1] - extentTopLeft[1]) / unitsPerPixelY;
    const windowWidth = getExtentWidth(extent) / unitsPerPixelX;
    const windowHeight = getExtentHeight(extent) / unitsPerPixelY;

    const windowCanvas = createEmptyCanvas(this.tileWidth, this.tileHeight);
    const windowCtx = windowCanvas.getContext('2d');

    if (windowCtx) {
      windowCtx.drawImage(
        canvas,
        windowX,
        windowY,
        windowWidth,
        windowHeight,
        0,
        0,
        this.tileWidth,
        this.tileHeight,
      );

      return windowCanvas;
    }

    return this._emptyCanvas;
  }

  requestImage(x: number, y: number, level: number): Promise<ImageryTypes> {
    return this._boundTileLoader(x, y, level);
  }
}
