import {
  type Cesium3DTileset,
  Color,
  type CustomShader,
  Matrix4,
} from '@vcmap-cesium/engine';
import { check, maybe } from '@vcsuite/check';
import { parseInteger } from '@vcsuite/parsers';
import type { Coordinate } from 'ol/coordinate.js';
import type { VectorStyleItemOptions } from '../style/vectorStyleItem.js';
import VectorStyleItem from '../style/vectorStyleItem.js';
import type { FeatureLayerImplementationOptions } from './featureLayer.js';
import FeatureLayer from './featureLayer.js';
import CesiumTilesetCesiumImpl, {
  getExtentFromTileset,
} from './cesium/cesiumTilesetCesiumImpl.js';
import CesiumMap from '../map/cesiumMap.js';
import Extent from '../util/extent.js';
import { mercatorProjection } from '../util/projection.js';
import { isMobile } from '../util/isMobile.js';
import { layerClassRegistry } from '../classRegistry.js';
import type { LayerOptions } from './layer.js';
import type FeatureVisibility from './featureVisibility.js';
import type VcsMap from '../map/vcsMap.js';
import { cesiumColorToColor, getStringColor } from '../style/styleHelpers.js';
import PanoramaMap from '../map/panoramaMap.js';
import BaseCesiumMap from '../map/baseCesiumMap.js';

export type CesiumTilesetOptions = LayerOptions & {
  /**
   * relates inversely to the depth over which the layer is activated
   */
  screenSpaceError?: number;
  /**
   * relates inversely to the depth over which the layer is activated
   */
  screenSpaceErrorMobile?: number;
  tilesetOptions?: object;
  highlightStyle?: VectorStyleItem | VectorStyleItemOptions;
  featureVisibility?: FeatureVisibility;
  /**
   * an offset of x, y, z. x and y in degrees longitude/latitude respectively
   */
  offset?: Coordinate;
  /**
   * a css string color to be used as an outline.
   */
  outlineColor?: string;
};

export type CesiumTilesetTilesetProperties = {
  key: keyof Cesium3DTileset;
  value: unknown;
};

export type CesiumTilesetImplementationOptions =
  FeatureLayerImplementationOptions & {
    allowPicking: boolean;
    tilesetOptions?: Record<string, unknown>;
    tilesetProperties?: CesiumTilesetTilesetProperties[];
    modelMatrix?: Matrix4;
    offset?: Coordinate;
    customShader?: CustomShader;
  };

/**
 * represents a specific Building layer for cesium.
 * @group Layer
 */
class CesiumTilesetLayer extends FeatureLayer<CesiumTilesetCesiumImpl> {
  static get className(): string {
    return 'CesiumTilesetLayer';
  }

  static getDefaultOptions(): CesiumTilesetOptions {
    return {
      ...FeatureLayer.getDefaultOptions(),
      highlightStyle: undefined,
      screenSpaceError: 16,
      screenSpaceErrorMobile: 32,
      tilesetOptions: {},
      offset: undefined,
      outlineColor: undefined,
    };
  }

  highlightStyle: VectorStyleItem | null;

  screenSpaceError: number;

  screenSpaceErrorMobile: number;

  tilesetOptions: Partial<Cesium3DTileset.ConstructorOptions>;

  private _modelMatrix: Matrix4 | undefined;

  private _offset: Coordinate | undefined;

  protected _supportedMaps = [CesiumMap.className, PanoramaMap.className];

  private _customShader: CustomShader | undefined = undefined;

  constructor(options: CesiumTilesetOptions) {
    const defaultOptions = CesiumTilesetLayer.getDefaultOptions();
    super({ ...defaultOptions, ...options });

    this.highlightStyle = null;
    if (options.highlightStyle) {
      this.highlightStyle =
        options.highlightStyle instanceof VectorStyleItem
          ? options.highlightStyle
          : new VectorStyleItem(options.highlightStyle);
    }

    this.screenSpaceError = parseInteger(
      options.screenSpaceError,
      defaultOptions.screenSpaceError,
    );

    this.screenSpaceErrorMobile = parseInteger(
      options.screenSpaceErrorMobile,
      defaultOptions.screenSpaceErrorMobile,
    );

    const tilesetOptions =
      options.tilesetOptions || defaultOptions.tilesetOptions;

    this.tilesetOptions = {
      maximumScreenSpaceError: isMobile()
        ? this.screenSpaceErrorMobile
        : this.screenSpaceError,
      ...tilesetOptions,
      outlineColor: options.outlineColor
        ? Color.fromCssColorString(options.outlineColor)
        : undefined,
    };

    this._modelMatrix = undefined;

    this._offset = options.offset || defaultOptions.offset;
  }

