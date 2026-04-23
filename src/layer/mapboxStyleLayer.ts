import { SplitDirection } from '@vcmap-cesium/engine';
import { parseInteger } from '@vcsuite/parsers';
import { is } from '@vcsuite/check';
import type LayerGroup from 'ol/layer/Group.js';
import { layerClassRegistry } from '../classRegistry.js';
import AbstractAttributeProvider from '../featureProvider/abstractAttributeProvider.js';
import CompositeFeatureProvider, {
  type CompositeFeatureProviderOptions,
} from '../featureProvider/compositeFeatureProvider.js';
import MapboxFeatureProvider, {
  type MapboxFeatureProviderOptions,
} from '../featureProvider/mapboxFeatureProvider.js';
import type VcsMap from '../map/vcsMap.js';
import BaseCesiumMap from '../map/baseCesiumMap.js';
import CesiumMap from '../map/cesiumMap.js';
import ObliqueMap from '../map/obliqueMap.js';
import OpenlayersMap from '../map/openlayersMap.js';
import PanoramaMap from '../map/panoramaMap.js';
import VcsEvent from '../vcsEvent.js';
import MapboxVectorRasterTileCesiumImpl, {
  type MapboxStyleLayerImplementationOptions,
} from './cesium/mapboxStyleCesiumImpl.js';
import Layer from './layer.js';
import type { LayerOptions, SplitLayer } from './layer.js';
import type LayerImplementation from './layerImplementation.js';
import { createStyledMapboxLayerGroup } from './mapboxStyleLayerHelpers.js';
import MapboxVectorTileOpenlayersImpl from './openlayers/mapboxStyleOpenlayersImpl.js';

export type MapboxStyleOptions = LayerOptions & {
  /** The sources from the Mapbox Style to use. If not provided, all sources from the style will be used. */
  sources?: string[];
  /** The Mapbox layers to exclude from picking. */
  excludeLayerFromPicking?: string[];
  /** either 'left' or 'right', none if omitted */
  splitDirection?: string;
  /** configures the visible level in the rendered map. Maps to Openlayers `minZoom` and Cesium `minimiumTerrainLevel` */
  minRenderingLevel?: number;
  /** configures the visible level in the rendered map. Maps to Openlayers `maxZoom` and Cesium `maximumTerrainLevel` */
  maxRenderingLevel?: number;
};

export interface MaboxStyleImplementation extends LayerImplementation<VcsMap> {
  updateSplitDirection(direction: SplitDirection): void;
}

/**
 * Layer class for Mapbox Style layers.
 * @group Layer
 */
