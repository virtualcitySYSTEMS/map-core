import { ImageryLayer, SplitDirection } from '@vcmap-cesium/engine';

import { parseInteger, parseNumberRange } from '@vcsuite/parsers';
import Layer, { type LayerOptions, SplitLayer } from './layer.js';
import OpenlayersMap from '../map/openlayersMap.js';
import CesiumMap from '../map/cesiumMap.js';
import OpenStreetMapOpenlayersImpl from './openlayers/openStreetMapOpenlayersImpl.js';
import OpenStreetMapCesiumImpl from './cesium/openStreetMapCesiumImpl.js';
import VcsEvent from '../vcsEvent.js';
import { layerClassRegistry } from '../classRegistry.js';
import {
  RasterLayerImplementationOptions,
  TilingScheme,
} from './rasterLayer.js';
import VcsMap from '../map/vcsMap.js';

export type OpenStreetMapOptions = LayerOptions & {
  /**
   * either 'left' or 'right', if omitted none is applied
   */
  splitDirection?: string;
  /**
   * opacity between 0 and 1
   * @default 1
   */
  opacity?: number;
  /**
   * max level to load tiles at
   * @default 19
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

  /**
   * can be used to forward options to the cesium ImageryLayer
   * @see https://cesium.com/learn/cesiumjs/ref-doc/ImageryLayer.html#.ConstructorOptions
   */
  imageryLayerOptions?: ImageryLayer.ConstructorOptions;
};

/**
 * @group Layer
 */
class OpenStreetMapLayer
  extends Layer<OpenStreetMapCesiumImpl | OpenStreetMapOpenlayersImpl>
  implements SplitLayer
{
  static get className(): string {
    return 'OpenStreetMapLayer';
  }

  static getDefaultOptions(): OpenStreetMapOptions {
    return {
      ...Layer.getDefaultOptions(),
      splitDirection: undefined,
      opacity: 1,
      maxLevel: 19,
      minRenderingLevel: undefined,
      maxRenderingLevel: undefined,
    };
  }

  private _splitDirection: SplitDirection;

  private _opacity: number;

  /**
   * raised if the split direction changes, is passed the split direction as its only argument
   */
  splitDirectionChanged: VcsEvent<SplitDirection> = new VcsEvent();

  /**
   * The maximum level to load.
   * Changes requires calling layer.redraw() to take effect.
   */
  maxLevel: number;

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

  /**
   * can be used to forward options to the cesium ImageryLayer
   * @see https://cesium.com/learn/cesiumjs/ref-doc/ImageryLayer.html#.ConstructorOptions
   * Changes requires calling layer.redraw() to take effect.
   */
  imageryLayerOptions: ImageryLayer.ConstructorOptions | undefined;

  protected _supportedMaps = [CesiumMap.className, OpenlayersMap.className];

  constructor(options: OpenStreetMapOptions) {
    super(options);
    const defaultOptions = OpenStreetMapLayer.getDefaultOptions();
    this._splitDirection = SplitDirection.NONE;

    if (options.splitDirection) {
      this._splitDirection =
        options.splitDirection === 'left'
          ? SplitDirection.LEFT
          : SplitDirection.RIGHT;
    }

    this._opacity = parseNumberRange(
      options.opacity,
      defaultOptions.opacity as number,
      0.0,
      1.0,
    );
    this.maxLevel = parseInteger(options.maxLevel, defaultOptions.maxLevel);
    this.minRenderingLevel = parseInteger(
      options.minRenderingLevel,
      defaultOptions.minRenderingLevel,
    );
    this.maxRenderingLevel = parseInteger(
      options.maxRenderingLevel,
      defaultOptions.maxRenderingLevel,
    );
    this.imageryLayerOptions = structuredClone(options.imageryLayerOptions);
  }

  get splitDirection(): SplitDirection {
    return this._splitDirection;
  }

  set splitDirection(direction: SplitDirection) {
    if (direction !== this._splitDirection) {
      this._splitDirection = direction;
      this.getImplementations().forEach((impl) => {
        impl.updateSplitDirection(this._splitDirection);
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
    return {
      ...super.getImplementationOptions(),
      opacity: this.opacity,
      splitDirection: this.splitDirection,
      minLevel: 0,
      maxLevel: this.maxLevel,
      minRenderingLevel: this.minRenderingLevel,
      maxRenderingLevel: this.maxRenderingLevel,
      tilingSchema: TilingScheme.GEOGRAPHIC,
      imageryLayerOptions: this.imageryLayerOptions,
    };
  }

  createImplementationsForMap(
    map: VcsMap,
  ): (OpenStreetMapOpenlayersImpl | OpenStreetMapCesiumImpl)[] {
    if (map instanceof OpenlayersMap) {
      return [
        new OpenStreetMapOpenlayersImpl(map, this.getImplementationOptions()),
      ];
    }

    if (map instanceof CesiumMap) {
      return [
        new OpenStreetMapCesiumImpl(map, this.getImplementationOptions()),
      ];
    }
    return [];
  }

  toJSON(): OpenStreetMapOptions {
    const config: OpenStreetMapOptions = super.toJSON();
    const defaultOptions = OpenStreetMapLayer.getDefaultOptions();

    if (this._splitDirection !== SplitDirection.NONE) {
      config.splitDirection =
        this._splitDirection === SplitDirection.RIGHT ? 'right' : 'left';
    }

    if (this.opacity !== defaultOptions.opacity) {
      config.opacity = this.opacity;
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

layerClassRegistry.registerClass(
  OpenStreetMapLayer.className,
  OpenStreetMapLayer,
);
export default OpenStreetMapLayer;
