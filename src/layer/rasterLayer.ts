import type { ImageryLayer } from '@vcmap-cesium/engine';
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
import type {
  LayerImplementationOptions,
  LayerOptions,
  SplitLayer,
} from './layer.js';
import Layer from './layer.js';
import VcsEvent from '../vcsEvent.js';
import Extent from '../util/extent.js';
import { layerClassRegistry } from '../classRegistry.js';
import type LayerImplementation from './layerImplementation.js';
import type VcsMap from '../map/vcsMap.js';

export type RasterLayerOptions = LayerOptions & {
  /**
   * minLevel of the datasource (if not specified, calculated from extent)
   * @default 0
   */
  minLevel?: number;
  /**
   * maxlevel the datasource can provide the data.
   * @default 18
   */
  maxLevel?: number;

  /**
   * configures the visible level in the rendered map. Maps to Openlayers `minZoom` and Cesium `minimiumTerrainLevel`
   */
  minRenderingLevel?: number;

  /**
   * configures the visible level in the rendered map. Maps to Openlayers `maxZoom` and Cesium `maximumTerrainLevel`
   */
  maxRenderingLevel?: number;

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

  /**
   * can be used to forward options to the cesium ImageryLayer
   * @see https://cesium.com/learn/cesiumjs/ref-doc/ImageryLayer.html#.ConstructorOptions
   */
  imageryLayerOptions?: ImageryLayer.ConstructorOptions;
};

export type RasterLayerImplementationOptions = LayerImplementationOptions & {
  minLevel: number;
  maxLevel: number;
  minRenderingLevel?: number;
  maxRenderingLevel?: number;
  tilingSchema: TilingScheme;
  opacity: number;
  extent?: Extent;
  splitDirection: SplitDirection;
  imageryLayerOptions?: ImageryLayer.ConstructorOptions;
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
      url: '',
      minLevel: 0,
      maxLevel: 18,
      minRenderingLevel: undefined,
      maxRenderingLevel: undefined,
      tilingSchema: TilingScheme.GEOGRAPHIC,
      opacity: 1,
      splitDirection: undefined,
      imageryLayerOptions: undefined,
    };
  }

  extent: Extent;

  /**
   * The {@link TilingScheme} of this layer
   * Changes require calling layer.redraw() to take effect.
   */
  tilingSchema: TilingScheme;

  /**
   * The maximum level to load.
   * Changes require calling layer.redraw() to take effect.
   */
  maxLevel: number;

  private _minLevel: number;

  /**
   * The minimum level to load.
   * Changes require calling layer.redraw() to take effect.
   */
  minLevel: number;

  /**
   * defines the visible level in the rendered map, maps to Openlayers `minZoom` and Cesium `minimiumTerrainLevel`.
   * Changes requires calling layer.redraw() to take effect.
   */
  minRenderingLevel: number | undefined;

  /**
   * defines the visible level in the rendered map, maps to Openlayers `minZoom` and Cesium `minimiumTerrainLevel`.
   * Changes requires calling layer.redraw() to take effect.
   */
  maxRenderingLevel: number | undefined;

  private _opacity: number;

  private _splitDirection: SplitDirection = SplitDirection.NONE;

  /**
   * can be used to forward options to the cesium ImageryLayer
   * @see https://cesium.com/learn/cesiumjs/ref-doc/ImageryLayer.html#.ConstructorOptions
   * Changes requires calling layer.redraw() to take effect.
   */
  imageryLayerOptions: ImageryLayer.ConstructorOptions | undefined;

  /**
   * raised if the split direction changes, is passed the split direction as its only argument
   */
  splitDirectionChanged = new VcsEvent<SplitDirection>();

  /**
   * @param  options
   */
  constructor(options: RasterLayerOptions) {
    const defaultOptions = RasterLayer.getDefaultOptions();
    super({ ...defaultOptions, ...options });
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

    this.minRenderingLevel = parseInteger(
      options.minRenderingLevel,
      defaultOptions.minRenderingLevel,
    );
    this.maxRenderingLevel = parseInteger(
      options.maxRenderingLevel,
      defaultOptions.maxRenderingLevel,
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

    this.imageryLayerOptions = structuredClone(options.imageryLayerOptions);
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
      minRenderingLevel: this.minRenderingLevel,
      maxRenderingLevel: this.maxRenderingLevel,
      tilingSchema: this.tilingSchema,
      opacity: this.opacity,
      splitDirection: this._splitDirection,
      imageryLayerOptions: this.imageryLayerOptions,
    };

    if (this.extent?.isValid()) {
      options.extent = this.extent;
    }
    return options;
  }

  toJSON(defaultOptions = RasterLayer.getDefaultOptions()): RasterLayerOptions {
    const config: RasterLayerOptions = super.toJSON(defaultOptions);

    if (this.extent?.equals(new Extent())) {
      delete config.extent;
    }

    if (this._minLevel !== defaultOptions.minLevel) {
      config.minLevel = this._minLevel;
    }

    if (this.maxLevel !== defaultOptions.maxLevel) {
      config.maxLevel = this.maxLevel;
    }

    if (this.minRenderingLevel !== defaultOptions.minRenderingLevel) {
      config.minRenderingLevel = this.minRenderingLevel;
    }

    if (this.maxRenderingLevel !== defaultOptions.maxRenderingLevel) {
      config.maxRenderingLevel = this.maxRenderingLevel;
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

    if (this.imageryLayerOptions !== defaultOptions.imageryLayerOptions) {
      config.imageryLayerOptions = structuredClone(this.imageryLayerOptions);
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
