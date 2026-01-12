import { Cartesian3, Color } from '@vcmap-cesium/engine';
import type { Cesium3DTileset } from '@vcmap-cesium/engine';
import { parseBoolean, parseInteger } from '@vcsuite/parsers';
import { check, is, maybe, oneOf } from '@vcsuite/check';
import AbstractFeatureProvider from '../featureProvider/abstractFeatureProvider.js';
import I3SCesiumImpl from './cesium/i3sCesiumImpl.js';
import FeatureLayer from './featureLayer.js';
import type { LayerOptions } from './layer.js';
import type FeatureVisibility from './featureVisibility.js';
import type { FeatureLayerImplementationOptions } from './featureLayer.js';
import { layerClassRegistry } from '../classRegistry.js';
import type VcsMap from '../map/vcsMap.js';
import CesiumMap from '../map/cesiumMap.js';
import BaseCesiumMap from '../map/baseCesiumMap.js';
import PanoramaMap from '../map/panoramaMap.js';
import type { VcsObjectOptions } from '../vcsObject.js';
import Extent from '../util/extent.js';
import { isMobile } from '../util/isMobile.js';
import { mercatorProjection } from '../util/projection.js';
import { rectangleToMercatorExtent } from '../util/math.js';
import { cesiumColorToColor, getStringColor } from '../style/styleHelpers.js';
import type { VectorStyleItemOptions } from '../style/vectorStyleItem.js';
import VectorStyleItem from '../style/vectorStyleItem.js';
import I3SAttributeProvider from '../featureProvider/i3sAttributeProvider.js';
import type { AttributeProvider } from '../featureProvider/abstractAttributeProvider.js';
import AbstractAttributeProvider from '../featureProvider/abstractAttributeProvider.js';
import CompositeFeatureProvider from '../featureProvider/compositeFeatureProvider.js';
import { getProviderForOption } from '../featureProvider/featureProviderFactory.js';

export type I3SOptions = LayerOptions & {
  adjustMaterialAlphaMode?: boolean;
  applySymbology?: boolean;
  calculateNormals?: boolean;
  showFeatures?: boolean;
  cesium3dTilesetOptions?: Cesium3DTileset.ConstructorOptions;
  lightColor?: { x: number; y: number; z: number };
  outlineColor?: string;
  screenSpaceError?: number;
  screenSpaceErrorMobile?: number;
  highlightStyle?: VectorStyleItem | VectorStyleItemOptions;
  featureVisibility?: FeatureVisibility;
  /** A flag to indicate if the layer has batch tables, in which case features attributes are loaded on load */
  hasBatchTable?: boolean;
  /** an optional attribute provider to provide custom attributes for the tileset features on load */
  attributeProvider?: AttributeProvider | VcsObjectOptions;
};

export type I3SImplementationOptions = FeatureLayerImplementationOptions & {
  allowPicking: boolean;
  adjustMaterialAlphaMode?: boolean;
  applySymbology?: boolean;
  calculateNormals?: boolean;
  showFeatures?: boolean;
  cesium3dTilesetOptions?: Cesium3DTileset.ConstructorOptions;
  hasBatchTable?: boolean;
  attributeProvider?: AttributeProvider;
};

class I3SLayer extends FeatureLayer<I3SCesiumImpl> {
  static get className(): string {
    return 'I3SLayer';
  }

  static getDefaultOptions(): I3SOptions {
    return {
      ...FeatureLayer.getDefaultOptions(),
      adjustMaterialAlphaMode: false,
      applySymbology: false,
      calculateNormals: false,
      showFeatures: false,
      cesium3dTilesetOptions: undefined,
      lightColor: undefined,
      outlineColor: undefined,
      screenSpaceError: 16,
      screenSpaceErrorMobile: 32,
      highlightStyle: undefined,
      hasBatchTable: true,
    };
  }

  adjustMaterialAlphaMode: boolean;
  applySymbology: boolean;
  calculateNormals: boolean;
  showFeatures: boolean;
  cesium3dTilesetOptions:
    | Partial<Cesium3DTileset.ConstructorOptions>
    | undefined;
  lightColor: { x: number; y: number; z: number } | undefined;
  outlineColor: string | undefined;
  screenSpaceError: number;
  screenSpaceErrorMobile: number;
  highlightStyle: VectorStyleItem | null = null;
  hasBatchTable: boolean;
  protected _supportedMaps = [CesiumMap.className, PanoramaMap.className];
  private _attributeProvider?: AttributeProvider;

