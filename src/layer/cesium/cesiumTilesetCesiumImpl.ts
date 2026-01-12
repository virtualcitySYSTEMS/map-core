import type {
  Cesium3DTile,
  Cesium3DTileContent,
  SplitDirection,
  CustomShader,
  TileBoundingVolume,
  BoundingSphere,
} from '@vcmap-cesium/engine';
import {
  Composite3DTileContent,
  Cesium3DTileset,
  Cesium3DTileColorBlendMode,
  Matrix4,
  Cartesian3,
  Cartographic,
  Rectangle,
  Math as CesiumMath,
} from '@vcmap-cesium/engine';
import type { Extent as OLExtent } from 'ol/extent.js';
import { createEmpty } from 'ol/extent.js';
import type { Coordinate } from 'ol/coordinate.js';
import LayerImplementation from '../layerImplementation.js';
import { allowPicking, vcsLayerName } from '../layerSymbols.js';
import type { HighlightableFeature } from '../featureVisibility.js';
import type FeatureVisibility from '../featureVisibility.js';
import {
  hideFeature,
  highlightFeature,
  originalStyle,
  updateOriginalStyle,
} from '../featureVisibility.js';
import Projection from '../../util/projection.js';
import { circleFromCenterRadius } from '../../util/geometryHelpers.js';
import type {
  CesiumTilesetImplementationOptions,
  CesiumTilesetTilesetProperties,
} from '../cesiumTilesetLayer.js';
import type { FeatureLayerImplementation } from '../featureLayer.js';
import type StyleItem from '../../style/styleItem.js';
import type GlobalHider from '../globalHider.js';
import { getResourceOrUrl } from './resourceHelper.js';
import type BaseCesiumMap from '../../map/baseCesiumMap.js';
import type { AttributeProvider } from '../../featureProvider/abstractAttributeProvider.js';
import type I3SCesiumImpl from './i3sCesiumImpl.js';

export const cesiumTilesetLastUpdated: unique symbol = Symbol(
  'cesiumTilesetLastUpdated',
);

export const updateFeatureOverride: unique symbol = Symbol(
  'updateFeatureOverride',
);

function getExtentFromBoundingVolume(
  boundingVolume: TileBoundingVolume,
  boundingSphere: BoundingSphere,
): OLExtent {
  const { rectangle } = boundingVolume;
  if (rectangle) {
    const scratchSW = Rectangle.southwest(rectangle);
    const scratchNE = Rectangle.northeast(rectangle);
    const mercatorSW = Projection.wgs84ToMercator([
      CesiumMath.toDegrees(scratchSW.longitude),
      CesiumMath.toDegrees(scratchSW.latitude),
    ]);

    const mercatorNE = Projection.wgs84ToMercator([
      CesiumMath.toDegrees(scratchNE.longitude),
      CesiumMath.toDegrees(scratchNE.latitude),
    ]);
    return [mercatorSW[0], mercatorSW[1], mercatorNE[0], mercatorNE[1]];
  }

  const { center, radius } = boundingSphere;
  const cart = Cartographic.fromCartesian(center);
  const mercatorCenter = Projection.wgs84ToMercator([
    CesiumMath.toDegrees(cart.longitude),
    CesiumMath.toDegrees(cart.latitude),
    cart.height,
  ]);
  const circle = circleFromCenterRadius(mercatorCenter, radius);
  return circle.getExtent();
}

export function getExtentFromTileset(
  cesium3DTileset?: Cesium3DTileset,
): OLExtent {
  if (!cesium3DTileset) {
    return createEmpty();
  }
  return getExtentFromBoundingVolume(
    cesium3DTileset.root.boundingVolume,
    cesium3DTileset.boundingSphere,
  );
}

