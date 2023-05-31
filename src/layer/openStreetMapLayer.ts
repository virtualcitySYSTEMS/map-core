import { SplitDirection } from '@vcmap-cesium/engine';

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
};

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
    };
  }

  private _splitDirection: SplitDirection;

  private _opacity: number;

  /**
   * raised if the split direction changes, is passed the split direction as its only argument
   */
  splitDirectionChanged: VcsEvent<SplitDirection> = new VcsEvent();

  /**
   * The maximum level to load. Changing requires a redraw to take effect.
   */
  maxLevel: number;

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
      tilingSchema: TilingScheme.GEOGRAPHIC,
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

layerClassRegistry.registerClass(
  OpenStreetMapLayer.className,
  OpenStreetMapLayer,
);
export default OpenStreetMapLayer;
