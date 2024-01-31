import {
  SplitDirection,
  WebMercatorTilingScheme,
  GeographicTilingScheme,
  Cartographic,
} from '@vcmap-cesium/engine';
import {
  getBottomLeft,
  getBottomRight,
  getTopLeft,
  getTopRight,
} from 'ol/extent.js';

import {
  parseInteger,
  parseNumberRange,
  parseEnumValue,
} from '@vcsuite/parsers';
import { wgs84Projection } from '../util/projection.js';
import Layer, {
  LayerImplementationOptions,
  LayerOptions,
  SplitLayer,
} from './layer.js';
import VcsEvent from '../vcsEvent.js';
import Extent from '../util/extent.js';
import { layerClassRegistry } from '../classRegistry.js';
import LayerImplementation from './layerImplementation.js';
import VcsMap from '../map/vcsMap.js';

export type RasterLayerOptions = LayerOptions & {
  /**
   * minLevel to show (if not specified, calculated from extent)
   * @default 0
   */
  minLevel?: number;
  /**
   * maxLevel to show
   * @default 18
   */
  maxLevel?: number;
  tilingSchema?: TilingScheme;
  /**
   * opacity between 0 and 1
   * @default 1
   */
  opacity?: number;
  /**
   * either 'left' or 'right', none if omitted
   */
  splitDirection?: string;
};

export type RasterLayerImplementationOptions = LayerImplementationOptions & {
  minLevel: number;
  maxLevel: number;
  tilingSchema: TilingScheme;
  opacity: number;
  extent?: Extent;
  splitDirection: SplitDirection;
};

export interface RasterLayerImplementation {
  updateOpacity(opacity: number): void;
  updateSplitDirection(splitDirection: SplitDirection): void;
}

export enum TilingScheme {
  GEOGRAPHIC = 'geographic',
  MERCATOR = 'mercator',
}

export type TilingSchemeOptions = {
  numberOfLevelZeroTilesX?: number;
  numberOfLevelZeroTilesY?: number;
};

/**
 * Gets the tiling scheme associated with this layerConfig
 * @param  layerOptions
 */
export function getTilingScheme(
  layerOptions: RasterLayerOptions & TilingSchemeOptions,
): WebMercatorTilingScheme | GeographicTilingScheme {
  const tilingSchemeOptions: TilingSchemeOptions = {};
  if (
    layerOptions.numberOfLevelZeroTilesX &&
    layerOptions.numberOfLevelZeroTilesX > 1
  ) {
    tilingSchemeOptions.numberOfLevelZeroTilesX =
      layerOptions.numberOfLevelZeroTilesX;
  }
  if (
    layerOptions.numberOfLevelZeroTilesY &&
    layerOptions.numberOfLevelZeroTilesY > 1
  ) {
    tilingSchemeOptions.numberOfLevelZeroTilesY =
      layerOptions.numberOfLevelZeroTilesY;
  }
  if (layerOptions.tilingSchema === TilingScheme.MERCATOR) {
    return new WebMercatorTilingScheme(tilingSchemeOptions);
  }
  return new GeographicTilingScheme(tilingSchemeOptions);
}

export function calculateMinLevel(
  extent: Extent,
  tilingScheme: GeographicTilingScheme | WebMercatorTilingScheme,
  maxLevel: number,
  minLevel = 0,
): number {
  if (!extent.isValid()) {
    return minLevel;
  }
  const wgs84Extent = extent.getCoordinatesInProjection(wgs84Projection);
  if (wgs84Extent[1] < -85) {
    wgs84Extent[1] = -85;
  }
  if (wgs84Extent[3] > 85) {
    wgs84Extent[3] = 85;
  }
  const olCoords = [
    getBottomLeft(wgs84Extent),
    getBottomRight(wgs84Extent),
    getTopRight(wgs84Extent),
    getTopLeft(wgs84Extent),
  ];
  const extentCoords = olCoords.map((coord) =>
    Cartographic.fromDegrees(coord[0], coord[1]),
  );
  let usedMinLevel: number = minLevel;
  while (usedMinLevel < maxLevel) {
    // eslint-disable-next-line @typescript-eslint/no-loop-func
    const tileCoords = extentCoords.map((position) =>
      tilingScheme.positionToTileXY(position, usedMinLevel),
    );
    const distances = [];
    distances.push(Math.abs(tileCoords[0].x - tileCoords[1].x));
    distances.push(Math.abs(tileCoords[0].y - tileCoords[3].y));
    if (distances[0] > 1 || distances[1] > 1) {
      usedMinLevel -= 1;
      break;
    }
    usedMinLevel += 1;
  }
  return usedMinLevel;
}