export function createCesiumStylingContext(
  impl: CesiumTilesetCesiumImpl | I3SCesiumImpl,
): {
  styleContent: (content: Cesium3DTileContent) => void;
  updateStyle: (style: StyleItem) => void;
  applyStyle: (tile: Cesium3DTile) => void;
  destroy: () => void;
} {
  let styleLastUpdated = 0;
  let onStyleChangeRemover: (() => void) | null = null;
  let onFeatureVisibilityChangeRemover: (() => void) | null = null;

  function styleContent(content: Cesium3DTileContent): void {
    const styleHasChanged =
      styleLastUpdated > (content[cesiumTilesetLastUpdated] ?? 0);

    if (
      !content[cesiumTilesetLastUpdated] ||
      content[cesiumTilesetLastUpdated] < impl.featureVisibility.lastUpdated ||
      content[cesiumTilesetLastUpdated] <
        (impl.globalHider?.lastUpdated ?? 0) ||
      styleHasChanged
    ) {
      delete content[updateFeatureOverride];
      const batchSize = content.featuresLength;
      const featureOverride = {
        hideLocal: [] as [string, HighlightableFeature][],
        hideGlobal: [] as [string, HighlightableFeature][],
        highlight: [] as [string, HighlightableFeature][],
      };
      for (let batchId = 0; batchId < batchSize; batchId++) {
        const feature = content.getFeature(batchId);
        if (feature) {
          const id = String(feature.getId());
          let shouldUpdateOriginalStyle = true;
          if (
            impl.featureVisibility.highlightedObjects[id] &&
            !impl.featureVisibility.hasHighlightFeature(id, feature)
          ) {
            impl.featureVisibility.addHighlightFeature(id, feature);
            featureOverride.highlight.push([id, feature]);
            shouldUpdateOriginalStyle = false;
          } else if (
            impl.featureVisibility.hasHighlightFeature(id, feature) &&
            styleHasChanged &&
            feature[originalStyle]
          ) {
            // Feature is already highlighted and style has changed
            // Clear the old cached style - when unhighlighted, we'll force a tileset style update
            delete feature[originalStyle];
            featureOverride.highlight.push([id, feature]);
            shouldUpdateOriginalStyle = false;
          }

          if (impl.featureVisibility.hiddenObjects[id]) {
            if (!impl.featureVisibility.hasHiddenFeature(id, feature)) {
              impl.featureVisibility.addHiddenFeature(id, feature);
              featureOverride.hideLocal.push([id, feature]);
            } else if (styleHasChanged && feature[originalStyle]) {
              // Feature is already hidden and style has changed, clear original style
              // so it will be re-cached with the new style when shown
              delete feature[originalStyle];
            }
            shouldUpdateOriginalStyle = false;
          }

          if (impl.globalHider?.hiddenObjects[id]) {
            if (!impl.globalHider?.hasFeature(id, feature)) {
              impl.globalHider?.addFeature(id, feature);
            }
            featureOverride.hideGlobal.push([id, feature]);
            if (styleHasChanged && feature[originalStyle]) {
              // Feature is globally hidden and style has changed, clear original style
              delete feature[originalStyle];
            }
            shouldUpdateOriginalStyle = false;
          }

          if (
            shouldUpdateOriginalStyle &&
            styleHasChanged &&
            feature[originalStyle] // can only be a color for cesium, so no check for undefined required
          ) {
            updateOriginalStyle(feature);
          }
        }
      }
      if (
        featureOverride.hideLocal.length > 0 ||
        featureOverride.hideGlobal.length > 0 ||
        featureOverride.highlight.length > 0
      ) {
        content[updateFeatureOverride] = (): void => {
          featureOverride.hideGlobal.forEach(([id, feature]) => {
            if (impl.globalHider?.hasFeature(id, feature)) {
              hideFeature(feature);
            }
          });

          featureOverride.hideLocal.forEach(([id, feature]) => {
            if (impl.featureVisibility.hasHiddenFeature(id, feature)) {
              hideFeature(feature);
            }
          });

          featureOverride.highlight.forEach(([id, feature]) => {
            if (impl.featureVisibility.hasHighlightFeature(id, feature)) {
              highlightFeature(feature);
            }
          });
        };
      }
      content[cesiumTilesetLastUpdated] = Date.now();
    } else {
      content[updateFeatureOverride]?.();
    }
  }
  function updateStyle(style: StyleItem): void {
    impl.style = style;

    function updateTilesetStyle(tileset: Cesium3DTileset): void {
      tileset.style = impl.style.cesiumStyle;
      if (onStyleChangeRemover) {
        onStyleChangeRemover();
      }
      styleLastUpdated = Date.now();
      if (tileset.colorBlendMode !== impl.style.colorBlendMode) {
        // we only support replace and mix mode if the _3DTILESDIFFUSE Flag is set in the tileset
        if (
          impl.style.colorBlendMode !== Cesium3DTileColorBlendMode.HIGHLIGHT
        ) {
          if (
            tileset.extras &&
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,no-underscore-dangle
            (tileset.extras._3DTILESDIFFUSE as boolean)
          ) {
            tileset.colorBlendMode = impl.style.colorBlendMode;
          }
        } else {
          tileset.colorBlendMode = impl.style.colorBlendMode;
        }
      }
    }
    if (impl.initialized) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      if (impl instanceof CesiumTilesetCesiumImpl) {
        if (impl.cesium3DTileset) {
          updateTilesetStyle(impl.cesium3DTileset);
          onStyleChangeRemover = impl.style.styleChanged.addEventListener(
            () => {
              impl.cesium3DTileset?.makeStyleDirty();
              styleLastUpdated = Date.now();
            },
          );
        }
      } else if (impl.data) {
        impl.data.layers.forEach(({ tileset }) => {
          if (tileset) {
            updateTilesetStyle(tileset);
          }
        });
        onStyleChangeRemover = impl.style.styleChanged.addEventListener(() => {
          impl.data?.layers.forEach(({ tileset }) => {
            tileset?.makeStyleDirty();
          });
          styleLastUpdated = Date.now();
        });
      }
    }
  }
  function applyStyle(tile: Cesium3DTile): void {
    if (tile.contentReady) {
      if (tile.content instanceof Composite3DTileContent) {
        for (let i = 0; i < tile.content.innerContents.length; i++) {
          styleContent(tile.content.innerContents[i] as Cesium3DTileContent);
        }
      } else {
        styleContent(tile.content);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  if (impl instanceof CesiumTilesetCesiumImpl) {
    onFeatureVisibilityChangeRemover =
      impl.featureVisibility.changed.addEventListener(() => {
        impl.cesium3DTileset?.makeStyleDirty();
      });
  } else {
    onFeatureVisibilityChangeRemover =
      impl.featureVisibility.changed.addEventListener(() => {
        impl.data?.layers.forEach(({ tileset }) => {
          tileset?.makeStyleDirty();
        });
        styleLastUpdated = Date.now();
      });
  }

  return {
    styleContent,
    updateStyle,
    applyStyle,
    destroy: (): void => {
      if (onStyleChangeRemover) {
        onStyleChangeRemover();
        onStyleChangeRemover = null;
      }
      if (onFeatureVisibilityChangeRemover) {
        onFeatureVisibilityChangeRemover();
        onFeatureVisibilityChangeRemover = null;
      }
    },
  };
}

export function createTilesetEventListeners(
  impl: CesiumTilesetCesiumImpl | I3SCesiumImpl,
  tileset: Cesium3DTileset,
): void {
  function tileLoadedHandler(tile: Cesium3DTile): void {
    if (impl.attributeProvider) {
      const extent = getExtentFromBoundingVolume(
        tile.contentBoundingVolume,
        tile.boundingSphere,
      );
      const features: HighlightableFeature[] = [];
      const batchSize = tile.content.featuresLength;
      for (let batchId = 0; batchId < batchSize; batchId++) {
        const feature = tile.content.getFeature(batchId);
        if (feature) {
          features.push(feature);
        }
      }

      impl.attributeProvider
        .augmentFeatures(features, extent)
        .then(() => {
          impl.applyStyle(tile);
        })
        .catch((err: unknown) => {
          impl
            .getLogger()
            .error(`Error augmenting features in ${impl.className}:`, err);
        });
    }
  }

  tileset.tileLoad.addEventListener(tileLoadedHandler);
  tileset.tileVisible.addEventListener(impl.applyStyle);
  tileset.tileUnload.addEventListener((tile: Cesium3DTile) => {
    delete tile[cesiumTilesetLastUpdated];
    delete tile.content[cesiumTilesetLastUpdated];
    delete tile.content[updateFeatureOverride];
  });
}

/**
 * represents the cesium implementation for a {@link CesiumTilesetLayer} layer.
 */
class CesiumTilesetCesiumImpl
  extends LayerImplementation<BaseCesiumMap>
  implements FeatureLayerImplementation
{
  static get className(): string {
    return 'CesiumTilesetCesiumImpl';
  }

  cesium3DTileset: Cesium3DTileset | null;

  tilesetOptions: Record<string, unknown> | undefined;

  splitDirection: SplitDirection;

  style: StyleItem;

  featureVisibility: FeatureVisibility;

  globalHider: GlobalHider | undefined;

  tilesetProperties: Array<CesiumTilesetTilesetProperties> | undefined;

  modelMatrix: Matrix4 | undefined;

  offset: Coordinate | undefined;

  allowPicking: boolean;

  attributeProvider?: AttributeProvider;

  private _initializedPromise: Promise<Cesium3DTileset> | null = null;

  private _originalOrigin: Cartesian3 | null = null;

  private _destroyStyle: (() => void) | null = null;

  private _customShader: CustomShader | undefined;

  styleContent: (content: Cesium3DTileContent) => void;

  updateStyle: (style: StyleItem) => void;

  applyStyle: (tile: Cesium3DTile) => void;

  constructor(map: BaseCesiumMap, options: CesiumTilesetImplementationOptions) {
    super(map, options);

    this.cesium3DTileset = null;
    this.tilesetOptions = options.tilesetOptions;
    this.splitDirection = options.splitDirection;
    this.style = options.style;
    this.featureVisibility = options.featureVisibility;
    this.globalHider = options.globalHider;
    this.tilesetProperties = options.tilesetProperties;
    this.modelMatrix = options.modelMatrix;
    this.offset = options.offset;
    this._customShader = options.customShader;
    this.allowPicking = options.allowPicking;
    this.attributeProvider = options.attributeProvider;

    const stylingContext = createCesiumStylingContext(this);
    this.styleContent = stylingContext.styleContent;
    this.updateStyle = stylingContext.updateStyle;
    this.applyStyle = stylingContext.applyStyle;
    this._destroyStyle = stylingContext.destroy;
  }

  get customShader(): CustomShader | undefined {
    return this._customShader;
  }

  async initialize(): Promise<void> {
    if (!this._initializedPromise) {
      this._initializedPromise = Cesium3DTileset.fromUrl(
        getResourceOrUrl(this.url!, this.headers),
        {
          ...this.tilesetOptions,
          show: false, // show is handled by activate
        },
      );

      // if url could not be loaded, we have a fallback and try again with a prefixed tileset.json.
      try {
        this.cesium3DTileset = await this._initializedPromise;
      } catch (e) {
        if (this.url && !/\.json$/.test(this.url)) {
          this.url = `${this.url.replace(/\/$/, '')}/tileset.json`;
          this._initializedPromise = Cesium3DTileset.fromUrl(
            getResourceOrUrl(this.url, this.headers),
            {
              ...this.tilesetOptions,
              show: false, // show is handled by activate
            },
          );
          this.cesium3DTileset = await this._initializedPromise;
        } else {
          throw e;
        }
      }

      this.cesium3DTileset.customShader = this._customShader;
      if (this.isDestroyed) {
        this.cesium3DTileset.destroy();
        return;
      }
      if (this.tilesetProperties) {
        this.tilesetProperties.forEach(({ key, value }) => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          this.cesium3DTileset[key] = value;
        });
      }
      this.cesium3DTileset[vcsLayerName] = this.name;
      this.cesium3DTileset[allowPicking] = this.allowPicking;
      createTilesetEventListeners(this, this.cesium3DTileset);

      this._originalOrigin = Cartesian3.clone(
        this.cesium3DTileset.boundingSphere.center,
      );

      if (this.modelMatrix) {
        this.cesium3DTileset.modelMatrix = this.modelMatrix;
      } else if (this.offset) {
        this._calculateOffset();
      }
      this.map.addPrimitiveCollection(this.cesium3DTileset);
      await super.initialize();
      if (this.splitDirection) {
        this.cesium3DTileset.splitDirection = this.splitDirection;
      }
      this.updateStyle(this.style);
    }
    await this._initializedPromise;
  }

  private _calculateOffset(): void {
    if (this.cesium3DTileset && !this.modelMatrix && this._originalOrigin) {
      if (!this.offset) {
        this.cesium3DTileset.modelMatrix = Matrix4.IDENTITY;
      } else {
        const cartographicCenter = Cartographic.fromCartesian(
          this._originalOrigin,
        );
        cartographicCenter.longitude += CesiumMath.toRadians(this.offset[0]);
        cartographicCenter.latitude += CesiumMath.toRadians(this.offset[1]);
        cartographicCenter.height += this.offset[2];
        const offset = Cartographic.toCartesian(cartographicCenter);
        const translation = Cartesian3.subtract(
          offset,
          this._originalOrigin,
          offset,
        );
        this.cesium3DTileset.modelMatrix = Matrix4.fromTranslation(translation);
      }
    }
  }

  updateModelMatrix(modelMatrix?: Matrix4): void {
    this.modelMatrix = modelMatrix;
    if (this.cesium3DTileset) {
      if (!this.modelMatrix) {
        if (this.offset) {
          this._calculateOffset();
        } else {
          this.cesium3DTileset.modelMatrix = Matrix4.IDENTITY;
        }
      } else {
        this.cesium3DTileset.modelMatrix = this.modelMatrix;
      }
    }
  }

  updateOffset(offset?: Coordinate): void {
    this.offset = offset;
    this._calculateOffset();
  }

  updateCustomShader(shader?: CustomShader): void {
    this._customShader = shader;
    if (this.cesium3DTileset) {
      this.cesium3DTileset.customShader = this._customShader;
    }
  }

  async activate(): Promise<void> {
    await super.activate();
    if (this.active && this.cesium3DTileset) {
      this.cesium3DTileset.show = true;
    }
  }

  deactivate(): void {
    super.deactivate();
    if (this.cesium3DTileset) {
      this.cesium3DTileset.show = false;
    }
  }

  updateSplitDirection(splitDirection: SplitDirection): void {
    this.splitDirection = splitDirection;
    if (this.cesium3DTileset) {
      this.cesium3DTileset.splitDirection = splitDirection;
    }
  }

  destroy(): void {
    if (this.cesium3DTileset) {
      if (this.map.initialized) {
        const toRemove = this.cesium3DTileset;
        this.map.removePrimitiveCollection(toRemove);
      } else {
        this.cesium3DTileset.destroy();
      }

      this.cesium3DTileset = null;
    }

    if (this._destroyStyle) {
      this._destroyStyle();
    }

    super.destroy();
  }
}

export default CesiumTilesetCesiumImpl;