class MapboxStyleLayer
  extends Layer<MaboxStyleImplementation>
  implements SplitLayer
{
  static get className(): string {
    return 'MapboxStyleLayer';
  }

  static getDefaultOptions(): MapboxStyleOptions {
    return {
      ...Layer.getDefaultOptions(),
      minRenderingLevel: undefined,
      maxRenderingLevel: undefined,
    };
  }

  protected _supportedMaps = [
    CesiumMap.className,
    ObliqueMap.className,
    OpenlayersMap.className,
    PanoramaMap.className,
  ];
  private _sources?: string[];
  private _excludeLayerFromPicking?: string[];
  private _splitDirection: SplitDirection = SplitDirection.NONE;
  private _boundCreateStyledLayerGroup: () => Promise<LayerGroup>;
  splitDirectionChanged = new VcsEvent<SplitDirection>();
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

  constructor(options: MapboxStyleOptions) {
    const defaultOptions = MapboxStyleLayer.getDefaultOptions();
    super({ ...defaultOptions, ...options });

    this._sources = options.sources;
    this._excludeLayerFromPicking = options.excludeLayerFromPicking;
    if (options.splitDirection) {
      this._splitDirection =
        options.splitDirection === 'left'
          ? SplitDirection.LEFT
          : SplitDirection.RIGHT;
    }
    this.minRenderingLevel = parseInteger(
      options.minRenderingLevel,
      defaultOptions.minRenderingLevel,
    );
    this.maxRenderingLevel = parseInteger(
      options.maxRenderingLevel,
      defaultOptions.maxRenderingLevel,
    );
    this._boundCreateStyledLayerGroup = this._createStyledLayerGroup.bind(this);
  }

  private _createStyledLayerGroup(): Promise<LayerGroup> {
    return createStyledMapboxLayerGroup({
      url: this.url,
      name: this.name,
      allowPicking: this.allowPicking,
      sources: this._sources,
      minRenderingLevel: this.minRenderingLevel,
      maxRenderingLevel: this.maxRenderingLevel,
    });
  }

  async initialize(): Promise<void> {
    if (!this.featureProvider) {
      this.featureProvider = new MapboxFeatureProvider({
        createStyledLayerGroup: this._boundCreateStyledLayerGroup,
        excludeLayerFromPicking: this._excludeLayerFromPicking,
      });
    } else if (is(this.featureProvider, AbstractAttributeProvider)) {
      this.featureProvider = new CompositeFeatureProvider({
        attributeProviders: [this.featureProvider],
        featureProviders: [
          new MapboxFeatureProvider({
            createStyledLayerGroup: this._boundCreateStyledLayerGroup,
            excludeLayerFromPicking: this._excludeLayerFromPicking,
          }),
        ],
      });
    }

    await super.initialize();
  }

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

  getImplementationOptions(): MapboxStyleLayerImplementationOptions {
    return {
      ...super.getImplementationOptions(),
      createStyledLayerGroup: this._boundCreateStyledLayerGroup,
      splitDirection: this._splitDirection,
      minRenderingLevel: this.minRenderingLevel,
      maxRenderingLevel: this.maxRenderingLevel,
    };
  }

  createImplementationsForMap(map: VcsMap): MaboxStyleImplementation[] {
    if (map instanceof BaseCesiumMap) {
      return [
        new MapboxVectorRasterTileCesiumImpl(
          map,
          this.getImplementationOptions(),
        ),
      ];
    }

    if (map instanceof OpenlayersMap) {
      return [
        new MapboxVectorTileOpenlayersImpl(
          map,
          this.getImplementationOptions(),
        ),
      ];
    }
    return super.createImplementationsForMap(map);
  }

  toJSON(
    defaultOptions = MapboxStyleLayer.getDefaultOptions(),
  ): MapboxStyleOptions {
    const config: MapboxStyleOptions = { ...super.toJSON() };

    if (
      (config.featureProvider as MapboxFeatureProviderOptions)?.type ===
      MapboxFeatureProvider.className
    ) {
      delete config.featureProvider;
    } else if (
      (config.featureProvider as CompositeFeatureProviderOptions)?.type ===
      CompositeFeatureProvider.className
    ) {
      const compositeConfig =
        config.featureProvider as CompositeFeatureProviderOptions;
      const featureProviders = (compositeConfig.featureProviders || []).filter(
        (providerConfig) =>
          (providerConfig as MapboxFeatureProviderOptions).type !==
          MapboxFeatureProvider.className,
      );
      const attributeProviders = compositeConfig.attributeProviders || [];

      if (featureProviders.length === 0 && attributeProviders.length === 0) {
        delete config.featureProvider;
      } else if (
        featureProviders.length === 0 &&
        attributeProviders.length === 1
      ) {
        config.featureProvider =
          attributeProviders[0] as AbstractAttributeProvider;
      } else {
        const filteredComposite: CompositeFeatureProviderOptions = {
          ...compositeConfig,
          featureProviders,
          attributeProviders,
        };
        config.featureProvider = filteredComposite;
      }
    }

    if (this._sources && this._sources.length > 0) {
      config.sources = this._sources.slice();
    }

    if (
      this._excludeLayerFromPicking &&
      this._excludeLayerFromPicking.length > 0
    ) {
      config.excludeLayerFromPicking = this._excludeLayerFromPicking.slice();
    }

    if (this._splitDirection !== SplitDirection.NONE) {
      config.splitDirection =
        this._splitDirection === SplitDirection.LEFT ? 'left' : 'right';
    }

    if (this.minRenderingLevel !== defaultOptions.minRenderingLevel) {
      config.minRenderingLevel = this.minRenderingLevel;
    }

    if (this.maxRenderingLevel !== defaultOptions.maxRenderingLevel) {
      config.maxRenderingLevel = this.maxRenderingLevel;
    }

    return config;
  }

  destroy(): void {
    this.splitDirectionChanged.destroy();
    this.featureProvider?.destroy();
    super.destroy();
  }
}

layerClassRegistry.registerClass(MapboxStyleLayer.className, MapboxStyleLayer);
export default MapboxStyleLayer;
