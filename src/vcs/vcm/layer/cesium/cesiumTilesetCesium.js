import Composite3DTileContent from '@vcmap/cesium/Source/Scene/Composite3DTileContent.js';
import Cesium3DTileset from '@vcmap/cesium/Source/Scene/Cesium3DTileset.js';
import Cesium3DTileColorBlendMode from '@vcmap/cesium/Source/Scene/Cesium3DTileColorBlendMode.js';
import Matrix4 from '@vcmap/cesium/Source/Core/Matrix4.js';
import Cartesian3 from '@vcmap/cesium/Source/Core/Cartesian3.js';
import Cartographic from '@vcmap/cesium/Source/Core/Cartographic.js';
import Rectangle from '@vcmap/cesium/Source/Core/Rectangle.js';
import CesiumMath from '@vcmap/cesium/Source/Core/Math.js';
import { createEmpty } from 'ol/extent.js';
import LayerImplementation from '../layerImplementation.js';
import { vcsLayerName } from '../layerSymbols.js';
import { getGlobalHider } from '../globalHider.js';
import { originalStyle, updateOriginalStyle } from '../featureVisibility.js';
import Projection from '../../util/projection.js';
import { circleFromCenterRadius } from '../../util/geometryHelpers.js';

/**
 * @type {symbol}
 */
export const cesiumTilesetLastUpdated = Symbol('cesiumTilesetLastUpdated');

/**
 * @param {Cesium/Cesium3DTileset} cesium3DTileset
 * @returns {ol/Extent} in mercator
 */
