import { unByKey } from 'ol/Observable.js';
import Feature from 'ol/Feature.js';
import { Point } from 'ol/geom.js';
import { StyleFunction, StyleLike } from 'ol/style/Style.js';
import { parseInteger } from '@vcsuite/parsers';
import { check, maybe } from '@vcsuite/check';
import VcsObject, { VcsObjectOptions } from '../vcsObject.js';
import VectorLayer from '../layer/vectorLayer.js';
import ClusterEnhancedVectorSource from '../ol/source/ClusterEnhancedVectorSource.js';
import FeatureVisibility, {
  synchronizeFeatureVisibility,
} from '../layer/featureVisibility.js';
import LayerState from '../layer/layerState.js';
import VectorClusterStyleItem, {
  VectorClusterStyleItemOptions,
  getDefaultClusterStyleItem,
} from './vectorClusterStyleItem.js';
import type VcsMap from '../map/vcsMap.js';
import GlobalHider from '../layer/globalHider.js';
import VectorProperties, {
  VectorPropertiesOptions,
} from '../layer/vectorProperties.js';
import CesiumMap from '../map/cesiumMap.js';
import VectorClusterGroupCesiumImpl from './vectorClusterGroupCesiumImpl.js';
import VectorClusterGroupOpenlayersImpl from './vectorClusterGroupOpenlayersImpl.js';
import OpenlayersMap from '../map/openlayersMap.js';
import type VectorClusterGroupImpl from './vectorClusterGroupImpl.js';
import ObliqueMap from '../map/obliqueMap.js';
import VectorClusterGroupObliqueImpl from './vectorClusterGroupObliqueImpl.js';
import { maxZIndex } from '../util/layerCollection.js';

export type VectorClusterGroupOptions = VcsObjectOptions & {
  style?: VectorClusterStyleItemOptions | VectorClusterStyleItem;
  highlightStyle?: VectorClusterStyleItemOptions | VectorClusterStyleItem;
  clusterDistance?: number;
  vectorProperties?: VectorPropertiesOptions;
  zIndex?: number;
};

export type VectorClusterGroupImplementationOptions = {
  name: string;
  source: ClusterEnhancedVectorSource;
  maxResolution?: number;
  minResolution?: number;
  globalHider?: GlobalHider;
  featureVisibility: FeatureVisibility;
  vectorProperties: VectorProperties;
  style: StyleFunction;
  clusterDistance: number;
  getLayerByName(this: void, layerName: string): VectorLayer | undefined;
};

function featureIsClusterable(
  feature: Feature | undefined,
  vectorProperties: VectorProperties,
): feature is Feature<Point> {
  if (feature) {
    const geometry = feature?.getGeometry();
    return (
      !!geometry &&
      geometry.getType() === 'Point' &&
      vectorProperties.renderAs(feature) === 'geometry'
    );
  }
  return false;
}

function getStyleOrDefaultStyle(
  styleOptions:
    | VectorClusterStyleItemOptions
    | VectorClusterStyleItem
    | undefined,
  defaultValue: VectorClusterStyleItem,
): VectorClusterStyleItem {
  if (styleOptions) {
    if (styleOptions instanceof VectorClusterStyleItem) {
      return styleOptions;
    } else {
      return new VectorClusterStyleItem(styleOptions);
    }
  }
  return defaultValue;
}

export default class VectorClusterGroup extends VcsObject {
  static get className(): string {
    return 'VectorClusterGroup';
  }

  static getDefaultOptions(): VectorClusterGroupOptions {
    return {
      type: 'VectorClusterGroup',
      name: '',
      style: undefined,
      highlightStyle: undefined,
      clusterDistance: 40,
      zIndex: Math.floor(maxZIndex / 2),
      vectorProperties: {
        ...VectorProperties.getDefaultOptions(),
        eyeOffset: [0, 0, -100],
        heightAboveGround: 60,
        altitudeMode: 'clampToTerrain',
      },
    };
  }

  private _layerListeners = new Map<VectorLayer, (() => void)[]>();

  private _activeSourceListeners = new Map<VectorLayer, () => void>();

  private _source = new ClusterEnhancedVectorSource({});

  private _featureVisibility = new FeatureVisibility();

  private _style: VectorClusterStyleItem;

  highlightStyle: VectorClusterStyleItem | undefined;

  private _styleFunction: StyleFunction;

  private _activeMaps = new Set<VcsMap>();

  private _implementations = new Map<
    VcsMap,
    VectorClusterGroupImpl<VcsMap> | undefined
  >();

  private _globalHider: GlobalHider | undefined;

  private _zIndex = maxZIndex - 1;

  vectorProperties: VectorProperties;

  clusterDistance: number;

