import VectorSource from 'ol/source/Vector.js';
import Style, { type StyleFunction } from 'ol/style/Style.js';
import Feature from 'ol/Feature.js';

import { v4 as uuidv4 } from 'uuid';
import { check, oneOf } from '@vcsuite/check';
import { parseBoolean } from '@vcsuite/parsers';
import type { ProjectionOptions } from '../util/projection.js';
import Projection, {
  getDefaultProjection,
  mercatorProjection,
} from '../util/projection.js';
import type { SplitLayer } from './layer.js';
import Layer from './layer.js';
import type { VectorStyleItemOptions } from '../style/vectorStyleItem.js';
import VectorStyleItem, {
  defaultVectorStyle,
  vectorStyleSymbol,
} from '../style/vectorStyleItem.js';
import type { DeclarativeStyleItemOptions } from '../style/declarativeStyleItem.js';
import DeclarativeStyleItem from '../style/declarativeStyleItem.js';
import writeStyle from '../style/writeStyle.js';
import { alreadyTransformedToMercator } from './vectorSymbols.js';
import Extent from '../util/extent.js';
import type { VcsMeta, VectorPropertiesOptions } from './vectorProperties.js';
import VectorProperties, { vcsMetaVersion } from './vectorProperties.js';
import type {
  FeatureLayerImplementationOptions,
  FeatureLayerOptions,
} from './featureLayer.js';
import FeatureLayer from './featureLayer.js';
import OpenlayersMap from '../map/openlayersMap.js';
import VectorOpenlayersImpl from './openlayers/vectorOpenlayersImpl.js';
import VectorCesiumImpl from './cesium/vectorCesiumImpl.js';
import VectorObliqueImpl from './oblique/vectorObliqueImpl.js';
import ObliqueMap from '../map/obliqueMap.js';
import CesiumMap from '../map/cesiumMap.js';
import { originalStyle, updateOriginalStyle } from './featureVisibility.js';
import type { StyleItemOptions } from '../style/styleItem.js';
import StyleItem from '../style/styleItem.js';
import { layerClassRegistry } from '../classRegistry.js';

import type VcsMap from '../map/vcsMap.js';
import type { GeoJSONwriteOptions } from './geojsonHelpers.js';
import { vcsLayerName } from './layerSymbols.js';
import type CesiumTilesetCesiumImpl from './cesium/cesiumTilesetCesiumImpl.js';
import VcsEvent from '../vcsEvent.js';
import PanoramaMap from '../map/panoramaMap.js';
import VectorPanoramaImpl from './panorama/vectorPanoramaImpl.js';

export type VectorOptions = FeatureLayerOptions & {
  /**
   * if not specified, the framework projection is taken
   */
  projection?: ProjectionOptions;
  maxResolution?: number;
  minResolution?: number;
  dontUseTerrainForOblique?: boolean;
  zIndex?: number;
  highlightStyle?: VectorStyleItemOptions | VectorStyleItem;
  /**
   * if true, the cesium synchronizers are destroyed on map change
   */
  isDynamic?: boolean;
  vectorProperties?: VectorPropertiesOptions;
  vectorClusterGroup?: string;
};

export type VectorImplementationOptions = FeatureLayerImplementationOptions & {
  source: VectorSource;
  maxResolution?: number;
  minResolution?: number;
  vectorProperties: VectorProperties;
};

/**
 * the vector layer is the standard layer to display vector features on the map. mostly, a specialization
 * is used to load data from a certain source, e.g. GeoJSONLayer, FlatGeobufLayer, etc. But it can also
 * be used as a generic layer to add features to, mostly at runtime.
 *
 * This layer ignores the mapLayerTypes configuration by default, as it is mostly used to display user data.
 * Be sure to configure this otherwise if needed and reset the default when extending this class to implement
 * a layer for a specific data source.
 */