export function getExtentFromTileset(cesium3DTileset) {
  if (!cesium3DTileset.ready) {
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
    return /** @type {ol.Extent} */ ([mercatorSW[0], mercatorSW[1], mercatorNE[0], mercatorNE[1]]);
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
 * represents the cesium implementation for a {@link vcs.vcm.layer.CesiumTileset} layer.
 * @class
 * @export
 * @extends {vcs.vcm.layer.LayerImplementation<vcs.vcm.maps.CesiumMap>}
 * @implements {vcs.vcm.layer.FeatureLayerImplementation}
 * @api stable
 * @memberOf vcs.vcm.layer.cesium
 */
class CesiumTilesetCesium extends LayerImplementation {
  /** @type {string} */
  static get className() { return 'vcs.vcm.layer.cesium.CesiumTilesetCesium'; }

  /**
   * @param {vcs.vcm.maps.CesiumMap} map
   * @param {vcs.vcm.layer.CesiumTileset.ImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);

    /** @type {Cesium/Cesium3DTileset} */
    this.cesium3DTileset = null;
    /** @type {Object} */
    this.tilesetOptions = options.tilesetOptions;
    /** @type {Cesium/ImagerySplitDirection} */
    this.splitDirection = options.splitDirection;
    /** @type {vcs.vcm.util.style.StyleItem} */
    this.style = options.style;
    /** @type {vcs.vcm.layer.FeatureVisibility} */
    this.featureVisibility = options.featureVisibility;
    /** @type {Array<vcs.vcm.layer.CesiumTileset.TilesetProperties>} */
    this.tilesetProperties = options.tilesetProperties;
    /** @type {Cesium/Matrix4} */
    this.modelMatrix = options.modelMatrix;
    /** @type {ol/Coordinate} */
    this.offset = options.offset;
    /**
     * @type {Promise<void>}
     * @private
     */
    this._initializedPromise = null;
    /**
     * @type {Cesium/Cartesian3}
     * @private
     */
    this._originalOrigin = null;
    /**
     * @type {number}
     * @private
     */
    this._styleLastUpdated = Date.now();
    this.globalHider = getGlobalHider();
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this._initializedPromise) {
      /** @type {Cesium/Cesium3DTileset} */
      this.cesium3DTileset = new Cesium3DTileset({
        ...this.tilesetOptions,
        show: false, // show is handled by activate
      });
      if (this.tilesetProperties) {
        this.tilesetProperties.forEach(({ key, value }) => {
          this.cesium3DTileset[key] = value;
        });
      }
      this.cesium3DTileset[vcsLayerName] = this.name;
      this.cesium3DTileset.tileVisible.addEventListener(this.applyStyle.bind(this));
      this.cesium3DTileset.tileUnload.addEventListener((tile) => {
        delete tile[cesiumTilesetLastUpdated];
      });

      this._initializedPromise = new Promise((resolve, reject) => {
        this.cesium3DTileset.readyPromise.then(() => { resolve(); }, reject);
      });

      await this._initializedPromise;
      this._originalOrigin = Cartesian3.clone(this.cesium3DTileset.boundingSphere.center);

      if (this.modelMatrix) {
        this.cesium3DTileset.modelMatrix = this.modelMatrix;
      } else if (this.offset) {
        this._calculateOffset();
      }
      this.map.addPrimitiveCollection(this.cesium3DTileset);
      await super.initialize();
      if (this.splitDirection) {
        this.updateSplitDirection(this.splitDirection);
      }
      this.updateStyle(this.style);
    }
    return this._initializedPromise;
  }

  /**
   * @private
   */
  _calculateOffset() {
    if (this.cesium3DTileset && !this.modelMatrix) {
      if (!this.offset) {
        this.cesium3DTileset.modelMatrix = Matrix4.IDENTITY;
      } else {
        const cartographicCenter = Cartographic.fromCartesian(this._originalOrigin);
        cartographicCenter.longitude += CesiumMath.toRadians(this.offset[0]);
        cartographicCenter.latitude += CesiumMath.toRadians(this.offset[1]);
        cartographicCenter.height += this.offset[2];
        const offset = Cartographic.toCartesian(cartographicCenter);
        const translation = Cartesian3.subtract(offset, this._originalOrigin, offset);
        this.cesium3DTileset.modelMatrix = Matrix4.fromTranslation(translation);
      }
    }
  }

  /**
   * @param {Cesium/Matrix4=} modelMatrix
   */
  updateModelMatrix(modelMatrix) {
    this.modelMatrix = modelMatrix;
    if (this.cesium3DTileset) {
      if (!this.modelMatrix) {
        if (this.offset) {
          this._calculateOffset();
        } else {
          this.cesium3DTileset.modelMatrix = Matrix4.IDENTITY;
        }
      } else {
        this.cesium3DTileset.modelMatrix = modelMatrix;
      }
    }
  }

  /**
   * @param {ol/Coordinate=} offset
   */
  updateOffset(offset) {
    this.offset = offset;
    this._calculateOffset();
  }

  /**
   * @inheritDoc
   */
  async activate() {
    await super.activate();
    if (this.active) {
      this.cesium3DTileset.show = true;
    }
  }

  /**
   * @inheritDoc
   */
  deactivate() {
    super.deactivate();
    if (this.cesium3DTileset) {
      this.cesium3DTileset.show = false;
    }
  }

  /**
   * @param {vcs.vcm.util.style.StyleItem} style
   * @param {boolean=} silent
   */
  // eslint-disable-next-line no-unused-vars
  updateStyle(style, silent) {
    this.style = style;
    if (this.initialized) {
      this.cesium3DTileset.style = this.style.cesiumStyle;
      if (this._onStyleChangeRemover) {
        this._onStyleChangeRemover();
      }
      this._onStyleChangeRemover = this.style.styleChanged.addEventListener(() => {
        this.cesium3DTileset.makeStyleDirty();
        this._styleLastUpdated = Date.now();
      });
      this._styleLastUpdated = Date.now();
      this.cesium3DTileset.readyPromise.then(() => {
        if (this.cesium3DTileset.colorBlendMode !== this.style.colorBlendMode) {
          // we only support replace and mix mode if the _3DTILESDIFFUSE Flag is set in the tileset
          if (this.style.colorBlendMode !== Cesium3DTileColorBlendMode.HIGHLIGHT) {
            // eslint-disable-next-line no-underscore-dangle
            if (this.cesium3DTileset.extras && this.cesium3DTileset.extras._3DTILESDIFFUSE) {
              this.cesium3DTileset.colorBlendMode = this.style.colorBlendMode;
            }
          } else {
            this.cesium3DTileset.colorBlendMode = this.style.colorBlendMode;
          }
        }
      });
    }
  }

  /**
   * @param {Cesium/ImagerySplitDirection} splitDirection
   */
  updateSplitDirection(splitDirection) {
    const { splitScreen } = this.map;
    if (splitScreen) { // XXX edge case: what if the map get splitScreen added later?
      const previousClippingObject = splitScreen.getClippingObjectForDirection(this.splitDirection);
      if (previousClippingObject) {
        previousClippingObject.removeLayer(this.name);
      }
      this.splitDirection = splitDirection;
      const currentClippingObject = splitScreen.getClippingObjectForDirection(this.splitDirection);
      if (currentClippingObject) {
        currentClippingObject.addLayer(this.name);
      }
    }
  }

  /**
   * @param {Cesium/Cesium3DTile} tile
   */
  applyStyle(tile) {
    if (tile.content instanceof Composite3DTileContent) {
      for (let i = 0; i < tile.content.innerContents.length; i++) {
        this.styleContent(tile.content.innerContents[i]);
      }
    } else {
      this.styleContent(tile.content);
    }
  }

  /**
   * @param {Cesium/Cesium3DTileContent} content
   */
  styleContent(content) {
    if (
      !content[cesiumTilesetLastUpdated] ||
      content[cesiumTilesetLastUpdated] < this.featureVisibility.lastUpdated ||
      content[cesiumTilesetLastUpdated] < this.globalHider.lastUpdated ||
      content[cesiumTilesetLastUpdated] < this._styleLastUpdated
    ) {
      const batchSize = content.featuresLength;
      for (let batchId = 0; batchId < batchSize; batchId++) {
        const feature = content.getFeature(batchId);
        if (feature) {
          let id = feature.getProperty('id');
          if (!id) {
            id = `${content.url}${batchId}`;
          }

          if (
            this.featureVisibility.highlightedObjects[id] &&
            !this.featureVisibility.hasHighlightFeature(id, feature)
          ) {
            this.featureVisibility.addHighlightFeature(id, feature);
          }

          if (this.featureVisibility.hiddenObjects[id] && !this.featureVisibility.hasHiddenFeature(id, feature)) {
            this.featureVisibility.addHiddenFeature(id, feature);
          }

          if (this.globalHider.hiddenObjects[id] && !this.globalHider.hasFeature(id, feature)) {
            this.globalHider.addFeature(id, feature);
          }

          if (
            this._styleLastUpdated > content[cesiumTilesetLastUpdated] &&
            feature[originalStyle] // can only be a color for cesium, so no check for undefined required
          ) {
            updateOriginalStyle(feature);
          }
        }
      }
      content[cesiumTilesetLastUpdated] = Date.now();
    }
  }

  /**
   * @inheritDoc
   */
  destroy() {
    if (this.cesium3DTileset) {
      if (this.map.initialized) {
        this.map.removePrimitiveCollection(this.cesium3DTileset);
      } else {
        this.cesium3DTileset.destroy();
      }

      this.cesium3DTileset = null;
    }

    if (this._onStyleChangeRemover) {
      this._onStyleChangeRemover();
    }

    if (this.splitDirection && this.map.splitScreen) {
      const previousClippingObject = this.map.splitScreen.getClippingObjectForDirection(this.splitDirection);
      if (previousClippingObject) {
        previousClippingObject.removeLayer(this.name);
      }
    }

    super.destroy();
  }
}

export default CesiumTilesetCesium;
