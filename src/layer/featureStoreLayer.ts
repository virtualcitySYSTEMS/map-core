import Feature from 'ol/Feature.js';
import type { Feature as GeojsonFeature, FeatureCollection } from 'geojson';
import { SplitDirection } from '@vcmap-cesium/engine';
import VectorSource from 'ol/source/Vector.js';
import { createEmpty, extend as extendExtent } from 'ol/extent.js';
import type { StyleFunction } from 'ol/style/Style.js';
import type Style from 'ol/style/Style.js';
import type { GeoJSONObject } from 'ol/format/GeoJSON.js';

import type {
  VectorImplementationOptions,
  VectorOptions,
} from './vectorLayer.js';
import VectorLayer from './vectorLayer.js';
import { featureStoreStateSymbol } from './featureStoreLayerState.js';
import { parseGeoJSON } from './geojsonHelpers.js';
import { mercatorProjection } from '../util/projection.js';
import FeatureStoreLayerChanges from './featureStoreLayerChanges.js';
import VectorStyleItem, {
  defaultVectorStyle,
  vectorStyleSymbol,
} from '../style/vectorStyleItem.js';
import FeatureVisibility, {
  FeatureVisibilityAction,
  originalStyle,
  synchronizeFeatureVisibility,
  updateOriginalStyle,
} from './featureVisibility.js';
import CesiumTilesetCesiumImpl, {
  getExtentFromTileset,
} from './cesium/cesiumTilesetCesiumImpl.js';
import CesiumMap from '../map/cesiumMap.js';
import OpenlayersMap from '../map/openlayersMap.js';
import ObliqueMap from '../map/obliqueMap.js';
import type { VcsMeta } from './vectorProperties.js';
import VectorProperties, { vcsMetaVersion } from './vectorProperties.js';
import VectorOpenlayersImpl from './openlayers/vectorOpenlayersImpl.js';
import DeclarativeStyleItem from '../style/declarativeStyleItem.js';
import VectorObliqueImpl from './oblique/vectorObliqueImpl.js';
import Extent from '../util/extent.js';
import { isMobile } from '../util/isMobile.js';
import { layerClassRegistry } from '../classRegistry.js';
import { requestJson } from '../util/fetch.js';
import { vcsLayerName } from './layerSymbols.js';
import type StyleItem from '../style/styleItem.js';
import type VcsMap from '../map/vcsMap.js';
import type VectorCesiumImpl from './cesium/vectorCesiumImpl.js';
import FeatureStoreFeatureVisibility from './featureStoreFeatureVisibility.js';

export type FeatureStoreStaticRepresentation = {
  /**
   * 3D static representation of this layer
   */
  threeDim?: string;
  /**
   * 2D static representation of this layer
   */
  twoDim?: string;
};

export type FeatureStoreLayerSchema = Omit<
  VectorOptions,
  'featureVisibility'
> & {
  /**
   * layer mongo id
   */
  id: string;
  type: string;
  featureType: string;
  /**
   * URLs to static representations for 2D and 3D maps
   */
  staticRepresentation?: FeatureStoreStaticRepresentation;
  /**
   * an array of IDs of features to hide from the static representation
   */
  hiddenStaticFeatureIds: (string | number)[];
  /**
   * the array of features to represent dynamic features
   */
  features: GeojsonFeature[];
  /**
   * vector style implemented by the map and base64-encoded png icons used for custom styles
   */
  vcsMeta: VcsMeta;
};

export type FetchDynamicFeatureCallback = (
  id: string | number,
) => Promise<string | GeojsonFeature>;

export type FeatureStoreOptions = FeatureStoreLayerSchema & {
  /**
   * injected function for fetching dynamic features from a remote FeatureStoreLayer server
   */
  injectedFetchDynamicFeatureFunc?: FetchDynamicFeatureCallback;

  featureVisibility?: FeatureStoreFeatureVisibility;
};

export const isTiledFeature: unique symbol = Symbol('isTiledFeature');

