import { SplitDirection, Matrix4 } from '@vcmap/cesium';

import { checkMaybe } from '@vcsuite/check';
import { parseInteger } from '@vcsuite/parsers';
import getJSONObjectFromObject from './cesium/x3dmHelper.js';
import VectorStyleItem from '../style/vectorStyleItem.js';
import FeatureLayer from './featureLayer.js';
import CesiumTilesetCesiumImpl, { getExtentFromTileset } from './cesium/cesiumTilesetCesiumImpl.js';
import CesiumMap from '../map/cesiumMap.js';
import VcsEvent from '../vcsEvent.js';
import Extent from '../util/extent.js';
import { mercatorProjection } from '../util/projection.js';
import { isMobile } from '../util/isMobile.js';
import { layerClassRegistry } from '../classRegistry.js';

/**
 * @typedef {LayerOptions} CesiumTilesetOptions
 * @property {number|undefined} [screenSpaceError=16] -  relates inversely to the depth over which the layer is activated
 * @property {number|undefined} [screenSpaceErrorMobile=32] -  relates inversely to the depth over which the layer is activated
 * @property {number|undefined} [maximumMemoryUsage=16] - sets the cesium maximumMemoryUsage Parameter (Is when the cached tiles exceed this value cesium starts to clear the cached tiles)
 * @property {Object|undefined} tilesetOptions
 * @property {import("@vcmap/core").VectorStyleItem|VectorStyleItemOptions|undefined} highlightStyle
 * @property {import("@vcmap/core").FeatureVisibility|undefined} featureVisibility
 * @property {string|undefined} splitDirection - either 'left' or 'right', if omitted none is applied
 * @property {import("ol/coordinate").Coordinate|undefined} offset - an offset of x, y, z. x and y in degrees longitude/latitude respectively
 * @api
 */

/**
 * @typedef {Object} CesiumTilesetTilesetProperties
 * @property {string|symbol} key
 * @property {*} value
 * @api
 */

/**
 * @typedef {FeatureLayerImplementationOptions} CesiumTilesetImplementationOptions
 * @property {Object|undefined} tilesetOptions
 * @property {import("@vcmap/cesium").SplitDirection} splitDirection
 * @property {Array<CesiumTilesetTilesetProperties>|undefined} tilesetProperties
 * @property {import("@vcmap/cesium").Matrix4|undefined} modelMatrix
 * @property {import("ol/coordinate").Coordinate|undefined} offset
 * @api
 */

/**
 * represents a specific Building layer for cesium.
 * @class
 * @extends {FeatureLayer}
 * @implements {SplitLayer}
 * @api stable
 * @export
 */
class CesiumTilesetLayer extends FeatureLayer {
  /** @type {string} */
  static get className() { return 'CesiumTilesetLayer'; }

  /**
   * @returns {CesiumTilesetOptions}
   */
  static getDefaultOptions() {
    return {
      ...FeatureLayer.getDefaultOptions(),
      highlightStyle: undefined,
      screenSpaceError: 16,
      screenSpaceErrorMobile: 32,
      maximumMemoryUsage: 16,
      tilesetOptions: {},
      splitDirection: undefined,
      offset: undefined,
    };
  }

