import {
  Composite3DTileContent,
  Cesium3DTileset,
  Cesium3DTileColorBlendMode,
  Matrix4,
  Cartesian3,
  Cartographic,
  Rectangle,
  Math as CesiumMath,
  type SplitDirection,
  Cesium3DTile,
  Cesium3DTileContent,
} from '@vcmap-cesium/engine';
import { createEmpty, Extent as OLExtent } from 'ol/extent.js';
import type { Coordinate } from 'ol/coordinate.js';
import LayerImplementation from '../layerImplementation.js';
import { vcsLayerName } from '../layerSymbols.js';
import FeatureVisibility, {
  hideFeature,
  HighlightableFeature,
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
import type CesiumMap from '../../map/cesiumMap.js';
import type { FeatureLayerImplementation } from '../featureLayer.js';
import type StyleItem from '../../style/styleItem.js';
import GlobalHider from '../globalHider.js';

export const cesiumTilesetLastUpdated: unique symbol = Symbol(
  'cesiumTilesetLastUpdated',
);

export const updateFeatureOverride: unique symbol = Symbol(
  'updateFeatureOverride',
);

export function getExtentFromTileset(
  cesium3DTileset?: Cesium3DTileset,
): OLExtent {
  if (!cesium3DTileset) {
    return createEmpty();
  }
  const { rectangle } = cesium3DTileset.root.boundingVolume;
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

  const { center, radius } = cesium3DTileset.boundingSphere;
  const cart = Cartographic.fromCartesian(center);
  const mercatorCenter = Projection.wgs84ToMercator([
    CesiumMath.toDegrees(cart.longitude),
    CesiumMath.toDegrees(cart.latitude),
    cart.height,
  ]);
  const circle = circleFromCenterRadius(mercatorCenter, radius);
  return circle.getExtent();
}

/**
 * represents the cesium implementation for a {@link CesiumTilesetLayer} layer.
 */
class CesiumTilesetCesiumImpl
  extends LayerImplementation<CesiumMap>
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

  private _initializedPromise: Promise<Cesium3DTileset> | null = null;

  private _originalOrigin: Cartesian3 | null = null;

  private _styleLastUpdated: number = Date.now();

  private _onStyleChangeRemover: (() => void) | null = null;

  constructor(map: CesiumMap, options: CesiumTilesetImplementationOptions) {
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
  }

  async initialize(): Promise<void> {
    if (!this._initializedPromise) {
      this._initializedPromise = Cesium3DTileset.fromUrl(this.url as string, {
        ...this.tilesetOptions,
        show: false, // show is handled by activate
      });
      this.cesium3DTileset = await this._initializedPromise;
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
      this.cesium3DTileset.tileVisible.addEventListener(
        this.applyStyle.bind(this),
      );
      this.cesium3DTileset.tileUnload.addEventListener((tile: Cesium3DTile) => {
        delete tile[cesiumTilesetLastUpdated];
        delete tile.content[cesiumTilesetLastUpdated];
        delete tile.content[updateFeatureOverride];
      });

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

  updateStyle(style: StyleItem, _silent?: boolean): void {
    this.style = style;
    if (this.initialized && this.cesium3DTileset) {
      this.cesium3DTileset.style = this.style.cesiumStyle;
      if (this._onStyleChangeRemover) {
        this._onStyleChangeRemover();
      }
      this._onStyleChangeRemover = this.style.styleChanged.addEventListener(
        () => {
          this.cesium3DTileset?.makeStyleDirty();
          this._styleLastUpdated = Date.now();
        },
      );
      this._styleLastUpdated = Date.now();
      if (this.cesium3DTileset.colorBlendMode !== this.style.colorBlendMode) {
        // we only support replace and mix mode if the _3DTILESDIFFUSE Flag is set in the tileset
        if (
          this.style.colorBlendMode !== Cesium3DTileColorBlendMode.HIGHLIGHT
        ) {
          if (
            this.cesium3DTileset.extras &&
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,no-underscore-dangle
            (this.cesium3DTileset.extras._3DTILESDIFFUSE as boolean)
          ) {
            this.cesium3DTileset.colorBlendMode = this.style.colorBlendMode;
          }
        } else {
          this.cesium3DTileset.colorBlendMode = this.style.colorBlendMode;
        }
      }
    }
  }

  updateSplitDirection(splitDirection: SplitDirection): void {
    this.splitDirection = splitDirection;
    if (this.cesium3DTileset) {
      this.cesium3DTileset.splitDirection = splitDirection;
    }
  }

  applyStyle(tile: Cesium3DTile): void {
    if (tile.contentReady) {
      if (tile.content instanceof Composite3DTileContent) {
        for (let i = 0; i < tile.content.innerContents.length; i++) {
          this.styleContent(
            tile.content.innerContents[i] as Cesium3DTileContent,
          );
        }
      } else {
        this.styleContent(tile.content);
      }
    }
  }

  styleContent(content: Cesium3DTileContent): void {
    if (
      !content[cesiumTilesetLastUpdated] ||
      content[cesiumTilesetLastUpdated] < this.featureVisibility.lastUpdated ||
      content[cesiumTilesetLastUpdated] <
        (this.globalHider?.lastUpdated ?? 0) ||
      content[cesiumTilesetLastUpdated] < this._styleLastUpdated
    ) {
      // content[updateFeatureOverride]?.reset();
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
          let id = feature.getProperty('id') as string | undefined;
          if (!id) {
            id = `${content.url}${batchId}`;
          }

          let shouldUpdateOriginalStyle = true;
          if (
            this.featureVisibility.highlightedObjects[id] &&
            !this.featureVisibility.hasHighlightFeature(id, feature)
          ) {
            this.featureVisibility.addHighlightFeature(id, feature);
            featureOverride.highlight.push([id, feature]);
            shouldUpdateOriginalStyle = false;
          }

          if (
            this.featureVisibility.hiddenObjects[id] &&
            !this.featureVisibility.hasHiddenFeature(id, feature)
          ) {
            this.featureVisibility.addHiddenFeature(id, feature);
            featureOverride.hideLocal.push([id, feature]);
          }

          if (
            this.globalHider?.hiddenObjects[id] &&
            !this.globalHider?.hasFeature(id, feature)
          ) {
            this.globalHider?.addFeature(id, feature);
            featureOverride.hideGlobal.push([id, feature]);
          }

          if (
            shouldUpdateOriginalStyle &&
            this._styleLastUpdated > (content[cesiumTilesetLastUpdated] ?? 0) &&
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
            if (this.globalHider?.hasFeature(id, feature)) {
              hideFeature(feature);
            }
          });

          featureOverride.hideLocal.forEach(([id, feature]) => {
            if (this.featureVisibility.hasHiddenFeature(id, feature)) {
              hideFeature(feature);
            }
          });

          featureOverride.highlight.forEach(([id, feature]) => {
            if (this.featureVisibility.hasHighlightFeature(id, feature)) {
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

    if (this._onStyleChangeRemover) {
      this._onStyleChangeRemover();
    }

    super.destroy();
  }
}

export default CesiumTilesetCesiumImpl;