/**
 * FeatureStoreLayer Layer
 * @group Layer
 * @experimental
 */
class FeatureStoreLayer extends VectorLayer {
  static get className(): string {
    return 'FeatureStoreLayer';
  }

  static getDefaultOptions(): FeatureStoreOptions {
    return {
      id: '',
      type: 'FeatureStoreLayer',
      featureType: 'simple',
      features: [],
      ...VectorLayer.getDefaultOptions(),
      featureVisibility: undefined,
      projection: mercatorProjection.toJSON(),
      staticRepresentation: {},
      hiddenStaticFeatureIds: [],
      vcsMeta: {
        version: vcsMetaVersion,
        screenSpaceError: 4,
        altitudeMode: 'clampToGround',
      },
    };
  }

  /**
   * Feature Store layers have feature UUIDs by design
   */
  hasFeatureUUID = true;

  layerId: string;

  staticRepresentation: FeatureStoreStaticRepresentation;

  hiddenStaticFeatureIds: Set<string | number>;

  changeTracker: FeatureStoreLayerChanges;

  vcsMeta: VcsMeta;

  screenSpaceErrorMobile: number | undefined;

  screenSpaceError: number | undefined;

  featureVisibility: FeatureStoreFeatureVisibility;

  private _removeVectorPropertiesChangeHandler: () => void;

  /**
   * Synchronize featureVisibilities, while maintaining static features hidden.
   */
  private _featureVisibilitySyncListeners: (() => void)[];

  /**
   * a function to retrieve a single feature from the server
   */
  // eslint-disable-next-line class-methods-use-this
  injectedFetchDynamicFeatureFunc: FetchDynamicFeatureCallback = () => {
    throw new Error('Missing get dynamic feature');
  };

  private _staticFeatureVisibility = new FeatureVisibility();

  private _setEditing: { featureType?: number; symbol: symbol } | null = null;

  private _twoDimLoaded: Promise<void> | null = null;

  private _twoDimStyleChanged: (() => void) | null = null;

  private _twoDimStaticSource = new VectorSource();

  constructor(options: FeatureStoreOptions) {
    const defaultOptions = FeatureStoreLayer.getDefaultOptions();
    super({
      projection: defaultOptions.projection,
      ...options,
    });
    this._supportedMaps = [
      CesiumMap.className,
      OpenlayersMap.className,
      ObliqueMap.className,
    ];

    this.layerId = options.id;

    this.staticRepresentation =
      options.staticRepresentation || defaultOptions.staticRepresentation || {};

    this.hiddenStaticFeatureIds = new Set(
      options.hiddenStaticFeatureIds || defaultOptions.hiddenStaticFeatureIds,
    );

    this.changeTracker = new FeatureStoreLayerChanges(this);

    const { vcsMeta } = defaultOptions;
    if (options.vcsMeta) {
      Object.assign(vcsMeta, options.vcsMeta);
    }

    this.vcsMeta = vcsMeta;
    this.setVcsMeta(this.vcsMeta);

    this.screenSpaceErrorMobile = this.vcsMeta.screenSpaceError;
    this.screenSpaceError = this.vcsMeta.screenSpaceError;

    this._removeVectorPropertiesChangeHandler =
      this.vectorProperties.propertyChanged.addEventListener(() => {
        this.changeTracker.changed.raiseEvent();
      });

    this.injectedFetchDynamicFeatureFunc =
      options.injectedFetchDynamicFeatureFunc ??
      this.injectedFetchDynamicFeatureFunc;

    this.featureVisibility =
      options.featureVisibility ??
      new FeatureStoreFeatureVisibility(this.changeTracker);

    this._featureVisibilitySyncListeners = [
      synchronizeFeatureVisibility(
        this.featureVisibility,
        this._staticFeatureVisibility,
      ),
      this._staticFeatureVisibility.changed.addEventListener(({ action }) => {
        if (action === FeatureVisibilityAction.SHOW) {
          this._staticFeatureVisibility.hideObjects([
            ...this.hiddenStaticFeatureIds,
          ]);
        }
      }),
    ];

    if (options.features) {
      const featureCollection: FeatureCollection = {
        type: 'FeatureCollection',
        features: options.features,
        vcsMeta: options.vcsMeta,
      };
      const { style, features } = parseGeoJSON(featureCollection, {
        targetProjection: mercatorProjection,
        dynamicStyle: true,
      });
      if (style) {
        this._defaultStyle = style;
        this.setStyle(style);
      }
      this.addFeatures(features);
    }
  }

