import { SplitDirection } from '@vcmap-cesium/engine';
import { parseInteger } from '@vcsuite/parsers';
import { is } from '@vcsuite/check';
import Collection from 'ol/Collection.js';
import LayerGroup from 'ol/layer/Group.js';
import type BaseLayer from 'ol/layer/Base.js';
import { apply } from 'ol-mapbox-style';
import { layerClassRegistry } from '../classRegistry.js';
import AbstractAttributeProvider from '../featureProvider/abstractAttributeProvider.js';
import CompositeFeatureProvider from '../featureProvider/compositeFeatureProvider.js';
import MapboxFeatureProvider from '../featureProvider/mapboxFeatureProvider.js';
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
import MapboxVectorTileOpenlayersImpl from './openlayers/mapboxStyleOpenlayersImpl.js';
import { allowPicking, vcsLayerName } from './layerSymbols.js';

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
  private _mapboxLayerGroup: LayerGroup;
  private _sources?: string[];
  private _excludeLayerFromPicking?: string[];
  private _splitDirection: SplitDirection = SplitDirection.NONE;
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

    this._mapboxLayerGroup = new LayerGroup({
      minZoom: this.minRenderingLevel,
      maxZoom: this.maxRenderingLevel,
    });
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      await apply(this._mapboxLayerGroup, this.url);

      const layers = this._mapboxLayerGroup.getLayersArray();
      layers.forEach((layer) => {
        layer[vcsLayerName] = this.name;
        layer[allowPicking] = super.allowPicking;
      });

      if (this._sources && this._sources.length > 0) {
        const filteredCollection = new Collection<BaseLayer>();
        layers
          .filter((layer) =>
            this._sources!.includes(layer.get('mapbox-source') as string),
          )
          .forEach((layer) => {
            filteredCollection.push(layer);
          });

        this._mapboxLayerGroup.setLayers(filteredCollection);
      }
    }

    if (!this.featureProvider) {
      this.featureProvider = new MapboxFeatureProvider({
        styledMapboxLayerGroup: this._mapboxLayerGroup,
        excludeLayerFromPicking: this._excludeLayerFromPicking,
      });
    } else if (is(this.featureProvider, AbstractAttributeProvider)) {
      this.featureProvider = new CompositeFeatureProvider({
        attributeProviders: [this.featureProvider],
        featureProviders: [
          new MapboxFeatureProvider({
            styledMapboxLayerGroup: this._mapboxLayerGroup,
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
      styledMapboxLayerGroup: this._mapboxLayerGroup,
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
    this._mapboxLayerGroup.dispose();
    this.featureProvider?.destroy();
    super.destroy();
  }
}

layerClassRegistry.registerClass(MapboxStyleLayer.className, MapboxStyleLayer);
export default MapboxStyleLayer;