  /**
   * @param {CesiumTilesetOptions} options
   */
  constructor(options) {
    super(options);
    this._supportedMaps = [
      CesiumMap.className,
    ];
    const defaultOptions = CesiumTilesetLayer.getDefaultOptions();
    if (this.url && !/\.json$/.test(this.url)) {
      this.url = `${this.url.replace(/\/$/, '')}/tileset.json`;
    }

    /** @type {VectorStyleItem} */
    this.highlightStyle = null;
    if (options.highlightStyle) {
      this.highlightStyle = options.highlightStyle instanceof VectorStyleItem ?
        options.highlightStyle :
        new VectorStyleItem(/** @type {VectorStyleItemOptions} */ (options.highlightStyle));
    }
    /** @type {number} */
    this.screenSpaceError = parseInteger(options.screenSpaceError, defaultOptions.screenSpaceError);

    /** @type {number} */
    this.screenSpaceErrorMobile = parseInteger(options.screenSpaceErrorMobile, defaultOptions.screenSpaceErrorMobile);

    /** @type {number} */
    this.maximumMemoryUsage = parseInteger(options.maximumMemoryUsage, defaultOptions.maximumMemoryUsage);

    const tilesetOptions = options.tilesetOptions || defaultOptions.tilesetOptions;

    /** @type {!Object} */
    this.tilesetOptions = {
      url: this.url,
      maximumScreenSpaceError: isMobile() ? this.screenSpaceErrorMobile : this.screenSpaceError,
      maximumMemoryUsage: this.maximumMemoryUsage,
      ...tilesetOptions,
    };

    /** @type {import("@vcmap/cesium").SplitDirection} */
    this._splitDirection = SplitDirection.NONE;

    if (options.splitDirection) {
      this._splitDirection = options.splitDirection === 'left' ?
        SplitDirection.LEFT :
        SplitDirection.RIGHT;
    }

    /**
     * raised if the split direction changes, is passed the split direction as its only argument
     * @type {VcsEvent<import("@vcmap/cesium").SplitDirection>}
     * @api
     */
    this.splitDirectionChanged = new VcsEvent();

    /**
     * @type {import("@vcmap/cesium").Matrix4|undefined}
     * @private
     */
    this._modelMatrix = undefined;

    /**
     * @type {import("ol/coordinate").Coordinate|undefined}
     * @private
     */
    this._offset = options.offset || defaultOptions.offset;
  }

  /**
   * A model matrix to apply to each cesium3DTileset created from this layer.
   * This will overwrite any modelMatrix calculated by the offset property.
   * @api
   * @returns {import("@vcmap/cesium").Matrix4|undefined}
   */
  get modelMatrix() {
    return this._modelMatrix;
  }

  /**
   * @param {import("@vcmap/cesium").Matrix4|undefined} modelMatrix
   */
  set modelMatrix(modelMatrix) {
    checkMaybe(modelMatrix, Matrix4);

    this._modelMatrix = modelMatrix;
    this.getImplementations()
      .forEach(/** @param {CesiumTilesetCesiumImpl} impl */ (impl) => {
        impl.updateModelMatrix(modelMatrix);
      });
  }

  /**
   * An offset in x, y, z. x and y are in degrees longitude latitude respectively.
   * If a modelMatrix is defined on this layer, setting an offset will not take effect until you
   * set the modelMatrix to undefined.
   * @api
   * @type {import("ol/coordinate").Coordinate|undefined}
   */
  get offset() {
    return this._offset;
  }

  /**
   * @param {import("ol/coordinate").Coordinate|undefined} offset
   */
  set offset(offset) {
    checkMaybe(offset, [Number]);

    this._offset = offset;
    this.getImplementations()
      .forEach(/** @param {CesiumTilesetCesiumImpl} impl */ (impl) => {
        impl.updateOffset(offset);
      });
  }

  /**
   * @api
   * @type {import("@vcmap/cesium").SplitDirection}
   */
  get splitDirection() { return this._splitDirection; }

  /**
   * @param {import("@vcmap/cesium").SplitDirection} direction
   */
  set splitDirection(direction) {
    if (direction !== this._splitDirection) {
      this.getImplementations().forEach((impl) => {
        /** @type {CesiumTilesetCesiumImpl} */ (impl).updateSplitDirection(direction);
      });
      this._splitDirection = direction;
      this.splitDirectionChanged.raiseEvent(this._splitDirection);
    }
  }

  async initialize() {
    await this.style.cesiumStyle.readyPromise;
    return super.initialize();
  }

  /**
   * @inheritDoc
   * @returns {CesiumTilesetImplementationOptions}
   */
  getImplementationOptions() {
    return {
      ...super.getImplementationOptions(),
      tilesetOptions: this.tilesetOptions,
      splitDirection: this.splitDirection,
      modelMatrix: this.modelMatrix,
      offset: this.offset,
    };
  }

  /**
   * @inheritDoc
   * @param {import("@vcmap/core").VcsMap} map
   * @returns {Array<CesiumTilesetCesiumImpl>}
   */
  createImplementationsForMap(map) {
    if (map instanceof CesiumMap) {
      return [new CesiumTilesetCesiumImpl(map, this.getImplementationOptions())];
    }
    return [];
  }