  constructor(options: VectorClusterGroupOptions) {
    super(options);
    const defaultOptions = VectorClusterGroup.getDefaultOptions();

    this._style = getStyleOrDefaultStyle(
      options.style,
      getDefaultClusterStyleItem(),
    );

    if (options.highlightStyle) {
      this.highlightStyle =
        options.highlightStyle instanceof VectorClusterStyleItem
          ? options.highlightStyle
          : new VectorClusterStyleItem(options.highlightStyle);
    }

    this.clusterDistance = parseInteger(
      options.clusterDistance,
      defaultOptions.clusterDistance,
    );

    this.vectorProperties = new VectorProperties(
      options.vectorProperties ?? defaultOptions.vectorProperties!,
    );

    this._zIndex = parseInteger(options.zIndex, defaultOptions.zIndex);

    this._styleFunction = this._style.createStyleFunction((layerName) =>
      [...this._layerListeners.keys()].find((l) => l.name === layerName),
    );
  }

  get featureVisibility(): FeatureVisibility {
    return this._featureVisibility;
  }

  get style(): VectorClusterStyleItem {
    return this._style;
  }

  get styleFunction(): StyleFunction {
    return this._styleFunction;
  }

  get globalHider(): GlobalHider | undefined {
    return this._globalHider;
  }

  get zIndex(): number {
    return this._zIndex;
  }

  setStyle(
    style: VectorClusterStyleItem | VectorClusterStyleItemOptions,
  ): void {
    this._style = getStyleOrDefaultStyle(style, this._style);
    this._styleFunction = this._style.createStyleFunction((layerName) =>
      [...this._layerListeners.keys()].find((l) => l.name === layerName),
    );

    this._implementations.forEach((impl) => {
      if (impl) {
        impl.style = this._styleFunction;
      }
    });
    this._source
      .getFeatures()
      .filter((f) => !f.getStyle())
      .forEach((f) => f.changed());
  }

  getHighlightStyleForFeature(feature: Feature): StyleLike | void {
    if (this.highlightStyle) {
      return this.highlightStyle.createStyleFunction((layerName) =>
        [...this._layerListeners.keys()].find((l) => l.name === layerName),
      )(feature, 1);
    }
    return undefined;
  }

  addLayer(layer: VectorLayer): void {
    check(layer, VectorLayer);

    this._layerListeners.set(layer, [
      layer.stateChanged.addEventListener((state) => {
        if (state === LayerState.ACTIVE) {
          this._handleActivation(layer);
        } else if (state === LayerState.INACTIVE) {
          this._handleDeactivation(layer);
        }
      }),
      synchronizeFeatureVisibility(
        layer.featureVisibility,
        this._featureVisibility,
      ),
    ]);

    if (layer.active) {
      this._handleActivation(layer);
    }
  }

  removeLayer(layer: VectorLayer): void {
    this._handleDeactivation(layer);
    this._layerListeners.get(layer)?.forEach((cb) => cb());
    this._layerListeners.delete(layer);
  }

  getFeatures(): Feature[] {
    return this._source.getFeatures();
  }

  /**
   * destroys all current implementations and recreates the ones which have an active map.
   * called for instance when the URL for a layer changes
   */
  async forceRedraw(): Promise<void> {
    const maps = [...this._implementations.keys()];

    const promises = maps.map((map) => {
      this.removedFromMap(map);
      if (map.active) {
        return this.mapActivated(map);
      }
      return Promise.resolve();
    });
    await Promise.all(promises);
  }

  setGlobalHider(globalHider?: GlobalHider): void {
    check(globalHider, maybe(GlobalHider));
    this._globalHider = globalHider;
    this.forceRedraw().catch((_e) => {
      this.getLogger().error('Failed to redraw after setting global hider');
    });
  }

  private _handleActivation(layer: VectorLayer): void {
    if (!this._activeSourceListeners.has(layer)) {
      const source = layer.getSource();

      if (source.getState() === 'ready') {
        const features = source
          .getFeatures()
          .filter((f) => featureIsClusterable(f, layer.vectorProperties));

        this._source.addFeatures(features);
        const listeners = [
          source.on('addfeature', ({ feature }) => {
            if (featureIsClusterable(feature, layer.vectorProperties)) {
              this._source.addFeature(feature);
            }
          }),
          source.on('removefeature', ({ feature }) => {
            this._source.removeFeature(feature!);
          }),
        ];
        this._activeSourceListeners.set(layer, () => unByKey(listeners));
      } else {
        source.once('change', this._handleActivation.bind(this, layer));
      }
    }
  }

  private _handleDeactivation(layer: VectorLayer): void {
    if (this._activeSourceListeners.has(layer)) {
      const source = layer.getSource();
      source
        .getFeatures()
        .filter((f) => featureIsClusterable(f, layer.vectorProperties))
        .forEach((feat) => {
          this._source.removeFeature(feat, true);
        });
      this._source.changed();
      this._activeSourceListeners.get(layer)!();
      this._activeSourceListeners.delete(layer);
      // previous result item & last feature clicked handling
    }
  }