  constructor(options: I3SOptions) {
    const defaultOptions = I3SLayer.getDefaultOptions();
    super({ ...defaultOptions, ...options });

    this.adjustMaterialAlphaMode = parseBoolean(
      options.adjustMaterialAlphaMode ?? defaultOptions.adjustMaterialAlphaMode,
    );
    this.applySymbology = parseBoolean(
      options.applySymbology ?? defaultOptions.applySymbology,
    );
    this.calculateNormals = parseBoolean(
      options.calculateNormals ?? defaultOptions.calculateNormals,
    );
    this.showFeatures = parseBoolean(
      options.showFeatures ?? defaultOptions.showFeatures,
    );

    this.screenSpaceError = parseInteger(
      options.screenSpaceError,
      defaultOptions.screenSpaceError,
    );

    this.screenSpaceErrorMobile = parseInteger(
      options.screenSpaceErrorMobile,
      defaultOptions.screenSpaceErrorMobile,
    );

    this.hasBatchTable = parseBoolean(
      options.hasBatchTable ?? defaultOptions.hasBatchTable,
    );

    if (options.highlightStyle) {
      this.highlightStyle =
        options.highlightStyle instanceof VectorStyleItem
          ? options.highlightStyle
          : new VectorStyleItem(options.highlightStyle);
    }

    const cesium3dTilesetOptions =
      options.cesium3dTilesetOptions || defaultOptions.cesium3dTilesetOptions;

    this.cesium3dTilesetOptions = {
      maximumScreenSpaceError: isMobile()
        ? this.screenSpaceErrorMobile
        : this.screenSpaceError,
      ...cesium3dTilesetOptions,
      ...(options.lightColor && {
        lightColor: new Cartesian3(
          options.lightColor.x,
          options.lightColor.y,
          options.lightColor.z,
        ),
      }),
      ...(options.outlineColor && {
        outlineColor: Color.fromCssColorString(options.outlineColor),
      }),
    };

    const attributeProvider = getProviderForOption(options.attributeProvider);
    if (this.hasBatchTable) {
      if (
        is(
          attributeProvider,
          oneOf(CompositeFeatureProvider, AbstractAttributeProvider),
        )
      ) {
        this._attributeProvider = attributeProvider;
      } else {
        this._attributeProvider = new I3SAttributeProvider({});
      }
    } else if (this.allowPicking) {
      if (is(this.featureProvider, AbstractFeatureProvider)) {
        this.attributeProvider = new CompositeFeatureProvider({
          featureProviders: [this.featureProvider],
          attributeProviders: [new I3SAttributeProvider({})],
        });
      } else {
        this.featureProvider = new I3SAttributeProvider({});
      }
    }
  }

  get attributeProvider(): AttributeProvider | undefined {
    return this._attributeProvider;
  }

  set attributeProvider(provider: AttributeProvider | undefined) {
    check(
      provider,
      maybe(oneOf(AbstractAttributeProvider, CompositeFeatureProvider)),
    );

    if (this._attributeProvider !== provider) {
      this._attributeProvider = provider;
      this.forceRedraw().catch((e: unknown) => {
        this.getLogger().error(
          `Error forcing redraw after setting attribute provider: ${String(e)}`,
        );
      });
    }
  }

  getImplementationOptions(): I3SImplementationOptions {
    return {
      ...super.getImplementationOptions(),
      allowPicking: this.allowPicking,
      adjustMaterialAlphaMode: this.adjustMaterialAlphaMode,
      applySymbology: this.applySymbology,
      calculateNormals: this.calculateNormals,
      showFeatures: this.showFeatures,
      cesium3dTilesetOptions: this.cesium3dTilesetOptions,
      hasBatchTable: this.hasBatchTable,
      attributeProvider: this._attributeProvider,
    };
  }

  createImplementationsForMap(map: VcsMap): I3SCesiumImpl[] {
    if (map instanceof BaseCesiumMap) {
      return [new I3SCesiumImpl(map, this.getImplementationOptions())];
    }
    return [];
  }