  /**
   * @inheritDoc
   * @param {import("@vcmap/cesium").Cesium3DTileFeature|import("@vcmap/cesium").Cesium3DTilePointFeature} object
   * @returns {?Object}
   */
  objectClickedHandler(object) {
    if (this.allowPicking) {
      const jsonObject = getJSONObjectFromObject(object);
      if (jsonObject) {
        return {
          id: jsonObject.id,
          feature: jsonObject,
        };
      }
    }
    return null;
  }

  /**
   * Returns the configured Extent of this layer or tries to calculate the extent based on tileset.
   * Returns null of no extent was configured and the layers tileset is not yet loaded or ready.
   * @returns {Extent|null}
   * @api
   */
  getZoomToExtent() {
    const metaExtent = super.getZoomToExtent();
    if (metaExtent) {
      return metaExtent;
    }
    const impl = /** @type {CesiumTilesetCesiumImpl} */ (this.getImplementations()[0]);
    if (impl) {
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

  // TODO type params
  getGenericFeatureFromClickedObject(object) {
    const attributes = { ...this.genericFeatureProperties, ...object.attributes || object };
    return {
      layerName: this.name,
      layerClass: this.className,
      attributes,
      longitude: object.clickedPosition.longitude,
      latitude: object.clickedPosition.latitude,
      height: object.clickedPosition.height + this.balloonHeightOffset,
      relativeToGround: false,
    };
  }

  /**
   * set the maximum screenspace error of this layer
   * @param {number} value
   * @api stable
   */
  setMaximumScreenSpaceError(value) {
    this.getImplementations()
      .forEach(/** @param {CesiumTilesetCesiumImpl} impl */(impl) => {
        if (impl.cesium3DTileset) {
          impl.cesium3DTileset.maximumScreenSpaceError = value;
        }
      });
  }

  /**
   * @returns {CesiumTilesetOptions}
   */
  toJSON() {
    /** @type {CesiumTilesetOptions} */
    const config = super.toJSON();
    const defaultOptions = CesiumTilesetLayer.getDefaultOptions();
    if (this.highlightStyle) {
      config.highlightStyle = this.highlightStyle.toJSON();
    }

    if (this.screenSpaceError !== defaultOptions.screenSpaceError) {
      config.screenSpaceError = this.screenSpaceError;
    }

    if (this.screenSpaceErrorMobile !== defaultOptions.screenSpaceErrorMobile) {
      config.screenSpaceErrorMobile = this.screenSpaceErrorMobile;
    }

    if (this.maximumMemoryUsage !== defaultOptions.maximumMemoryUsage) {
      config.maximumMemoryUsage = this.maximumMemoryUsage;
    }

    const tilesetOptions = { ...this.tilesetOptions };
    if (tilesetOptions.url === this.url) {
      delete tilesetOptions.url;
    }

    const usedScreenSpaceError = isMobile() ? this.screenSpaceErrorMobile : this.screenSpaceError;
    if (tilesetOptions.maximumScreenSpaceError === usedScreenSpaceError) {
      delete tilesetOptions.maximumScreenSpaceError;
    }

    if (tilesetOptions.maximumMemoryUsage === this.maximumMemoryUsage) {
      delete tilesetOptions.maximumMemoryUsage;
    }

    if (Object.keys(tilesetOptions).length > 0) {
      config.tilesetOptions = tilesetOptions;
    }

    if (this._splitDirection !== SplitDirection.NONE) {
      config.splitDirection = this._splitDirection === SplitDirection.RIGHT ?
        'right' :
        'left';
    }

    if (Array.isArray(this.offset)) {
      config.offset = this.offset.slice();
    }

    return config;
  }

  /**
   * disposes of this layer, removes instances from the current maps and the framework
   * @api stable
   */
  destroy() {
    super.destroy();
    this.splitDirectionChanged.destroy();
  }
}

layerClassRegistry.registerClass(CesiumTilesetLayer.className, CesiumTilesetLayer);
export default CesiumTilesetLayer;