class VectorLayer
  extends FeatureLayer<
    | VectorObliqueImpl
    | VectorOpenlayersImpl
    | VectorCesiumImpl
    | CesiumTilesetCesiumImpl
    | VectorPanoramaImpl
  >
  implements SplitLayer
{
  static get className(): string {
    return 'VectorLayer';
  }

  static getDefaultOptions(): VectorOptions {
    return {
      ...Layer.getDefaultOptions(),
      projection: undefined,
      maxResolution: undefined,
      minResolution: undefined,
      dontUseTerrainForOblique: false,
      highlightStyle: undefined,
      isDynamic: false,
      vectorProperties: {}, // XXX or should we return VectorProperties default options?
      vectorClusterGroup: undefined,
      ignoreMapLayerTypes: true,
    };
  }

  protected _supportedMaps = [
    CesiumMap.className,
    ObliqueMap.className,
    OpenlayersMap.className,
    PanoramaMap.className,
  ];

  source: VectorSource = new VectorSource({});

  projection: Projection;

  maxResolution: number | undefined;

  minResolution: number | undefined;

  dontUseTerrainForOblique: boolean;

  highlightStyle: VectorStyleItem | undefined;

  /**
   * A flag to indicate, whether the features in the layer have a UUID, allowing certain interactions,
   * e.g. hidding its features in plannings
   */
  hasFeatureUUID = false;

  private _visibility = true;

  /**
   * If true, the cesium synchronizers are destroyed on map change
   */
  isDynamic: boolean;

  private _onStyleChangeRemover: (() => void) | null = null;

  vectorProperties: VectorProperties;

  private _initialStyle: StyleItemOptions | undefined;

  private _vectorClusterGroup: string | undefined;

  vectorClusterGroupChanged = new VcsEvent<{
    newGroup?: string;
    oldGroup?: string;
  }>();

  constructor(options: VectorOptions) {
    const defaultOptions = VectorLayer.getDefaultOptions();
    super({ ...defaultOptions, ...options });

    this.projection = new Projection(options.projection);
    this.maxResolution =
      options.maxResolution != null
        ? options.maxResolution
        : defaultOptions.maxResolution;
    this.minResolution =
      options.minResolution != null
        ? options.minResolution
        : defaultOptions.minResolution;
    this.dontUseTerrainForOblique = parseBoolean(
      options.dontUseTerrainForOblique,
      defaultOptions.dontUseTerrainForOblique,
    );

    this.highlightStyle = undefined;
    if (options.highlightStyle) {
      this.highlightStyle =
        options.highlightStyle instanceof VectorStyleItem
          ? options.highlightStyle
          : new VectorStyleItem(options.highlightStyle);
    }

    this.isDynamic = parseBoolean(options.isDynamic, defaultOptions.isDynamic);

    this.vectorProperties = new VectorProperties({
      allowPicking: this.allowPicking,
      ...options.vectorProperties,
    });

    let initialStyle;
    if (options.style instanceof StyleItem) {
      initialStyle = options.style.toJSON();
    } else {
      initialStyle = options.style;
    }

    this._initialStyle = initialStyle;
    this._vectorClusterGroup = options.vectorClusterGroup;
  }

  get allowPicking(): boolean {
    return super.allowPicking;
  }

  set allowPicking(allowPicking: boolean) {
    super.allowPicking = allowPicking;
    this.vectorProperties.allowPicking = allowPicking;
  }

  get visibility(): boolean {
    return this._visibility;
  }

  set visibility(visible: boolean) {
    if (this._visibility !== visible) {
      this._visibility = visible;
      // eslint-disable-next-line no-void
      void this.forceRedraw();
    }
  }

  get vectorClusterGroup(): string | undefined {
    return this._vectorClusterGroup;
  }

  set vectorClusterGroup(newGroup: string | undefined) {
    if (this._vectorClusterGroup !== newGroup) {
      const oldGroup = this._vectorClusterGroup;
      this._vectorClusterGroup = newGroup;
      // this will destroy any current implementations which are potentially active and recreate them if needed
      this.forceRedraw().catch(() => {
        this.getLogger().warning(
          'Failed to redraw after setting vector cluster group',
        );
      });
      this.vectorClusterGroupChanged.raiseEvent({ newGroup, oldGroup });
    }
  }

  initialize(): Promise<void> {
    return super.initialize().then(() => {
      this._trackStyleChanges();
    });
  }

  /**
   * Returns the layers vcsMeta object
   * @param  options
   */
  getVcsMeta(options: GeoJSONwriteOptions = {}): VcsMeta {
    const vcsMeta: Partial<VcsMeta> = this.vectorProperties.getVcsMeta();
    vcsMeta.version = vcsMetaVersion;
    if (options.embedIcons) {
      vcsMeta.embeddedIcons = [];
    }

    if (options.writeStyle) {
      const defaultStyle = this.getStyleOrDefaultStyle(this._initialStyle);
      if (options.writeDefaultStyle || !defaultStyle.equals(this.style)) {
        writeStyle(this.style, vcsMeta as VcsMeta);
      }
      // TODO embed icons here by running over all features? this is never used anywhere
    }

    if (Object.keys(this.properties).length !== 0) {
      vcsMeta.layerProperties = { ...this.properties };
    }

    return vcsMeta as VcsMeta;
  }

  /**
   * Sets the meta values based on a  Object. Does not carry over the style
   * @param  vcsMeta
   */
  setVcsMeta(vcsMeta: VcsMeta): void {
    // XXX what about the style?
    this.vectorProperties.setVcsMeta(vcsMeta);
    if (vcsMeta.layerProperties) {
      Object.assign(this.properties, vcsMeta.layerProperties);
    }
  }

  getImplementationOptions(): VectorImplementationOptions {
    return {
      ...super.getImplementationOptions(),
      source: this.source,
      maxResolution: this.maxResolution,
      minResolution: this.minResolution,
      vectorProperties: this.vectorProperties,
    };
  }

  createImplementationsForMap(
    map: VcsMap,
  ): (
    | VectorObliqueImpl
    | VectorOpenlayersImpl
    | VectorCesiumImpl
    | CesiumTilesetCesiumImpl
    | VectorPanoramaImpl
  )[] {
    if (!this.visibility || !!this.vectorClusterGroup) {
      return [];
    }

    if (map instanceof OpenlayersMap) {
      return [new VectorOpenlayersImpl(map, this.getImplementationOptions())];
    }

    if (map instanceof CesiumMap) {
      return [new VectorCesiumImpl(map, this.getImplementationOptions())];
    }

    if (map instanceof ObliqueMap) {
      return [new VectorObliqueImpl(map, this.getImplementationOptions())];
    }

    if (map instanceof PanoramaMap) {
      return [new VectorPanoramaImpl(map, this.getImplementationOptions())];
    }

    return [];
  }

  getStyleOrDefaultStyle(
    styleOptions?:
      | DeclarativeStyleItemOptions
      | VectorStyleItemOptions
      | StyleItem,
    defaultStyle?: StyleItem,
  ): StyleItem {
    return super.getStyleOrDefaultStyle(
      styleOptions,
      defaultStyle || defaultVectorStyle.clone(),
    );
  }

  setStyle(style: Style | StyleFunction | StyleItem, silent?: boolean): void {
    super.setStyle(style, silent);
    this._trackStyleChanges();

    const isDeclarative = this.style instanceof DeclarativeStyleItem;
    this.getFeatures().forEach((f) => {
      if (f[vectorStyleSymbol]) {
        let changed;
        if (isDeclarative) {
          changed = true;
          f.setStyle(undefined);
        } else if (f.getStyle() !== f[vectorStyleSymbol].style) {
          changed = true;
          f.setStyle(f[vectorStyleSymbol].style);
        }
        if (changed && Reflect.has(f, originalStyle)) {
          updateOriginalStyle(f);
        }
      }
    });
  }

  /**
   * Changes features which use the layers style or if the layers style is a declarative style so they are re-rendered
   * @protected
   */
  protected _trackStyleChanges(): void {
    if (this._onStyleChangeRemover) {
      this._onStyleChangeRemover();
      this._onStyleChangeRemover = null;
    }

    const isDeclarative = this.style instanceof DeclarativeStyleItem;
    this._onStyleChangeRemover = this.style.styleChanged.addEventListener(
      () => {
        this.getFeatures().forEach((f) => {
          if (isDeclarative || !f[vectorStyleSymbol]) {
            f.changed();
          }
        });
      },
    );
  }

  /**
   * sets the highlightstyle of this layer
   */
  setHighlightStyle(style: Style | StyleFunction | VectorStyleItem): void {
    check(style, oneOf(Style, VectorStyleItem, Function));
    if (style instanceof VectorStyleItem) {
      this.highlightStyle = style;
    } else {
      if (!this.highlightStyle) {
        this.highlightStyle = new VectorStyleItem({});
      }
      this.highlightStyle.style = style;
    }
  }

  /**
   * returns the openlayers vector source
   */
  getSource(): VectorSource {
    return this.source;
  }

  /**
   * add features to the vector layer and return an array with their ids.
   * The geometry will be mutated and transformed to EPSG 3857 mercator coordinate system
   * features will be added an id, if they do not already have one.
   *
   * returns the ids of the added features. if a feature has an id and the same id is alread in the
   * layer, it will not be added.
   * @todo mechanism to enforce XYZ coordinate layout for internal usage
   */
  addFeatures(features: Feature[]): (string | number)[] {
    check(features, [Feature]);
    const isDeclarative = this.style instanceof DeclarativeStyleItem;

    const toAdd = features
      .map((feature) => {
        const featureId = feature.getId();
        if (featureId == null) {
          feature.setId(uuidv4());
        } else {
          this.hasFeatureUUID = true;
          if (featureId && this.getFeatureById(featureId)) {
            return false;
          }
        }

        if (this.projection.epsg !== mercatorProjection.epsg) {
          const geometry = feature.getGeometry();
          if (geometry) {
            if (!geometry[alreadyTransformedToMercator]) {
              geometry.transform(this.projection.proj, mercatorProjection.proj);
              geometry[alreadyTransformedToMercator] = true;
            }
          }
        }

        feature[vcsLayerName] = this.name;
        if (isDeclarative && feature[vectorStyleSymbol]) {
          feature.setStyle();
        }

        return feature;
      })
      .filter((f) => f) as Feature[];

    this.source.addFeatures(toAdd);
    return toAdd.map((f) => f.getId()) as (string | number)[];
  }

  /**
   * removes features from the vector layer
   */
  removeFeaturesById(ids: (string | number)[]): void {
    const features = this.getFeaturesById(ids);
    for (let i = 0; i < features.length; i++) {
      this.source.removeFeature(features[i]);
    }
  }

  /**
   * removes all features from the vector layer
   */
  removeAllFeatures(): void {
    this.source.clear();
  }

  /**
   * returns an array with features
   * feature geometries are always in EPSG 3857 mercator coordinate system
   */
  getFeaturesById(ids: (string | number)[]): Feature[] {
    check(ids, [oneOf(String, Number)]);
    return ids.map((id) => this.getFeatureById(id)).filter((f) => f != null);
  }

  /**
   * returns an feature if found, otherwise null
   * feature geometries are always in EPSG 3857 mercator coordinate system
   */
  getFeatureById(id: string | number): Feature | null {
    return this.source.getFeatureById(id);
  }

  /**
   * returns an array with features
   * Feature geometries are always in EPSG 3857 mercator coordinate system
   */
  getFeatures(): Feature[] {
    return this.source.getFeatures();
  }

  /**
   * Returns the configured Extent of this layer or tries to calculate the extent based on the current features.
   * Returns null of no extent was configured and the layer is void of any features with a valid geometry.
   */
  getZoomToExtent(): Extent | null {
    const metaExtent = super.getZoomToExtent(); // XXX not sure if this should be the otherway around?
    if (metaExtent) {
      return metaExtent;
    }
    const extent = new Extent({
      projection: mercatorProjection.toJSON(),
      coordinates: this.source.getExtent(),
    });
    if (extent.isValid()) {
      return extent;
    }
    return null;
  }

  toJSON(defaultOptions = VectorLayer.getDefaultOptions()): VectorOptions {
    const config: VectorOptions = super.toJSON(defaultOptions);

    const defaultProjection =
      defaultOptions.projection ?? getDefaultProjection();

    if (this.projection.epsg !== defaultProjection.epsg) {
      config.projection = this.projection.toJSON();
    }

    if (this.maxResolution !== defaultOptions.maxResolution) {
      config.maxResolution = this.maxResolution;
    }

    if (this.minResolution !== defaultOptions.minResolution) {
      config.minResolution = this.minResolution;
    }

    if (
      this.dontUseTerrainForOblique !== defaultOptions.dontUseTerrainForOblique
    ) {
      config.dontUseTerrainForOblique = this.dontUseTerrainForOblique;
    }

    if (this.highlightStyle) {
      config.highlightStyle = this.highlightStyle.toJSON();
    }

    if (this.isDynamic !== defaultOptions.isDynamic) {
      config.isDynamic = this.isDynamic;
    }

    const vectorPropertiesConfig = this.vectorProperties.getVcsMeta();
    if (Object.keys(vectorPropertiesConfig).length > 0) {
      config.vectorProperties = vectorPropertiesConfig;
    }

    if (this._vectorClusterGroup !== defaultOptions.vectorClusterGroup) {
      config.vectorClusterGroup = this._vectorClusterGroup;
    }

    return config;
  }

  destroy(): void {
    if (this.source) {
      this.source.clear(true);
    }
    if (this._onStyleChangeRemover) {
      this._onStyleChangeRemover();
    }
    this.vectorProperties.destroy();
    super.destroy();
  }
}

layerClassRegistry.registerClass(VectorLayer.className, VectorLayer);
export default VectorLayer;