  initialize(): Promise<void> {
    if (!this.initialized) {
      return super.initialize().then(() => {
        this._staticFeatureVisibility.hideObjects([
          ...this.hiddenStaticFeatureIds,
        ]);
      });
    }
    return super.initialize();
  }

  private _loadTwoDim(): Promise<void> {
    if (!this.staticRepresentation.twoDim) {
      return Promise.resolve();
    }

    const { twoDim } = this.staticRepresentation;
    if (!this._twoDimLoaded) {
      this._twoDimLoaded = (async (): Promise<void> => {
        const data = await requestJson<GeoJSONObject>(twoDim, {
          headers: this.headers,
        });
        const { features } = parseGeoJSON(data, {
          targetProjection: mercatorProjection,
          dynamicStyle: true,
        });
        const isDeclarative = this.style instanceof DeclarativeStyleItem;
        features.forEach((feature) => {
          feature[vcsLayerName] = this.name;
          feature[isTiledFeature] = true;
          if (isDeclarative && feature[vectorStyleSymbol]) {
            feature.setStyle();
          }
          if (this._setEditing && this._setEditing.featureType != null) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            feature[this._setEditing.symbol] = this._setEditing.featureType;
          }
        });
        this._twoDimStaticSource.addFeatures(features);
      })();
    }
    return this._twoDimLoaded;
  }

  private _getTwoDimStaticImplOptions(): VectorImplementationOptions {
    return {
      ...super.getImplementationOptions(),
      source: this._twoDimStaticSource,
      featureVisibility: this._staticFeatureVisibility,
    };
  }

  createImplementationsForMap(
    map: VcsMap,
  ): (
    | VectorObliqueImpl
    | VectorOpenlayersImpl
    | VectorCesiumImpl
    | CesiumTilesetCesiumImpl
  )[] {
    const impls = super.createImplementationsForMap(map);
    if (
      map instanceof CesiumMap &&
      this.staticRepresentation &&
      this.staticRepresentation.threeDim
    ) {
      impls.push(
        new CesiumTilesetCesiumImpl(map, {
          allowPicking: this.allowPicking,
          url: this.staticRepresentation.threeDim,
          tilesetOptions: {
            maximumScreenSpaceError: isMobile()
              ? this.screenSpaceErrorMobile
              : this.screenSpaceError,
            url: this.staticRepresentation.threeDim,
          },
          tilesetProperties: [
            {
              key: isTiledFeature,
              value: true,
            },
          ],
          name: this.name,
          style: this.style,
          featureVisibility: this._staticFeatureVisibility,
          globalHider: this.globalHider,
          splitDirection: SplitDirection.NONE,
          headers: this.headers,
        }),
      );
    } else if (this.staticRepresentation && this.staticRepresentation.twoDim) {
      // eslint-disable-next-line no-void
      void this._loadTwoDim();
      if (map instanceof OpenlayersMap) {
        impls.push(
          new VectorOpenlayersImpl(map, this._getTwoDimStaticImplOptions()),
        );
      } else if (map instanceof ObliqueMap) {
        impls.push(
          new VectorObliqueImpl(map, this._getTwoDimStaticImplOptions()),
        );
      }
    }
    return impls;
  }

  reload(): Promise<void> {
    this._twoDimLoaded = null;
    this._twoDimStaticSource.clear();
    return super.reload();
  }

  async activate(): Promise<void> {
    await super.activate();
    if (this.active && this._setEditing) {
      this.setEditing(this._setEditing.symbol, this._setEditing.featureType);
    }
  }

  protected _trackStyleChanges(): void {
    super._trackStyleChanges();
    if (this.staticRepresentation.twoDim) {
      if (this._twoDimStyleChanged) {
        this._twoDimStyleChanged();
        this._twoDimStyleChanged = null;
      }

      const isDeclarative = this.style instanceof DeclarativeStyleItem;
      this._twoDimStyleChanged = this.style.styleChanged.addEventListener(
        () => {
          this._twoDimStaticSource.getFeatures().forEach((f) => {
            if (isDeclarative || !f[vectorStyleSymbol]) {
              f.changed();
            }
          });
        },
      );
    }
  }

  setStyle(style: Style | StyleFunction | StyleItem, silent?: boolean): void {
    const changeTrackerActive = this.changeTracker.active;
    if (changeTrackerActive) {
      this.changeTracker.pauseTracking('changefeature');
    }
    super.setStyle(style, silent);
    const isDeclarative = this.style instanceof DeclarativeStyleItem;
    this._twoDimStaticSource.getFeatures().forEach((f) => {
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
    if (changeTrackerActive) {
      this.changeTracker.track();
      this.changeTracker.changed.raiseEvent();
    }
  }

  setEditing(symbol: symbol, featureType?: number): void {
    this.getImplementations().forEach((impl) => {
      if (impl instanceof CesiumTilesetCesiumImpl) {
        if (impl.initialized) {
          if (featureType != null) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            impl.cesium3DTileset[symbol] = featureType;
          } else {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            delete impl.cesium3DTileset[symbol];
          }
          this._setEditing = null;
        } else {
          this._setEditing = { symbol, featureType };
        }
      }
    });

    if (this.staticRepresentation.twoDim) {
      if (this._twoDimLoaded) {
        this._twoDimLoaded
          .then(() => {
            this._twoDimStaticSource.getFeatures().forEach((f) => {
              if (featureType != null) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                f[symbol] = featureType;
              } else {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                delete f[symbol];
              }
            });
          })
          .catch((err: unknown) => {
            this.getLogger().error(
              `failed to set two dims editing: ${String(err)}`,
            );
          });
      } else {
        this._setEditing = { symbol, featureType };
      }
    }
  }

  getZoomToExtent(): Extent | null {
    if (this.extent && this.extent.isValid()) {
      return this.extent;
    }
    const extent = super.getZoomToExtent();
    const mercatorExtent = extent
      ? extent.getCoordinatesInProjection(mercatorProjection)
      : createEmpty();
    if (this.staticRepresentation.threeDim) {
      const threeDImpl = this.getImplementations().find(
        (impl): impl is CesiumTilesetCesiumImpl => {
          return !!(
            impl instanceof CesiumTilesetCesiumImpl && impl.cesium3DTileset
          );
        },
      );

      if (threeDImpl?.cesium3DTileset) {
        const threeDimExtent = getExtentFromTileset(threeDImpl.cesium3DTileset);
        extendExtent(mercatorExtent, threeDimExtent);
      }
    }

    if (this.staticRepresentation.twoDim && this._twoDimLoaded) {
      extendExtent(mercatorExtent, this._twoDimStaticSource.getExtent());
    }

    const actualExtent = new Extent({
      projection: mercatorProjection.toJSON(),
      coordinates: mercatorExtent,
    });

    if (actualExtent.isValid()) {
      return actualExtent;
    }

    return null;
  }

  /**
   * set the maximum screen space error of this layer
   */
  setMaximumScreenSpaceError(value: number): void {
    if (isMobile()) {
      this.screenSpaceErrorMobile = value;
    } else {
      this.screenSpaceError = value;
    }

    this.getImplementations().forEach((impl) => {
      if (impl instanceof CesiumTilesetCesiumImpl && impl.cesium3DTileset) {
        impl.cesium3DTileset.maximumScreenSpaceError = value;
      }
    });
  }

  /**
   * switch an array of static features to dynamic features
   * This is done by hiding the static features and adding their dynamic counterparts to the FeatureStoreLayer layer
   * @param  [featureId] input static feature ID
   */
  switchStaticFeatureToDynamic(
    featureId: string | number,
  ): Promise<Feature | null> {
    if (this.hiddenStaticFeatureIds.has(featureId)) {
      return Promise.resolve(this.getFeatureById(featureId));
    }
    if (this.injectedFetchDynamicFeatureFunc) {
      return this.injectedFetchDynamicFeatureFunc(featureId)
        .then((result) => {
          const { features } = parseGeoJSON(result, {
            targetProjection: mercatorProjection,
            defaultStyle:
              this.defaultStyle instanceof VectorStyleItem
                ? this.defaultStyle
                : defaultVectorStyle,
          });
          this._staticFeatureVisibility.hideObjects([featureId]);
          this.hiddenStaticFeatureIds.add(featureId);
          this.addFeatures(features);
          return features[0];
        })
        .catch((err: unknown) => {
          this.getLogger().error((err as Error).message);
        }) as Promise<Feature>;
    }
    return Promise.reject(new Error('no injected fetching function'));
  }

  /**
   * removes a static feature from featureStore layer
   * @param  featureId
   */
  removeStaticFeature(featureId: string): void {
    this._staticFeatureVisibility.hideObjects([featureId]);
    this.hiddenStaticFeatureIds.add(featureId);
    const feature = new Feature();
    feature.setId(featureId);
    feature[featureStoreStateSymbol] = 'static';
    this.changeTracker.removeFeature(feature);
  }

  /**
   * Resets a feature which used to be static but is now dynamic. called from featureStoreChanges API.
   * @param  featureId
   */
  resetStaticFeature(featureId: string | number): void {
    if (this.hiddenStaticFeatureIds.has(featureId)) {
      const idArray = [featureId];
      this.removeFeaturesById(idArray);
      this.hiddenStaticFeatureIds.delete(featureId);
      if (!this.featureVisibility.hiddenObjects[featureId]) {
        this._staticFeatureVisibility.showObjects(idArray);
      }
    }
  }

  toJSON(): FeatureStoreOptions {
    const config = super.toJSON() as Partial<FeatureStoreOptions>;
    const defaultOptions = FeatureStoreLayer.getDefaultOptions();

    delete config.projection;
    const vcsMeta = this.vectorProperties.getVcsMeta({
      ...VectorProperties.getDefaultOptions(),
      ...defaultOptions.vcsMeta,
    });

    if (Object.keys(vcsMeta).length > 0) {
      config.vcsMeta = { ...vcsMeta, version: vcsMetaVersion };
    }

    if (
      this.vcsMeta.screenSpaceError !== defaultOptions.vcsMeta.screenSpaceError
    ) {
      config.vcsMeta = config.vcsMeta || { version: vcsMetaVersion };
      config.vcsMeta.screenSpaceError = this.vcsMeta.screenSpaceError;
    }

    if (Object.keys(this.staticRepresentation).length > 0) {
      config.staticRepresentation = { ...this.staticRepresentation };
    }

    if (this.hiddenStaticFeatureIds.size > 0) {
      config.hiddenStaticFeatureIds = [...this.hiddenStaticFeatureIds];
    }
    return config as FeatureStoreOptions;
  }

  destroy(): void {
    this.removeAllFeatures();
    this._twoDimStaticSource.clear();
    if (this._twoDimStyleChanged) {
      this._twoDimStyleChanged();
      this._twoDimStyleChanged = null;
    }
    this._featureVisibilitySyncListeners.forEach((cb) => {
      cb();
    });
    this._featureVisibilitySyncListeners = [];
    this._staticFeatureVisibility.destroy();
    this.changeTracker.destroy();
    if (this._removeVectorPropertiesChangeHandler) {
      this._removeVectorPropertiesChangeHandler();
    }
    super.destroy();
  }
}

layerClassRegistry.registerClass(
  FeatureStoreLayer.className,
  FeatureStoreLayer,
);
export default FeatureStoreLayer;