  /**
   * A model matrix to apply to each cesium3DTileset created from this layer.
   * This will overwrite any modelMatrix calculated by the offset property.
   */
  get modelMatrix(): Matrix4 | undefined {
    return this._modelMatrix;
  }

  set modelMatrix(modelMatrix: Matrix4 | undefined) {
    check(modelMatrix, maybe(Matrix4));

    this._modelMatrix = modelMatrix;
    this.getImplementations().forEach((impl) => {
      impl.updateModelMatrix(modelMatrix);
    });
  }

  /**
   * An offset in x, y, z. x and y are in degrees longitude latitude respectively.
   * If a modelMatrix is defined on this layer, setting an offset will not take effect until you
   * set the modelMatrix to undefined.
   */
  get offset(): Coordinate | undefined {
    return this._offset;
  }

  set offset(offset: Coordinate | undefined) {
    check(offset, maybe([Number]));

    this._offset = offset;
    this.getImplementations().forEach((impl) => {
      impl.updateOffset(offset);
    });
  }

  get customShader(): CustomShader | undefined {
    return this._customShader;
  }

  set customShader(shader: CustomShader | undefined) {
    if (this._customShader !== shader) {
      this._customShader = shader;
      this.getImplementations().forEach((impl) => {
        impl.updateCustomShader(shader);
      });
    }
  }

  getImplementationOptions(): CesiumTilesetImplementationOptions {
    return {
      ...super.getImplementationOptions(),
      allowPicking: this.allowPicking,
      tilesetOptions: this.tilesetOptions,
      modelMatrix: this.modelMatrix,
      offset: this.offset,
      customShader: this.customShader,
    };
  }

  createImplementationsForMap(map: VcsMap): CesiumTilesetCesiumImpl[] {
    if (map instanceof BaseCesiumMap) {
      return [
        new CesiumTilesetCesiumImpl(map, this.getImplementationOptions()),
      ];
    }
    return [];
  }

  /**
   * Returns the configured Extent of this layer or tries to calculate the extent based on tileset.
   * Returns null of no extent was configured and the layers tileset is not yet loaded or ready.
   */
  getZoomToExtent(): Extent | null {
    const metaExtent = super.getZoomToExtent();
    if (metaExtent) {
      return metaExtent;
    }
    const impl = this.getImplementations()[0];
    if (impl?.cesium3DTileset) {
      const threeDimExtent = getExtentFromTileset(impl.cesium3DTileset);

      const actualExtent = new Extent({
        projection: mercatorProjection.toJSON(),
        coordinates: threeDimExtent,
      });

      if (actualExtent.isValid()) {
        return actualExtent;
      }
    }

    return null;
  }

  /**
   * set the maximum screenspace error of this layer
   */
  setMaximumScreenSpaceError(value: number): void {
    this.getImplementations().forEach((impl) => {
      if (impl.cesium3DTileset) {
        impl.cesium3DTileset.maximumScreenSpaceError = value;
      }
    });
  }

  toJSON(
    defaultOptions = CesiumTilesetLayer.getDefaultOptions(),
  ): CesiumTilesetOptions {
    const config: CesiumTilesetOptions = super.toJSON(defaultOptions);
    if (this.highlightStyle) {
      config.highlightStyle = this.highlightStyle.toJSON();
    }

    if (this.screenSpaceError !== defaultOptions.screenSpaceError) {
      config.screenSpaceError = this.screenSpaceError;
    }

    if (this.screenSpaceErrorMobile !== defaultOptions.screenSpaceErrorMobile) {
      config.screenSpaceErrorMobile = this.screenSpaceErrorMobile;
    }

    const tilesetOptions = { ...this.tilesetOptions };
    if (tilesetOptions.outlineColor) {
      config.outlineColor = getStringColor(
        cesiumColorToColor(tilesetOptions.outlineColor),
      );
    }
    delete tilesetOptions.outlineColor;

    const usedScreenSpaceError = isMobile()
      ? this.screenSpaceErrorMobile
      : this.screenSpaceError;
    if (tilesetOptions.maximumScreenSpaceError === usedScreenSpaceError) {
      delete tilesetOptions.maximumScreenSpaceError;
    }

    if (Object.keys(tilesetOptions).length > 0) {
      config.tilesetOptions = tilesetOptions;
    }

    if (Array.isArray(this.offset)) {
      config.offset = this.offset.slice();
    }

    return config;
  }

  /**
   * disposes of this layer, removes instances from the current maps and the framework
   */
  destroy(): void {
    super.destroy();
  }
}

layerClassRegistry.registerClass(
  CesiumTilesetLayer.className,
  CesiumTilesetLayer,
);
export default CesiumTilesetLayer;