  getZoomToExtent(): Extent | null {
    const metaExtent = super.getZoomToExtent();
    if (metaExtent) {
      return metaExtent;
    }
    const impl = this.getImplementations()[0];
    if (impl?.data) {
      const coordinates = rectangleToMercatorExtent(impl.data.extent);
      const extent = new Extent({
        projection: mercatorProjection.toJSON(),
        coordinates,
      });
      if (extent.isValid()) {
        return extent;
      }
    }
    return null;
  }

  /**
   * set the maximum screenspace error of this layer
   */
  setMaximumScreenSpaceError(value: number): void {
    this.getImplementations().forEach((impl) => {
      if (impl.data) {
        impl.data.layers.forEach(({ tileset }) => {
          if (tileset) {
            tileset.maximumScreenSpaceError = value;
          }
        });
      }
    });
  }

  toJSON(defaultOptions = I3SLayer.getDefaultOptions()): I3SOptions {
    const config: I3SOptions = super.toJSON(defaultOptions);
    if (
      this.adjustMaterialAlphaMode !== defaultOptions.adjustMaterialAlphaMode
    ) {
      config.adjustMaterialAlphaMode = this.adjustMaterialAlphaMode;
    }
    if (this.applySymbology !== defaultOptions.applySymbology) {
      config.applySymbology = this.applySymbology;
    }
    if (this.calculateNormals !== defaultOptions.calculateNormals) {
      config.calculateNormals = this.calculateNormals;
    }
    if (this.showFeatures !== defaultOptions.showFeatures) {
      config.showFeatures = this.showFeatures;
    }

    if (this.screenSpaceError !== defaultOptions.screenSpaceError) {
      config.screenSpaceError = this.screenSpaceError;
    }
    if (this.screenSpaceErrorMobile !== defaultOptions.screenSpaceErrorMobile) {
      config.screenSpaceErrorMobile = this.screenSpaceErrorMobile;
    }
    if (this.hasBatchTable !== defaultOptions.hasBatchTable) {
      config.hasBatchTable = this.hasBatchTable;
    }
    if (this.highlightStyle) {
      config.highlightStyle = this.highlightStyle.toJSON();
    }

    const tilesetOptions = { ...this.cesium3dTilesetOptions };
    if (tilesetOptions.outlineColor) {
      config.outlineColor = getStringColor(
        cesiumColorToColor(tilesetOptions.outlineColor),
      );
    }
    delete tilesetOptions.outlineColor;

    if (tilesetOptions.lightColor) {
      config.lightColor = {
        x: tilesetOptions.lightColor.x,
        y: tilesetOptions.lightColor.y,
        z: tilesetOptions.lightColor.z,
      };
    }
    delete tilesetOptions.lightColor;

    const usedScreenSpaceError = isMobile()
      ? this.screenSpaceErrorMobile
      : this.screenSpaceError;
    if (tilesetOptions.maximumScreenSpaceError === usedScreenSpaceError) {
      delete tilesetOptions.maximumScreenSpaceError;
    }

    if (Object.keys(tilesetOptions).length > 0) {
      config.cesium3dTilesetOptions = structuredClone(tilesetOptions);
    }

    if (
      this._attributeProvider &&
      !(this._attributeProvider instanceof I3SAttributeProvider) &&
      !(this._attributeProvider instanceof AbstractFeatureProvider)
    ) {
      config.attributeProvider = this._attributeProvider.toJSON();
      if (this._attributeProvider instanceof CompositeFeatureProvider) {
        const { featureProviders, attributeProviders } =
          this._attributeProvider.toJSON();
        config.featureProvider = featureProviders[0];
        if (!(attributeProviders[0] instanceof I3SAttributeProvider)) {
          config.attributeProvider = attributeProviders[0];
        }
      } else {
        config.attributeProvider = this._attributeProvider.toJSON();
      }
    }

    return config;
  }

  /**
   * disposes of this layer, removes instances from the current maps and the framework
   */
  destroy(): void {
    this.attributeProvider?.destroy();
    super.destroy();
  }
}

layerClassRegistry.registerClass(I3SLayer.className, I3SLayer);
export default I3SLayer;
