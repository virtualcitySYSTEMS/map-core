import {
  Event as CesiumEvent,
  type ImageryTypes,
  type Rectangle,
  type TilingScheme,
} from '@vcmap-cesium/engine';
import type { Size } from 'ol/size.js';

export type AbstractVcsImageryProviderOptions = {
  tilingScheme: TilingScheme;
  tileSize: Size;
  minLevel: number;
  maxLevel: number;
  headers?: Record<string, string>;
};

export default abstract class AbstractVcsImageryProvider {
  protected _tilingScheme: TilingScheme;

  private _tileSize: Size;

  private _errorEvent = new CesiumEvent();

  headers?: Record<string, string>;

  emptyCanvas: HTMLCanvasElement;

  minLevel: number;

  maxLevel: number;

  // eslint-disable-next-line @typescript-eslint/naming-convention
  _reload: undefined | (() => void) = undefined;

  constructor(options: AbstractVcsImageryProviderOptions) {
    this._tilingScheme = options.tilingScheme;
    this._tileSize = options.tileSize;
    this.minLevel = options.minLevel;
    this.maxLevel = options.maxLevel;
    this._errorEvent = new CesiumEvent();

    this.emptyCanvas = document.createElement('canvas');
    this.emptyCanvas.width = this.tileWidth;
    this.emptyCanvas.height = this.tileHeight;
    this.headers = options.headers;
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

  get tileWidth(): number {
    return this._tileSize[0];
  }

  get tileHeight(): number {
    return this._tileSize[1];
  }

  get maximumLevel(): number {
    return this.maxLevel;
  }

  get minimumLevel(): number {
    return this.minLevel;
  }

  get tilingScheme(): TilingScheme {
    return this._tilingScheme;
  }

  // eslint-disable-next-line class-methods-use-this
  get tileDiscardPolicy(): undefined {
    return undefined;
  }

  get errorEvent(): CesiumEvent {
    return this._errorEvent;
  }

  // eslint-disable-next-line class-methods-use-this
  get credit(): undefined {
    return undefined;
  }

  // eslint-disable-next-line class-methods-use-this
  get proxy(): undefined {
    return undefined;
  }

  // eslint-disable-next-line class-methods-use-this
  get hasAlphaChannel(): boolean {
    return true;
  }

  /**
   * Requests the image for a given tile.  This function should
   * not be called before  returns true.
   *
   * @param  x The tile X coordinate.
   * @param  y The tile Y coordinate.
   * @param  level The tile level.
   * @returns  A promise for the image that will resolve when the image is available, or
   *          undefined if there are too many active requests to the server, and the request
   *          should be retried later.  The resolved image may be either an
   *          Image or a Canvas DOM object.
   */
  abstract requestImage(
    x: number,
    y: number,
    level: number,
  ): Promise<ImageryTypes> | undefined;

  // eslint-disable-next-line class-methods-use-this
  destroy(): void {}
}