  // eslint-disable-next-line class-methods-use-this
  isSupported(map: VcsMap): boolean {
    return (
      map.className === 'OpenlayersMap' ||
      map.className === 'CesiumMap' ||
      map.className === 'ObliqueMap'
    );
  }

  getImplementationOptions(): VectorClusterGroupImplementationOptions {
    return {
      clusterDistance: this.clusterDistance,
      featureVisibility: this._featureVisibility,
      globalHider: this._globalHider,
      maxResolution: 0,
      minResolution: 0,
      name: this.name,
      source: this._source,
      style: this._styleFunction,
      vectorProperties: this.vectorProperties,
      getLayerByName: (layerName: string) =>
        [...this._layerListeners.keys()].find((l) => l.name === layerName),
    };
  }

  private _createImplementationForMap(
    map: VcsMap,
  ):
    | VectorClusterGroupCesiumImpl
    | VectorClusterGroupOpenlayersImpl
    | VectorClusterGroupObliqueImpl
    | undefined {
    if (map instanceof CesiumMap) {
      return new VectorClusterGroupCesiumImpl(
        map,
        this.getImplementationOptions(),
      );
    } else if (map instanceof OpenlayersMap) {
      return new VectorClusterGroupOpenlayersImpl(
        map,
        this.getImplementationOptions(),
      );
    } else if (map instanceof ObliqueMap) {
      return new VectorClusterGroupObliqueImpl(
        map,
        this.getImplementationOptions(),
      );
    }
    return undefined;
  }

  /**
   * creates or returns a cached array of cluster group implementations for the given map.
   * @param  map initialized Map
   * @returns  return the specific implementation
   */
  getImplementationForMap<T extends VcsMap>(
    map: T,
  ): VectorClusterGroupImpl<T> | undefined {
    if (!this._implementations.has(map)) {
      this._implementations.set(map, this._createImplementationForMap(map));
    }
    return this._implementations.get(map) as
      | VectorClusterGroupImpl<T>
      | undefined;
  }

  /**
   * Returns all implementation of this vector cluster group for all maps
   */
  getImplementations(): VectorClusterGroupImpl<any>[] {
    return [...this._implementations.values()].flat().filter((i) => !!i);
  }

  /**
   * is called from the map when the map is activated and this vector cluster group belongs to the maps layer collections vector cluster group collection.
   * Will create an implementation if it does not exists and will forward the activation call to the implementation.
   * @param  map
   */
  async mapActivated(map: VcsMap): Promise<void> {
    this._activeMaps.add(map);
    await this._activateImplsForMap(map);
  }

  /**
   * is called from the map when the map is deactivated, and this vector cluster group belongs to the maps layer collections vector cluster group collection.
   * will forward deactivation call to the map specific implementation
   * @param  map
   */
  mapDeactivated(map: VcsMap): void {
    this._activeMaps.delete(map);
    const impl = this.getImplementationForMap(map);
    impl?.deactivate();
  }

  /**
   * is called when a vector cluster group is removed from a maps layer collections vector cluster group collection or said map is destroyed.
   * destroys the associated implementation.
   * @param  map
   */
  removedFromMap(map: VcsMap): void {
    this._activeMaps.delete(map);
    const impl = this.getImplementationForMap(map);
    impl?.destroy();
    this._implementations.delete(map);
  }

  private async _activateImplsForMap(map: VcsMap): Promise<void> {
    const impl = this.getImplementationForMap(map);
    if (impl) {
      try {
        await impl.activate();
      } catch (err) {
        this.getLogger().error(
          `Layer ${this.name} could not activate impl for map ${map.name}`,
        );
        this.getLogger().error(String(err));
        this._implementations.set(map, undefined);
        impl.destroy();
      }
    }
  }

  toJSON(): VectorClusterGroupOptions {
    const config: Partial<VectorClusterGroupOptions> = super.toJSON();
    const defaultOptions = VectorClusterGroup.getDefaultOptions();

    if (!this.style.equals(new VectorClusterStyleItem({}))) {
      config.style = this.style.toJSON();
      delete config.style.name;
      delete config.style.type;
    }

    if (this.highlightStyle) {
      config.highlightStyle = this.highlightStyle.toJSON();
      delete config.highlightStyle.name;
      delete config.highlightStyle.type;
    }

    if (this.clusterDistance !== defaultOptions.clusterDistance) {
      config.clusterDistance = this.clusterDistance;
    }

    const vectorProperties = this.vectorProperties.getVcsMeta(
      defaultOptions.vectorProperties,
    );

    if (Object.keys(vectorProperties).length > 0) {
      config.vectorProperties = vectorProperties;
    }

    return config;
  }

  destroy(): void {
    this._featureVisibility.destroy();
    [...this._layerListeners.values()].forEach((arr) =>
      arr.forEach((cb) => cb()),
    );
    this._layerListeners.clear();
    super.destroy();
  }
}