/**
 * This abstract class allows for automatic loading scheme determination
 * for raster layers
 * @group Layer
 */
class RasterLayer<
    I extends LayerImplementation<VcsMap> & RasterLayerImplementation,
  >
  extends Layer<I>
  implements SplitLayer
{
  static get className(): string {
    return 'RasterLayer';
  }

  static getDefaultOptions(): RasterLayerOptions {
    return {
      ...Layer.getDefaultOptions(),
      minLevel: 0,
      maxLevel: 18,
      tilingSchema: TilingScheme.GEOGRAPHIC,
      opacity: 1,
      splitDirection: undefined,
    };
  }

  extent: Extent;

  /**
   * The {@link TilingScheme} of this layer
   */
  tilingSchema: TilingScheme;

  maxLevel: number;

  private _minLevel: number;

  minLevel: number;

  private _opacity: number;

  private _splitDirection: SplitDirection = SplitDirection.NONE;

  /**
   * raised if the split direction changes, is passed the split direction as its only argument
   */
  splitDirectionChanged: VcsEvent<SplitDirection> = new VcsEvent();

  /**
   * @param  options
   */
  constructor(options: RasterLayerOptions) {
    super({ url: '', ...options });
    const defaultOptions = RasterLayer.getDefaultOptions();
    this.extent = options.extent ? new Extent(options.extent) : new Extent();
    this.tilingSchema = parseEnumValue(
      options.tilingSchema,
      TilingScheme,
      defaultOptions.tilingSchema as TilingScheme,
    );
    this.maxLevel = parseInteger(options.maxLevel, defaultOptions.maxLevel);
    this._minLevel = parseInteger(options.minLevel, defaultOptions.minLevel);

    const cesiumTilingScheme = getTilingScheme(options);
    this.minLevel = calculateMinLevel(
      this.extent,
      cesiumTilingScheme,
      this.maxLevel,
      this._minLevel,
    );
    this._opacity = parseNumberRange(
      options.opacity,
      defaultOptions.opacity as number,
      0.0,
      1.0,
    );

    if (options.splitDirection) {
      this._splitDirection =
        options.splitDirection === 'left'
          ? SplitDirection.LEFT
          : SplitDirection.RIGHT;
    }
  }

  /**
   * The split directions of this layer
   */
  get splitDirection(): SplitDirection {
    return this._splitDirection;
  }

  set splitDirection(direction: SplitDirection) {
    if (direction !== this._splitDirection) {
      this._splitDirection = direction;
      this.getImplementations().forEach((impl) => {
        impl.updateSplitDirection(direction);
      });
      this.splitDirectionChanged.raiseEvent(this._splitDirection);
    }
  }

  /**
   * The opacity between 0 (fully transparent) and 1 (fully opaque)
   */
  get opacity(): number {
    return this._opacity;
  }

  set opacity(opacity: number) {
    const parsedValue = parseNumberRange(opacity, this._opacity, 0, 1);
    if (this._opacity !== parsedValue) {
      this._opacity = parsedValue;
      this.getImplementations().forEach((impl) => {
        impl.updateOpacity(parsedValue);
      });
    }
  }

  getImplementationOptions(): RasterLayerImplementationOptions {
    const options: RasterLayerImplementationOptions = {
      ...super.getImplementationOptions(),
      minLevel: this.minLevel,
      maxLevel: this.maxLevel,
      tilingSchema: this.tilingSchema,
      opacity: this.opacity,
      splitDirection: this._splitDirection,
    };

    if (this.extent?.isValid()) {
      options.extent = this.extent;
    }
    return options;
  }

  toJSON(): RasterLayerOptions {
    const config: RasterLayerOptions = super.toJSON();
    const defaultOptions = RasterLayer.getDefaultOptions();

    if (this.extent?.equals(new Extent())) {
      delete config.extent;
    }

    if (this._minLevel !== defaultOptions.minLevel) {
      config.minLevel = this._minLevel;
    }

    if (this.maxLevel !== defaultOptions.maxLevel) {
      config.maxLevel = this.maxLevel;
    }

    if (this.tilingSchema !== defaultOptions.tilingSchema) {
      config.tilingSchema = this.tilingSchema;
    }

    if (this.opacity !== defaultOptions.opacity) {
      config.opacity = this.opacity;
    }

    if (this._splitDirection !== SplitDirection.NONE) {
      config.splitDirection =
        this._splitDirection === SplitDirection.RIGHT ? 'right' : 'left';
    }

    return config;
  }

  destroy(): void {
    this.splitDirectionChanged.destroy();
    super.destroy();
  }
}

layerClassRegistry.registerClass(RasterLayer.className, RasterLayer);
export default RasterLayer;
